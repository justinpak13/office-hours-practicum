# Keycloak login demo (oauth2-proxy)

This demo puts a Keycloak login in front of a small web app. The student VPN can't reach Khoury's staging Keycloak, so the demo runs a fake Keycloak on your laptop instead. It answers the way staging does, with the same URLs, tokens and error messages, so your app checks its tokens the same way it will check the real ones. Run it to see what your app receives once someone logs in, then put your own app behind the same proxy.

- [How it works](#how-it-works)
- [What you need](#what-you-need)
- [Run the demo](#run-the-demo)
- [What you'll see](#what-youll-see)
- [Test users](#test-users)
- [How the fake differs from the real Keycloak](#how-the-fake-differs-from-the-real-keycloak)
- [What's in this repo](#whats-in-this-repo)
- [Troubleshooting](#troubleshooting)
- [Next steps](#next-steps)

## How it works

1. You open https://localhost:4443. oauth2-proxy sees you aren't logged in and sends you to the fake Keycloak at http://localhost:8180.
2. You pick a test user. The real Keycloak sends you to the Microsoft login instead.
3. The fake Keycloak sends you back to oauth2-proxy with a one-time code, which oauth2-proxy trades for your tokens.
4. oauth2-proxy stores the tokens in an encrypted cookie and forwards your request to the app, with your ID token in the `Authorization: Bearer …` header.
5. The app checks the token's signature against the fake Keycloak's public keys, and checks who issued it, which app it's for and when it expires. Only then does it trust what the token says about you.
6. oauth2-proxy refreshes your tokens with the fake Keycloak every few minutes while you use the app, and you stay logged in for up to 8 hours.
7. Sign out clears the cookie, ends your Keycloak session and takes you to `/signed-out`.

The app never sees a password, and every request reaches it through oauth2-proxy.

## What you need

- Docker Desktop, or Docker Engine with the Compose plugin on Linux.
- macOS or Linux. On Windows, run everything inside WSL 2.

## Run the demo

Unzip the demo, then:

```sh
cd oauth2-proxy-demo
./init-secrets.sh
cp .env.example .env
docker compose up --build
```

`.env.example` already has the settings for the fake Keycloak, so you don't need to change anything. Open https://localhost:4443 and pick a test user. To stop, press Ctrl-C or run `docker compose down`. If you change `.env` or `docker-compose.yml`, run `docker compose up -d` again so the change takes effect.

`init-secrets.sh` creates a `secrets/` folder with a random cookie secret and a certificate for `https://localhost`. If you have mkcert installed (`brew install mkcert && mkcert -install`), your browser trusts the certificate. Otherwise you get a self-signed one, and your browser shows a warning you can click through for `localhost`.

On Linux, oauth2-proxy runs as user 65532 and can't read `secrets/` until you run `sudo chown 65532 secrets/*`.

## What you'll see

The page greets you by email and has a Sign out link. Below that are two tables.

**Verified claims** are what Keycloak says about you. The app only shows them after the token passes its checks. These are the ones you'll use:

| Claim | Meaning |
| --- | --- |
| `sub` | The user's permanent ID in this Keycloak realm. Use it as the user's ID in your database. |
| `email` | The user's email. Only trust it when `email_verified` is `true`. |
| `email_verified` | Whether Keycloak considers the email verified. |
| `name`, `preferred_username` | For display only. Don't base access decisions on them. |
| `exp`, `iat`, `auth_time` | When the token expires, when it was issued, and when the user last actually logged in (Unix time). |
| `iss`, `aud`, `azp` | Which Keycloak realm issued the token and which app it's for. The app checks these. |

**Request headers** are everything oauth2-proxy sent to the app:

| Header | What it is |
| --- | --- |
| `Authorization: Bearer …` | The ID token. This is what your app verifies. |
| `X-Forwarded-User` | The user's `sub`. |
| `X-Forwarded-Email` | The user's email. |
| `X-Forwarded-Preferred-Username` | The user's username. |
| `X-Forwarded-Groups` | The user's Keycloak roles. The fake gives everyone Keycloak's default roles. |

Your app shouldn't rely on the `X-Forwarded-*` headers. Use the verified token instead. [INTEGRATING.md](INTEGRATING.md) explains why.

## Test users

The fake Keycloak's users are in `fake-keycloak/users.json`. Add your own, for example to match your app's seed data. Changes show up the next time you log in, without a restart.

| Field | Claim in the token |
| --- | --- |
| `id` | `sub`. Give each new user a new UUID (`uuidgen` prints one), and don't change it afterwards. |
| `username` | `preferred_username` |
| `email` | `email` |
| `emailVerified` | `email_verified` |
| `firstName`, `lastName` | `given_name`, `family_name` and `name` |

To log in as someone else, sign out and pick another user.

## How the fake differs from the real Keycloak

- You pick a test user instead of logging in with Microsoft.
- The issuer is `http://localhost:8180/realms/staging` instead of `https://oauth-staging.khoury.northeastern.edu/realms/staging`. Keep it in your app's settings, not in your code.
- The `sub` values are the ones in `users.json`. Real users get different ones from the real Keycloak.
- Every time the fake restarts, it makes a new signing key and forgets all sessions, so you have to log in again.
- Its discovery document is a copy of staging's, but only the endpoints that oauth2-proxy and apps use work: login, token, keys, userinfo and logout.

## What's in this repo

| Path | What it is |
| --- | --- |
| `docker-compose.yml` | The three containers and all of oauth2-proxy's settings. |
| `.env.example` | Template for your `.env`. |
| `init-secrets.sh` | Creates the cookie secret and certificate in `secrets/`. |
| `fake-keycloak/keycloak.py` | The fake Keycloak. |
| `fake-keycloak/users.json` | The test users. |
| `fake-keycloak/discovery.json` | A copy of staging's discovery document. |
| `app/app.py` | The demo app. It verifies the token, then shows the claims and headers. |
| `app/requirements.txt`, `fake-keycloak/requirements.txt` | Python packages, pinned by hash. If you add a package, add its hashes too, or `pip` fails with "hashes are required". |
| `INTEGRATING.md` | How to put your own app behind oauth2-proxy. |

`.env` and `secrets/` are gitignored. Don't commit them.

## Troubleshooting

Start with the logs: `docker compose logs oauth2-proxy`, `docker compose logs fake-keycloak` and `docker compose logs app` usually say what went wrong.

| What you see | Why | What to do |
| --- | --- | --- |
| `403 Forbidden` after you log in | The user's email isn't in `OAUTH2_PROXY_EMAIL_DOMAINS`. | The oauth2-proxy logs show which email was rejected. |
| `500 Internal Server Error` after you log in | The user's `emailVerified` is `false` in `users.json`, or oauth2-proxy couldn't finish the login. | The oauth2-proxy logs say which. |
| `Unauthorized` from the app | The app rejected the token. | The app logs show `token rejected:` and the reason. |
| Keycloak says "Invalid parameter: redirect_uri" | `OAUTH2_PROXY_REDIRECT_URL` and the fake's `REDIRECT_URIS` in `docker-compose.yml` don't match. | Make them match. |
| A certificate warning, or "certificate expired" after a month | The self-signed certificate is only valid for 30 days. | Delete `secrets/tls.*` and run `./init-secrets.sh` again. Install mkcert first to get rid of the warning for good. |
| oauth2-proxy exits with "permission denied" on `/run/secrets/…` | On Linux, it can't read the files in `secrets/`. | `sudo chown 65532 secrets/*` |
| A change to `.env` does nothing | The containers only read it when they start. | `docker compose up -d` |
| https://localhost:4443 stops loading after `docker compose restart` | oauth2-proxy and the app share the fake Keycloak's network, and `restart` can leave them on its old one. | `docker compose up -d --force-recreate`. Use `docker compose up -d` instead of `restart`. |
| Sign out doesn't sign you out | You clicked the link in a different browser from the one you logged in with, such as VS Code's built-in browser. | Use the browser you logged in with. |

## Next steps

Read [INTEGRATING.md](INTEGRATING.md) to put your own app behind oauth2-proxy.
