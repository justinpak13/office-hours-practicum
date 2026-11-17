# PR 1 (SH-01): step by step

About 30–45 minutes, mostly waiting for installs and checks. Save `pr1-next12-react18.bundle` in your Downloads folder first.

## 1. Get the 4 tested commits onto a new branch

```bash
cd ~/CS6966/Khoury_OH_App_Repo/office-hours-practicum
nvm use 22
git status                        # must say "nothing to commit, working tree clean"
git checkout dev
git pull
git log --oneline -1              # must show: e4fb3d4 Node 22, CI on main and dev, ...
git checkout -b deps/next12-react18
git fetch ~/Downloads/pr1-next12-react18.bundle deps/next12-react18
git reset --hard FETCH_HEAD
git rebase dev --exec "git commit --amend --no-edit --reset-author --no-verify"
git log --format='%h %an | %s' dev..HEAD
```

The last command should list **4 commits, all under your name**:

```
… Ikwo … | swr 2 and visx 4 (React 18-compatible versions)
… Ikwo … | React 18.3 and react-big-calendar 1.x; hydration fixes; app lists moment
… Ikwo … | Next 12.3 and FullCalendar 6; remove next-offline, next-global-css, next-compose-plugins and the OpenSSL workaround
… Ikwo … | Finish OH-03: ical.js, remove unused packages and Percy, pin Prettier trailing commas; server declares yargs
```

**If `git log --oneline -1` shows something other than e4fb3d4:** someone merged into `dev` after this was tested. Stop and post in the chat; the commits may need a quick re-check.

## 2. Install and check (same checks as CI)

```bash
yarn install --frozen-lockfile    # must finish without "Your lockfile needs to be updated"
yarn tsc                          # no "error TS" lines
yarn lint                         # "0 errors" (6 warnings is normal)
```

Start Docker Desktop, then:

```bash
yarn dev:db:up
yarn workspace @koh/server test:unit           # Tests: 86 passed, 86 total
yarn workspace @koh/server test:integration    # Tests: 118 passed, 118 total
```

If the integration tests say "Unable to connect to the database", it's the macOS Docker issue from last time. Run `docker exec -it officehours-postgresql-1 psql -U postgres -c "CREATE DATABASE dev;" -c "CREATE DATABASE test;"` and try again.

## 3. Click through it (10 minutes)

```bash
yarn dev
```

Wait for `ready - started server on 0.0.0.0:3001`, then do the smoke test in `docs/shadcn/README.md` (steps 1–11). Everything should look exactly as before. That's the point of this PR: new versions, same app. Stop with Ctrl+C.

## 4. Push and open the PR

```bash
git push -u origin deps/next12-react18
```

On GitHub, click **Compare & pull request**:

- **Base repository:** `justinpak13/office-hours-practicum`, **base:** `dev`.
- **Title:** `Next 12.3, React 18.3, FullCalendar 6, swr 2, visx 4; finish OH-03`
- **Description:** paste `PR-1-DESCRIPTION.md`.
- **Reviewer:** Justin (Dev if Justin can't review this morning).

## 5. After it's approved

Click **Squash and merge**, then **Delete branch**. Post "SH-01 merged" in the chat. Kunal can now start SH-02.

**Cypress in CI:** it was 21/31 before this PR. If it's lower, open the Cypress log and paste the first failing test to me before merging. If it's 21 or higher, merge.
