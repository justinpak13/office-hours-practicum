import base64
import hashlib
import html
import json
import os
from functools import cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from urllib.request import urlopen

import jwt

ISSUER = os.environ["OIDC_ISSUER_URL"].rstrip("/")
CLIENT_ID = os.environ["OIDC_CLIENT_ID"]
SECURE_PREFIXES = ("https://", "http://localhost:")
if not ISSUER.startswith(SECURE_PREFIXES):
    raise SystemExit("OIDC_ISSUER_URL must be https, or http://localhost for the fake Keycloak")

STYLE = """
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
  td { border: 1px solid #ccc; padding: 6px 10px; vertical-align: top; }
  td:first-child { font-weight: 600; white-space: nowrap; }
  td:last-child { font-family: monospace; word-break: break-all; }
"""

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; "
        f"style-src 'sha256-{base64.b64encode(hashlib.sha256(STYLE.encode()).digest()).decode()}'; "
        "frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}

PAGE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Hello</title>
<style>{style}</style>
</head>
<body>
<h1>Hello, {user}!</h1>
<p>{method} {path}</p>
<p><a href="/oauth2/sign_out?rd=/signed-out">Sign out</a></p>
<h2>Verified claims</h2>
{claims}
<h2>Request headers</h2>
{headers}
</body>
</html>
"""

SIGNED_OUT = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Signed out</title>
<style>{style}</style>
</head>
<body>
<h1>You're signed out</h1>
<p><a href="/">Sign in again</a></p>
</body>
</html>
"""


@cache
def jwks_client():
    with urlopen(f"{ISSUER}/.well-known/openid-configuration", timeout=5) as resp:
        config = json.load(resp)
    if config.get("issuer") != ISSUER:
        raise ValueError(f"discovery issuer {config.get('issuer')!r} != {ISSUER!r}")
    if not config["jwks_uri"].startswith(SECURE_PREFIXES):
        raise ValueError("jwks_uri must be https")
    return jwt.PyJWKClient(config["jwks_uri"], timeout=5)


def verify(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise ValueError("no bearer token")
    token = auth.removeprefix("Bearer ")
    key = jwks_client().get_signing_key_from_jwt(token).key
    claims = jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        audience=CLIENT_ID,
        issuer=ISSUER,
        leeway=30,
        options={"require": ["exp", "iat", "sub"]},
    )
    if claims.get("azp") != CLIENT_ID:
        raise ValueError(f"token was issued to {claims.get('azp')!r}, not {CLIENT_ID!r}")
    return claims


def table(items):
    return "<table>" + "".join(
        f"<tr><td>{html.escape(k)}</td><td>{html.escape(str(v))}</td></tr>" for k, v in sorted(items)
    ) + "</table>"


class Handler(BaseHTTPRequestHandler):
    server_version = "hello"
    sys_version = ""

    def send(self, status, content_type, body, extra_headers=()):
        self.send_response(status)
        for name, value in {**SECURITY_HEADERS, **dict(extra_headers)}.items():
            self.send_header(name, value)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path == "/signed-out":
            self.send(200, "text/html; charset=utf-8", SIGNED_OUT.format(style=STYLE).encode())
            return

        try:
            claims = verify(self.headers)
        except Exception as e:
            self.log_message("token rejected: %s", e)
            self.send(401, "text/plain; charset=utf-8", b"Unauthorized\n",
                      {"WWW-Authenticate": 'Bearer error="invalid_token"'})
            return

        body = PAGE.format(
            style=STYLE,
            user=html.escape(claims.get("email") or claims.get("preferred_username") or claims["sub"]),
            method=html.escape(self.command),
            path=html.escape(self.path),
            claims=table(claims.items()),
            headers=table(self.headers.items()),
        ).encode()
        self.send(200, "text/html; charset=utf-8", body)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
