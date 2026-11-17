## What this does

Moves the frontend to the versions shadcn needs, with no visible change to the app. SH-01 in `docs/shadcn` on the `upgrade-docs` branch. 5 commits; review them one at a time in the **Commits** tab.

1. **Finish OH-03**
   - `ical.js` replaces `@fullcalendar/icalendar` (SchedulePanel already imports `ical.js` directly).
   - Removes `http-signature` and Percy (`@percy/cli`, `@percy/cypress`; never set up, no token). `eslint-plugin-cypress` moves to devDependencies. Adds `.prettierrc` (`trailingComma: es5`).
   - **The server now declares `yargs`.** `nestjs-command` (backfills, `yarn cli`) requires it but never listed it; it only worked because Percy happened to install a compatible copy. Without this line, removing Percy broke 2 unit and 1 integration test suite, and would have broken `yarn cli`.
2. **Next 10 → 12.3.4 and FullCalendar 5 → 6**
   - Removes `next-offline` (`_app.tsx` registers `public/service-worker.js` itself), `next-global-css`, `next-compose-plugins` and the `--openssl-legacy-provider` workaround.
   - Adds `*.tsbuildinfo` to `.gitignore`.
3. **React 17 → 18.3.1**, plus react-big-calendar 1.x, Testing Library 16 and React 18 types.
   - Hydration fixes in `SettingsPage.tsx` and `WelcomeStudents.tsx` (React 18 turns the old warnings into errors).
   - React 18 type fixes in `ErrorBoundary.tsx` (declares `children`) and `_document.tsx`.
   - The app now lists `moment` (3 app files import it; it reuses the server's copy).
4. **swr 0.2 → 2 and visx 1 → 4**: their old versions only support React 16.
   - swr: `responseInterface` → `SWRResponse` in 4 hooks; the fetcher in `TACheckInCheckOutTimes.tsx` takes its key as an array.
   - visx: no code changes.
5. **One rc-trigger (5.3.4)**, pinned in the root `resolutions`. rc-trigger is the code behind antd's Popover, Tooltip, Dropdown and Select.
   - antd's Popover, Menu and Select still used rc-trigger 5.2.10. Its "keep re-aligning the popup until it's stable" loop never ends on React 18, which batches state updates, so the tab froze.
   - That's why Cypress `login.spec.js` hung: open the avatar menu → the tab freezes.
   - Reproduced: 3 of 10 logout runs froze on PR 1 before this commit, 0 of 20 on `dev`. With this commit: 0 of 40 froze.
   - It wasn't only logout. An automated sweep that hovers and clicks every popup, menu, tooltip and picker on 12 pages, as all 3 roles, found **19 freezes without this commit**: tooltips, the Insights date picker and the nav menu. With it: 264 interactions and 0 freezes, the same as `dev` (396 interactions, 0 freezes).
   - 5.3.4 is the version antd 4.24 itself asks for; it caps the re-align at a fixed number of tries.
   - Lockfile: only `rc-trigger@5.2.10` is removed.

## How it was tested

On a copy of `dev` at e4fb3d4, from a clean `yarn install --frozen-lockfile`:

- `yarn tsc`: 0 errors in all 4 packages. `yarn lint`: 0 errors (the same 6 warnings as `dev`).
- Server: unit **86/86**, integration **118/118**, every suite running. `yarn cli backfill:make-empty-photoURL-null` runs.
- Lockfile: commit 1 changes no package versions, only removals.
- **9 pages × 3 roles** screenshotted on `dev` and on this branch: pixel-identical (Insights has a 9-pixel difference at the page edge).
- The 10-step smoke test (check in, join a queue, live update, help, finish, admin calendar, schedule, settings save, insights) passes in a production build **and** in `yarn dev`: 0 browser errors, 0 server errors, 0 hydration errors.
- Logout through the avatar menu (what `login.spec.js` does): 20/20 runs pass, 0 freezes. Popconfirm, the Select inside the check-in modal, tooltips, the date range picker and the nav menu all behave exactly as on `dev`.
- Cypress was not run locally. CI before this PR: 21/31 (the 10 known TA popup failures, fixed in SH-03). The first CI run of this PR hung in `login.spec.js`, which commit 5 fixes.

## Checks I ran on my machine

- [ ] `yarn install --frozen-lockfile`
- [ ] `yarn tsc` and `yarn lint`: 0 errors
- [ ] Server tests 86/86 and 118/118
- [ ] Smoke test steps 1–11 in `yarn dev` (11 = logout)
