# Phase 1–2 upgrade runbook

Takes the app from Node 14, React 17 and Next 10 to Node 22, React 18 and Next 15. Every change was run and tested on a copy of the repo at commit `1f7db3f` (builds, type checks, lint, server tests, and a browser test of 24 page/role combinations in development and production). The tested changes live on the branch `upgrade-reference` of [justinpak13/office-hours-practicum](https://github.com/justinpak13/office-hours-practicum), one commit per ticket. Ticket pull requests go into `dev`. Each ticket copies one commit, runs the checks and opens a pull request.

Each ticket has its own file in [`tickets/`](tickets/) with every command filled in.

## The queue

Merge into `dev` in this order, one at a time. Start your ticket only when the one before it is merged. When yours is merged, move its card to Done and post "OH-xx merged" in the team chat.

| # | Ticket | Area | Does it | Reviews it | Starts when | Hours |
|---|---|---|---|---|---|---|
| – | [OH-00](tickets/OH-00.md) Questions for the maintainers | Planning | I | — | Day 1 | 1 |
| – | [OH-02](tickets/OH-02.md) Baseline | QA | J | — | Day 1–3 | 4–8 |
| 1 | [OH-01](tickets/OH-01.md) CI runs on main and dev | CI | J | K | Day 1, after setup | 1–2 |
| 2 | [OH-03](tickets/OH-03.md) Cleanup and lint fixes | Repo-wide | D | I | #1 merged | 1 |
| 3 | [OH-04](tickets/OH-04.md) Node 22, TypeScript 5.9, bcrypt 6 | Repo-wide | D | K | #2 merged | 2–3 |
| 4 | [OH-05](tickets/OH-05.md) antd 4.24 | Frontend | I | D | #3 merged | 1–2 |
| 5 | [OH-06](tickets/OH-06.md) Next 12.3 and FullCalendar 6 | Frontend | K | I | #4 merged | 2–4 |
| 6 | [OH-07](tickets/OH-07.md) swr 2 | Frontend | D | K | #5 merged | 1–2 |
| 7 | [OH-08](tickets/OH-08.md) react-big-calendar 1.x | Frontend | I | J | #6 merged | 1 |
| 8 | [OH-09](tickets/OH-09.md) React 18.3 | Frontend | I | K | #7 merged | 2–3 |
| 9 | [OH-11](tickets/OH-11.md) visx 4 | Frontend | D | I | #8 merged | 1 |
| 10 | [OH-12](tickets/OH-12.md) Next 15.5 | Frontend | K | D | #9 merged | 2–4 |
| 11 | [OH-14](tickets/OH-14.md) Sign-off | QA | J | All | #10 merged | 3–5 |
| 12 | [OH-15](tickets/OH-15.md) Bring upgrade-backend-justin up to date with dev | Backend | Owner of that branch | Another teammate | #10 merged (can run alongside OH-14) | 2–4 |

OH-10 and OH-13 from the first plan were dropped: FullCalendar moved into OH-06, and the service-worker ticket wasn't needed.

## J: set up the fork (once, before anyone starts)

The fork is **https://github.com/justinpak13/office-hours-practicum**. Its `main` and `dev` are at the tested starting point (`1f7db3f`, plus one empty commit on `dev`). All ticket pull requests go into **`dev`**.

1. **Add the team** (skip anyone already added): fork → Settings → Collaborators → Add people. Each person accepts the email invite.
2. **Turn on Actions:** fork → Actions tab. If it says workflows are disabled, click "I understand my workflows, go ahead and enable them".
3. **Merge settings:** Settings → General → Pull Requests: tick **Allow squash merging** and **Automatically delete head branches**.
4. **Upload the tested changes:** save `office-hours-upgrade-reference.bundle` in the folder *above* your clone, then:

   ```bash
   cd office-hours-practicum
   git fetch ../office-hours-upgrade-reference.bundle upgrade-reference-dev:upgrade-reference
   git push origin upgrade-reference
   ```

   Never merge `upgrade-reference`. It's a reference only.
5. **Put these docs on their own branch,** so `main` and `dev` stay untouched. Copy the `docs/upgrade/` folder into the repo, then:

   ```bash
   git checkout dev && git pull origin dev
   git checkout -b upgrade-docs
   git add docs/upgrade
   git commit --no-verify -m "Add phase 1-2 upgrade docs"
   git push -u origin upgrade-docs
   git checkout dev
   ```

   The links in the tickets and on the Notion board point to this branch. Never merge it; it's for reading only, like `upgrade-reference`.

6. **Don't click "Sync fork"** until OH-14 is signed off. As of 29 October 2026, Khoury's `main` is still at `1f7db3f`.
7. **Existing branches:** `upgrade-frontend` and `upgrade-backend` hold only empty commits, so the tickets replace them; delete them or leave them. `upgrade-backend-justin` is real backend work. It's brought up to date in OH-15, after the tickets.

## Everyone: set up once (day 1)

Windows: install WSL2 first and run everything inside the Ubuntu terminal (turn on Docker Desktop's WSL2 option).

```bash
# tools: Git, Docker Desktop (running), nvm
nvm install 14 && npm install -g yarn@1
nvm install 22 && npm install -g yarn@1

git clone https://github.com/justinpak13/office-hours-practicum.git
cd office-hours-practicum
git checkout dev
nvm use 14
PUPPETEER_SKIP_DOWNLOAD=1 yarn install --frozen-lockfile

npx web-push generate-vapid-keys   # use the two keys below
```

Create `packages/server/.env.development`:

```
DB_URL=postgres://postgres@localhost:5432/dev
DOMAIN=http://localhost:3000
JWT_SECRET=dev-only-not-a-secret
UPLOAD_LOCATION=uploads
PUBLICKEY=paste-public-key-here
PRIVATEKEY=paste-private-key-here
EMAIL=mailto:you@example.com
ADMIN_SESSION_SECRET=dev-only-not-a-secret
```

```bash
mkdir -p packages/server/uploads
yarn dev:db:up
yarn dev
```

Open http://localhost:3000/dev, click **Seed Data**, and log in (1 = student, 3 = TA, 5 = professor). After J has pushed the reference branch: `git fetch origin upgrade-reference`.

**When you open any pull request:** check that the base repository is `justinpak13/office-hours-practicum` and the base branch is `dev`. On forks, GitHub pre-selects the original Khoury repo, which would send your PR to the maintainers.

## Questions for the maintainers

I sends these in OH-00. None of them block phases 1–2.

| # | Question | If yes | If no |
|---|---|---|---|
| 1 | Can production run Node 22.12 or later? | Nothing changes. | Ask what version and when. You can still merge in the fork, but upstream can't deploy until production has Node 22. Say so at the top of every upstream PR. |
| 2 | Do push notifications work in production today? | J tests them in OH-14. | Nothing to test; note it in the sign-off. |
| 3 | Is Sentry still used? (The address belongs to the old Sandbox account.) | Keep it; upgrade in phase 3; ask for access. | Phase 3 deletes the Sentry packages. |
| 4 | Do they need React 19 or Next 16 soon? | Phase 3 uses the fallback plan (antd 5 step). | Phase 3 follows the recommended plan. |
| 5 | Are the failing server tests known (25 unit, 18 integration in my run), and does the Cypress CI job pass upstream? | Keep comparing against the baseline; add any secrets they name. | Open an upstream issue listing them. Don't fix them inside these tickets. |
| 6 | One pull request per ticket, and which upstream branch? | Send merged commits upstream in queue order, one PR each. | Combine into the groups they ask for after OH-14. |
| 7 | Can they share an anonymized database (`infrastructure/prod/anonymize.sh`)? | J loads it in OH-14 to check charts and Insights. | Check the charts after the first deploy to a test server. |

## What wasn't tested

Cypress (its download was blocked), the GitHub Actions runs, real push-notification delivery, the Popular Times chart (no seed data for it), and macOS/Windows (tested on Linux). J's OH-02 and OH-14 cover these.
