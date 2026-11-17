# Putting your app behind oauth2-proxy

This guide shows how to swap the demo app for the one you're building, and what your app has to do to keep logins secure.

- [The rules](#the-rules)
- [1. Point oauth2-proxy at your app](#1-point-oauth2-proxy-at-your-app)
- [2. Verify the token on every request](#2-verify-the-token-on-every-request)
- [3. Identify the user](#3-identify-the-user)
- [4. Decide what each user can do](#4-decide-what-each-user-can-do)
- [5. Sign out](#5-sign-out)
- [6. JavaScript frontends and APIs](#6-javascript-frontends-and-apis)
- [Checklist](#checklist)

## The rules

1. Trust the token, not the headers. Verify `Authorization: Bearer …` on every request, and don't base decisions on `X-Forwarded-Email` or the other `X-Forwarded-*` headers. Anyone who reaches your app without going through the proxy can fake those headers, but nobody can fake a signed token.
2. Identify users by `sub`. It's the user's permanent Keycloak ID, while emails and names can change.
3. Only use `email` when `email_verified` is `true`, and compare emails in lowercase.
4. Only oauth2-proxy should be able to reach your app, so don't publish your app's port.
5. Don't commit `.env`, `secrets/` or the client secret. Your app doesn't need the client secret at all.

## 1. Point oauth2-proxy at your app

Your app needs two settings, with the same values as in `.env`:

| Setting | Value |
| --- | --- |
| `OIDC_ISSUER_URL` | `http://localhost:8180/realms/staging` (the fake Keycloak) |
| `OIDC_CLIENT_ID` | the client ID from `.env` |

Your app can run in Docker next to oauth2-proxy, or directly on your laptop.

### Option A: your app runs in Docker

Replace the demo's `app` service in `docker-compose.yml` with yours:

```yaml
  app:
    build: ../your-app
    network_mode: service:fake-keycloak
    environment:
      OIDC_ISSUER_URL: ${OAUTH2_PROXY_OIDC_ISSUER_URL}
      OIDC_CLIENT_ID: ${OAUTH2_PROXY_CLIENT_ID}
    depends_on:
      - fake-keycloak
```

Then set `OAUTH2_PROXY_UPSTREAMS: http://localhost:3000` in the `oauth2-proxy` service, using your app's port. `network_mode` puts your app on the same network as oauth2-proxy and the fake Keycloak, so it reaches the fake at http://localhost:8180, the same address your browser uses. Don't add `ports`, so the app is only reachable from oauth2-proxy.

### Option B: your app runs on your laptop

This is easier while you're developing, because your framework's auto-reload keeps working. In the `oauth2-proxy` service, set:

```yaml
      OAUTH2_PROXY_UPSTREAMS: http://host.docker.internal:3000
```

Then start your app on port 3000. It fetches the fake Keycloak's keys from http://localhost:8180, which works from your laptop. On macOS, have it listen on `127.0.0.1`: oauth2-proxy can still reach it, and nothing else on your network can. On Linux, also add `extra_hosts: ["host.docker.internal:host-gateway"]` to the `fake-keycloak` service, which owns the network oauth2-proxy uses, and have your app listen on `0.0.0.0`. That makes it reachable from your network, which is acceptable for development because it still rejects any request without a valid token.

Either way, run `docker compose up -d` and open https://localhost:4443.

## 2. Verify the token on every request

Put the check in middleware, so no route can skip it. A token is only valid if:

- its signature matches Keycloak's public keys, using the `RS256` algorithm;
- `iss` is exactly the issuer URL;
- `aud` and `azp` are your client ID;
- `exp` hasn't passed (allow 30 seconds for clock differences);
- it has a `sub`.

If any check fails, return `401` and ignore everything in the token. Use an established JWT library such as [jose](https://github.com/panva/jose) rather than writing your own.

In unit tests, replace the check with a stub that returns fake claims. Don't add a switch that turns it off.

## 3. Identify the user

On each request, look the user up by `sub`, and create a record the first time you see them. Store their email and name as well, and update both from the token each time, since they can change.

```
user = find user where sub == claims.sub
if none: create user with sub = claims.sub
user.email = verified email (or none)
user.name  = claims.name
```

Someone who logs in with two different Microsoft accounts gets two different `sub` values, so your app sees two users. That's usually what you want, because people keep separate accounts for different things. If you do need to merge two accounts, make it a deliberate step, such as an admin action. Never merge them automatically just because the names match.

## 4. Decide what each user can do

Keycloak tells your app who someone is, not what they're allowed to do. That's up to your app:

- Start from no access. Someone who has just logged in for the first time should get the least access your app offers.
- Grant extra permissions by `sub`, or by verified email if you have to, for example with a table of admins.
- Check permissions on the server for every request. Hiding a button in the frontend doesn't stop anyone.

## 5. Sign out

Point your Sign out link at:

```
/oauth2/sign_out?rd=/signed-out
```

That clears the oauth2-proxy cookie, ends the Keycloak session and sends the user to `/signed-out`. Your app has to serve a page at `/signed-out`, and your middleware has to let it through without a token. oauth2-proxy lets that one path through without a login.

With the fake Keycloak, signing in again shows the list of test users. With the real one, it won't ask for a password, because signing out of your app doesn't sign the user out of Microsoft.

## 6. JavaScript frontends and APIs

Serve your frontend and your API through oauth2-proxy at the same address, https://localhost:4443. The browser then sends the login cookie with every request on its own, and you don't run into cross-origin (CORS) errors. If you use a dev server like Vite, point `OAUTH2_PROXY_UPSTREAMS` at it, and use its proxy setting to forward `/api` to your backend.

Don't handle tokens in browser JavaScript. The login cookie is HttpOnly on purpose, and your backend gets the token from oauth2-proxy.

When a session expires, oauth2-proxy normally redirects to Keycloak, which a `fetch()` call can't follow. If your API calls send `Accept: application/json`, oauth2-proxy returns `401` instead, and your frontend can reload the page to log the user in again:

```js
const res = await fetch("/api/things", { headers: { Accept: "application/json" } });
if (res.status === 401) window.location.reload();
```

Keep your framework's CSRF protection turned on. Logins use a cookie, so forms and other requests that change data still need it.

## Checklist

- [ ] Middleware verifies the token on every request except `/signed-out`.
- [ ] It checks signature (`RS256`), `iss`, `aud`, `azp`, `exp` and `sub`, and answers `401` on failure.
- [ ] Users are stored and looked up by `sub`.
- [ ] `email` is used only when `email_verified` is `true`, and compared in lowercase.
- [ ] Nothing trusts `X-Forwarded-*` headers.
- [ ] Permissions are checked on the server, and the default is no access.
- [ ] `/signed-out` exists, and the Sign out link goes to `/oauth2/sign_out?rd=/signed-out`.
- [ ] API calls send `Accept: application/json` and reload the page on `401`.
- [ ] The app's port isn't published. `.env` and `secrets/` aren't committed.
