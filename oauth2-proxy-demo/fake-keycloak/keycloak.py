import base64
import datetime
import hashlib
import hmac
import html
import json
import os
import secrets
import threading
import time
import uuid
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, unquote_plus, urlencode, urlsplit

import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID

PORT = 8180
REALM = "staging"
BASE = f"http://localhost:{PORT}"
ISSUER = f"{BASE}/realms/{REALM}"
STAGING_ISSUER = "https://oauth-staging.khoury.northeastern.edu/realms/staging"
OIDC = f"/realms/{REALM}/protocol/openid-connect"
BROKER = f"/realms/{REALM}/broker/neu"
COOKIE = "KEYCLOAK_IDENTITY"
CLIENT_ID = os.environ["CLIENT_ID"]
CLIENT_SECRET = os.environ["CLIENT_SECRET"]
REDIRECT_URIS = os.environ["REDIRECT_URIS"].split(",")
USERS_FILE = "users.json"

# Staging's token lifespans. Codes and login pages use Keycloak's defaults.
ACCESS_TOKEN_LIFESPAN = 300
SSO_SESSION_IDLE = 172800
CODE_LIFESPAN = 60
LOGIN_LIFESPAN = 1800

TOKEN_SCOPE = "openid profile email"
REALM_ROLES = ["offline_access", f"default-roles-{REALM}", "uma_authorization"]
ACCOUNT_ROLES = ["manage-account", "manage-account-links", "view-profile"]
WEB_ORIGINS = sorted({f"{urlsplit(u).scheme}://{urlsplit(u).netloc}" for u in REDIRECT_URIS})


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64uint(n):
    return b64url(n.to_bytes((n.bit_length() + 7) // 8, "big"))


def realm_key(alg, use):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key()
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, REALM)])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(public)
        .serial_number(int(now.timestamp() * 1000))
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=3653))
        .sign(key, hashes.SHA256())
        .public_bytes(serialization.Encoding.DER)
    )
    spki = public.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    return key, {
        "kid": b64url(hashlib.sha256(spki).digest()),
        "kty": "RSA",
        "alg": alg,
        "use": use,
        "n": b64uint(public.public_numbers().n),
        "e": b64uint(public.public_numbers().e),
        "x5c": [base64.b64encode(cert).decode()],
        "x5t": b64url(hashlib.sha1(cert).digest()),
        "x5t#S256": b64url(hashlib.sha256(cert).digest()),
    }


KEY, SIGNING_JWK = realm_key("RS256", "sig")
_, ENCRYPTION_JWK = realm_key("RSA-OAEP", "enc")
PUBLIC_KEY = KEY.public_key()
JWKS = json.dumps({"keys": [SIGNING_JWK, ENCRYPTION_JWK]}, separators=(",", ":"))
REFRESH_KEY = secrets.token_bytes(64)
REFRESH_KID = str(uuid.uuid4())

with open("discovery.json") as f:
    DISCOVERY = f.read().replace(STAGING_ISSUER, ISSUER)

COMMON_HEADERS = [
    ("Referrer-Policy", "no-referrer"),
    ("X-Content-Type-Options", "nosniff"),
    ("X-XSS-Protection", "1; mode=block"),
]
FRAME_OPTIONS = [("X-Frame-Options", "SAMEORIGIN")]
HTML_HEADERS = [
    ("X-Robots-Tag", "none"),
    ("Content-Security-Policy", "frame-src 'self'; frame-ancestors 'self'; object-src 'none';"),
    ("Content-Language", "en"),
]
TOKEN_HEADERS = [("Cache-Control", "no-store"), ("Pragma", "no-cache")]
NO_STORE = [("Cache-Control", "no-store, must-revalidate, max-age=0")]

STYLE = """
  body { margin: 0; background: #f5f5f5; color: #151515; font-family: system-ui, sans-serif; }
  #kc-header { padding: 2rem 1rem 1rem; text-align: center; font-size: 1.5rem; letter-spacing: .1em; text-transform: uppercase; }
  .card-pf { max-width: 28rem; margin: 0 auto 2rem; padding: 1.5rem 2rem 2rem; background: #fff; border: 1px solid #ddd; }
  #kc-page-title { margin: 0 0 1.25rem; font-size: 1.5rem; font-weight: 400; text-align: center; }
  .instruction { margin: 0 0 1rem; }
  button, input[type=submit] { display: block; width: 100%; margin: 0 0 .5rem; padding: .75rem 1rem; font: inherit; text-align: left; cursor: pointer; }
  input[type=submit] { text-align: center; }
  button span { display: block; color: #555; font-size: .875rem; }
"""

PAGE = """<!DOCTYPE html>
<html class="login-pf">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sign in to {realm}</title>
<style>{style}</style>
</head>
<body class="">
<div class="login-pf-page">
<div id="kc-header" class="login-pf-page-header"><div id="kc-header-wrapper" class="">{realm}</div></div>
<div class="card-pf">
<header class="login-pf-header"><h1 id="kc-page-title">{title}</h1></header>
<div id="kc-content"><div id="kc-content-wrapper">
{content}
</div></div>
</div>
</div>
</body>
</html>
"""

LOCK = threading.Lock()
SESSIONS = {}
CODES = {}
USED_CODES = {}
LOGINS = {}


def purge(store):
    now = time.time()
    for key in [k for k, v in store.items() if v["expires"] < now]:
        del store[key]


def load_users():
    with open(USERS_FILE) as f:
        return {u["username"]: u for u in json.load(f)}


def find_user(user_id):
    return next((u for u in load_users().values() if u["id"] == user_id), None)


def active_session(sid):
    session = SESSIONS.get(sid)
    if session and time.time() - session["last"] <= SSO_SESSION_IDLE:
        return session
    SESSIONS.pop(sid, None)
    return None


def profile(user):
    return {
        "email_verified": user["emailVerified"],
        "name": f"{user['firstName']} {user['lastName']}",
        "preferred_username": user["username"],
        "given_name": user["firstName"],
        "family_name": user["lastName"],
        "email": user["email"],
    }


def auth_session_cookies(restart=None):
    value = f"{uuid.uuid4()}.{secrets.token_urlsafe(18)}"
    cookies = [
        ("Set-Cookie", f"AUTH_SESSION_ID={value}; Version=1; Path=/realms/{REALM}/; SameSite=None; Secure; HttpOnly"),
        ("Set-Cookie", f"AUTH_SESSION_ID_LEGACY={value}; Version=1; Path=/realms/{REALM}/; HttpOnly"),
    ]
    if restart is True:
        cookies.append(("Set-Cookie", f"KC_RESTART={secrets.token_urlsafe(623)}; Version=1; Path=/realms/{REALM}/; HttpOnly"))
    elif restart is False:
        cookies.append(("Set-Cookie", f"KC_RESTART=; Version=1; Expires=Thu, 01-Jan-1970 00:00:10 GMT; Max-Age=0; Path=/realms/{REALM}/; HttpOnly"))
    return cookies


def jws(alg, kid, claims, signature):
    header = f'{{"alg":"{alg}","typ" : "JWT","kid" : "{kid}"}}'
    payload = json.dumps(claims, separators=(",", ":"), ensure_ascii=False)
    signing_input = f"{b64url(header.encode())}.{b64url(payload.encode())}"
    return f"{signing_input}.{b64url(signature(signing_input.encode()))}"


def sign(claims):
    return jws("RS256", SIGNING_JWK["kid"], claims, lambda data: KEY.sign(data, padding.PKCS1v15(), hashes.SHA256()))


def sign_refresh(claims):
    return jws("HS256", REFRESH_KID, claims, lambda data: hmac.new(REFRESH_KEY, data, hashlib.sha256).digest())


def token_response(sid, session, user):
    grant = session["grant"]
    now = int(time.time())
    refresh_exp = now + SSO_SESSION_IDLE
    nonce = {"nonce": grant["nonce"]} if grant["nonce"] else {}

    def claims(typ, aud):
        return {
            "exp": now + ACCESS_TOKEN_LIFESPAN, "iat": now, "auth_time": session["auth_time"], "jti": str(uuid.uuid4()),
            "iss": ISSUER, "aud": aud, "sub": user["id"], "typ": typ, "azp": CLIENT_ID, **nonce, "session_state": sid,
        }

    access_token = sign({
        **claims("Bearer", "account"), "acr": grant["acr"], "realm_access": {"roles": REALM_ROLES},
        "resource_access": {"account": {"roles": ACCOUNT_ROLES}}, "scope": TOKEN_SCOPE, "sid": sid, **profile(user),
    })
    id_token = sign({
        **claims("ID", CLIENT_ID), "at_hash": b64url(hashlib.sha256(access_token.encode()).digest()[:16]),
        "acr": grant["acr"], "sid": sid, **profile(user),
    })
    refresh_token = sign_refresh({
        "exp": refresh_exp, "iat": now, "jti": str(uuid.uuid4()), "iss": ISSUER, "aud": ISSUER, "sub": user["id"],
        "typ": "Refresh", "azp": CLIENT_ID, **nonce, "session_state": sid, "scope": TOKEN_SCOPE, "sid": sid,
    })
    session["last"] = now
    return {
        "access_token": access_token,
        "expires_in": ACCESS_TOKEN_LIFESPAN,
        "refresh_expires_in": refresh_exp - now,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "id_token": id_token,
        "not-before-policy": 0,
        "session_state": sid,
        "scope": TOKEN_SCOPE,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "fake-keycloak"
    sys_version = ""

    def log_request(self, code="-", size="-"):
        self.log_message('"%s %s" %s', self.command, urlsplit(self.path).path, code)

    def send(self, status, content_type, body, headers=(), frame_options=True):
        self.send_response(status)
        for name, value in [*COMMON_HEADERS, *(FRAME_OPTIONS if frame_options else []), *headers]:
            self.send_header(name, value)
        if content_type:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, data, headers=()):
        body = data if isinstance(data, str) else json.dumps(data, separators=(",", ":"))
        self.send(status, "application/json", body.encode(), headers)

    def send_page(self, status, title, content, headers=()):
        body = PAGE.format(realm=REALM, style=STYLE, title=html.escape(title), content=content)
        self.send(status, "text/html;charset=utf-8", body.encode(), [*HTML_HEADERS, *headers])

    def error_page(self, message):
        self.send_page(400, "We are sorry...", f'<div id="kc-error-message">\n<p class="instruction">{html.escape(message)}</p>\n</div>')

    def logged_out_page(self, headers=()):
        self.send_page(200, "You are logged out", '<div id="kc-info-message">\n<p class="instruction">You are logged out</p>\n</div>',
                       [("Cache-Control", "no-cache"), *headers])

    def token_json(self, status, data):
        self.send_json(status, data, TOKEN_HEADERS)

    def invalid_grant(self, description):
        self.token_json(400, {"error": "invalid_grant", "error_description": description})

    def bearer_error(self, description=None):
        challenge = f'Bearer realm="{REALM}"'
        if description:
            challenge += f', error="invalid_token", error_description="{description}"'
        self.send(401, "application/octet-stream", b"", [("WWW-Authenticate", challenge)], frame_options=False)

    def redirect(self, uri, params, status=302, headers=NO_STORE):
        query = urlencode({k: v for k, v in params.items() if v is not None})
        location = uri + ("&" if "?" in uri else "?") + query if query else uri
        self.send(status, None, b"", [("Location", location), *headers], frame_options=False)

    def query(self):
        return dict(parse_qsl(urlsplit(self.path).query))

    def form(self):
        length = int(self.headers.get("Content-Length") or 0)
        return dict(parse_qsl(self.rfile.read(min(length, 65536)).decode()))

    def browser_sid(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        return cookie[COOKIE].value if COOKIE in cookie else None

    def cookie_sid(self):
        sid = self.browser_sid()
        with LOCK:
            return sid if sid and active_session(sid) else None

    def do_GET(self):
        routes = {
            f"/realms/{REALM}/.well-known/openid-configuration":
                lambda: self.send_json(200, DISCOVERY, [("Cache-Control", "no-cache, must-revalidate, no-transform, no-store")]),
            f"{OIDC}/certs": lambda: self.send_json(200, JWKS, [("Cache-Control", "no-cache")]),
            f"{OIDC}/auth": lambda: self.authorize(self.query()),
            f"{BROKER}/login": lambda: self.pick_user(self.query()),
            f"{OIDC}/userinfo": lambda: self.userinfo(None),
            f"{OIDC}/logout": lambda: self.logout(self.query()),
        }
        routes.get(urlsplit(self.path).path, self.not_found)()

    def do_POST(self):
        routes = {
            f"{OIDC}/token": lambda: self.token(self.form()),
            f"{BROKER}/endpoint": lambda: self.authenticate(self.form()),
            f"{OIDC}/userinfo": self.userinfo_post,
            f"{OIDC}/logout": lambda: self.logout(self.form()),
            f"{OIDC}/logout/logout-confirm": self.confirm_logout,
        }
        routes.get(urlsplit(self.path).path, self.not_found)()

    def not_found(self):
        self.send_json(404, {"error": f"RESTEASY003210: Could not find resource for full path: {BASE}{urlsplit(self.path).path}"})

    def authorize(self, params):
        redirect_uri = params.get("redirect_uri")
        if params.get("client_id") != CLIENT_ID or redirect_uri not in REDIRECT_URIS:
            return self.error_page("Invalid parameter: redirect_uri")
        state = params.get("state")
        if params.get("response_type") != "code":
            return self.redirect(redirect_uri, {"error": "unsupported_response_type", "state": state}, headers=())
        method = params.get("code_challenge_method", "plain")
        if method not in ("plain", "S256"):
            return self.redirect(redirect_uri, {"error": "invalid_request", "error_description": "Invalid parameter: code_challenge_method", "state": state})
        grant = {
            "redirect_uri": redirect_uri,
            "state": state,
            "nonce": params.get("nonce"),
            "code_challenge": params.get("code_challenge"),
            "code_challenge_method": method,
        }
        sid = self.cookie_sid()
        if sid and params.get("prompt") != "login":
            return self.send_code(grant, sid, "0")
        if params.get("prompt") == "none":
            return self.redirect(redirect_uri, {"error": "login_required", "state": state}, headers=[*NO_STORE, *auth_session_cookies(restart=False)])
        session_code = secrets.token_urlsafe(32)
        with LOCK:
            purge(LOGINS)
            LOGINS[session_code] = {**grant, "expires": time.time() + LOGIN_LIFESPAN}
        self.redirect(BASE + BROKER + "/login", {"session_code": session_code, "client_id": CLIENT_ID, "tab_id": secrets.token_urlsafe(8)},
                      status=303, headers=[*NO_STORE, *auth_session_cookies(restart=True)])

    def pick_user(self, params):
        session_code = params.get("session_code", "")
        with LOCK:
            login = LOGINS.get(session_code)
        if not login or login["expires"] < time.time():
            return self.error_page("Your login attempt timed out. Login will start from the beginning.")
        buttons = "".join(
            f'<button name="username" value="{html.escape(u["username"])}">'
            f'{html.escape(u["firstName"])} {html.escape(u["lastName"])}<span>{html.escape(u["email"])}</span></button>\n'
            for u in load_users().values()
        )
        self.send_page(200, "Pick a test user", (
            '<p class="instruction">This is the fake Keycloak. Staging shows the Microsoft login here.</p>\n'
            f'<form method="post" action="{BROKER}/endpoint">\n'
            f'<input type="hidden" name="session_code" value="{html.escape(session_code)}">\n{buttons}</form>'
        ), [("Cache-Control", "no-store")])

    def authenticate(self, form):
        with LOCK:
            login = LOGINS.pop(form.get("session_code", ""), None)
        if not login or login["expires"] < time.time():
            return self.error_page("Your login attempt timed out. Login will start from the beginning.")
        user = load_users().get(form.get("username"))
        if not user:
            return self.error_page("Invalid username or password.")
        sid = str(uuid.uuid4())
        now = time.time()
        with LOCK:
            SESSIONS[sid] = {"user_id": user["id"], "last": now, "auth_time": int(now), "client_attached": False}
        self.log_message("login %s, session %s", user["username"], sid)
        self.send_code(login, sid, "1", [("Set-Cookie", f"{COOKIE}={sid}; Path=/realms/{REALM}/; HttpOnly; SameSite=Lax")])

    def send_code(self, grant, sid, acr, headers=()):
        code = f"{uuid.uuid4()}.{sid}.{uuid.uuid4()}"
        with LOCK:
            purge(CODES)
            CODES[code] = {**grant, "sid": sid, "acr": acr, "expires": time.time() + CODE_LIFESPAN}
        self.redirect(grant["redirect_uri"], {"state": grant["state"], "session_state": sid, "code": code}, headers=[*NO_STORE, *headers])

    def client_credentials(self, form):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Basic "):
            return form.get("client_id"), form.get("client_secret")
        try:
            client_id, _, client_secret = base64.b64decode(auth.removeprefix("Basic ")).decode().partition(":")
        except ValueError:
            return None, None
        return unquote_plus(client_id), unquote_plus(client_secret)

    def token(self, form):
        client_id, client_secret = self.client_credentials(form)
        if client_id != CLIENT_ID:
            return self.token_json(401, {"error": "invalid_client", "error_description": "Invalid client or Invalid client credentials"})
        if not secrets.compare_digest((client_secret or "").encode(), CLIENT_SECRET.encode()):
            return self.token_json(401, {"error": "unauthorized_client", "error_description": "Invalid client or Invalid client credentials"})
        grant_type = form.get("grant_type")
        if grant_type == "authorization_code":
            return self.exchange_code(form)
        if grant_type == "refresh_token":
            return self.refresh(form)
        self.token_json(400, {"error": "unsupported_grant_type", "error_description": "Unsupported grant_type"})

    def exchange_code(self, form):
        with LOCK:
            purge(USED_CODES)
            code = CODES.pop(form.get("code", ""), None)
            if code:
                USED_CODES[form["code"]] = {"sid": code["sid"], "expires": code["expires"]}
            elif form.get("code") in USED_CODES:
                session = SESSIONS.get(USED_CODES[form["code"]]["sid"])
                if session:
                    session["client_attached"] = False
                self.log_message("code used twice, app detached from session %s", USED_CODES[form["code"]]["sid"])
        if not code or code["expires"] < time.time():
            return self.invalid_grant("Code not valid")
        if form.get("redirect_uri") != code["redirect_uri"]:
            return self.invalid_grant("Incorrect redirect_uri")
        if code["code_challenge"]:
            verifier = form.get("code_verifier")
            if not verifier:
                return self.invalid_grant("PKCE code verifier not specified")
            if code["code_challenge_method"] == "S256":
                verifier = b64url(hashlib.sha256(verifier.encode()).digest())
            if not secrets.compare_digest(verifier.encode(), code["code_challenge"].encode()):
                return self.invalid_grant("PKCE verification failed")
        self.issue_tokens(code["sid"], {"nonce": code["nonce"], "acr": code["acr"]})

    def refresh(self, form):
        try:
            claims = jwt.decode(form.get("refresh_token", ""), REFRESH_KEY, algorithms=["HS256"], audience=ISSUER, issuer=ISSUER)
        except jwt.ExpiredSignatureError:
            return self.invalid_grant("Token is not active")
        except jwt.PyJWTError:
            return self.invalid_grant("Invalid refresh token")
        if claims.get("typ") != "Refresh" or claims.get("azp") != CLIENT_ID:
            return self.invalid_grant("Invalid refresh token")
        self.issue_tokens(claims["sid"], None)

    def issue_tokens(self, sid, grant):
        with LOCK:
            session = active_session(sid)
            user = session and find_user(session["user_id"])
            if user:
                if grant:
                    session["grant"] = grant
                    session["client_attached"] = True
                body = token_response(sid, session, user) if session["client_attached"] else None
            else:
                SESSIONS.pop(sid, None)
        if not user:
            return self.invalid_grant("Session not active")
        if body is None:
            return self.invalid_grant("Session doesn't have required client")
        self.log_message("%s, session %s", "code exchanged" if grant else "refreshed", sid)
        self.token_json(200, body)

    def userinfo_post(self):
        if "Content-Type" not in self.headers:
            return self.send_json(500, {"error": "unknown_error"})
        self.userinfo(self.form().get("access_token"))

    def userinfo(self, form_token):
        auth = self.headers.get("Authorization", "")
        token = auth.removeprefix("Bearer ") if auth.startswith("Bearer ") else form_token
        if not token:
            return self.bearer_error()
        try:
            claims = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"], audience="account", issuer=ISSUER)
        except jwt.PyJWTError:
            return self.bearer_error("Token verification failed")
        if claims.get("typ") != "Bearer":
            return self.bearer_error("Token verification failed")
        with LOCK:
            session = active_session(claims.get("sid"))
        user = session and session["client_attached"] and find_user(claims["sub"])
        if not user:
            return self.bearer_error("User session not found or doesn't have client attached on it")
        self.send_json(200, {"sub": user["id"], **profile(user)}, [("Cache-Control", "no-cache")])

    def logout(self, params):
        hint = params.get("id_token_hint")
        if not hint:
            return self.send_page(200, "Logging out", (
                '<div id="kc-logout-confirm" class="content-area">\n'
                '<p class="instruction">Do you want to logout?</p>\n'
                f'<form class="form-actions" action="{OIDC}/logout/logout-confirm?client_id=account&amp;tab_id={secrets.token_urlsafe(8)}" method="POST">\n'
                f'<input type="hidden" name="session_code" value="{secrets.token_urlsafe(32)}">\n'
                '<input tabindex="4" class="pf-c-button pf-m-primary pf-m-block btn-lg" name="confirmLogout" id="kc-logout" type="submit" value="Logout"/>\n'
                '</form>\n</div>'
            ), [("Cache-Control", "no-cache"), *auth_session_cookies()])
        try:
            sid = jwt.decode(hint, PUBLIC_KEY, algorithms=["RS256"], issuer=ISSUER,
                             options={"verify_exp": False, "verify_aud": False}).get("sid")
        except jwt.PyJWTError:
            return self.error_page("Invalid parameter: id_token_hint")
        self.end_session(sid)
        target = params.get("post_logout_redirect_uri")
        if target and any(target.startswith(o + "/") for o in WEB_ORIGINS):
            return self.redirect(target, {"state": params.get("state")}, headers=[*NO_STORE, *self.logout_cookies()])
        self.logged_out_page(self.logout_cookies())

    def confirm_logout(self):
        self.end_session(self.browser_sid())
        self.logged_out_page(self.logout_cookies())

    def end_session(self, sid):
        with LOCK:
            SESSIONS.pop(sid, None)
        self.log_message("logout, session %s", sid)

    def logout_cookies(self):
        cookies = auth_session_cookies()
        if self.browser_sid():
            cookies.append(("Set-Cookie", f"{COOKIE}=; Max-Age=0; Path=/realms/{REALM}/; HttpOnly; SameSite=Lax"))
        return cookies


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
