# antd → shadcn in two weeks

Goal: by **Tue Dec 1**, antd and `@ant-design/icons` are uninstalled and every screen uses shadcn/ui. Everything was tested on a copy of `dev` at `e4fb3d4` before these tickets were written.

**Done means:**

- `grep -rlE 'from "antd|@ant-design/icons' packages/app/components packages/app/pages` prints nothing.
- antd and `@ant-design/icons` are removed from `package.json`.
- The app builds, the server tests pass, Cypress is green and the smoke test passes for all three roles.

**Not part of the two weeks:** Next 15, Tailwind 4, React 19, removing styled-components, and replacing `@ant-design/charts`. That last one stays because it doesn't depend on antd. Dev's T10–T17 backend tickets pause and resume afterwards.

## What's already done and tested

| | What | Result on a copy of `dev` |
|---|---|---|
| PR 1 (SH-01) | Next 10 → 12.3, React 17 → 18.3, FullCalendar 6, react-big-calendar 1, swr 2, visx 4, one rc-trigger, rest of OH-03 | 0 type errors, 0 lint errors, server 86/86 and 118/118, 9 pages pixel-identical, smoke test passes in production and `yarn dev`, logout 20/20 |
| PR 2 (SH-02) | Tailwind 3.4 + 30 shadcn components next to antd; one real screen converted | antd pages pixel-identical; all 18 component checks pass; smoke test passes |

## Calendar

Thanksgiving is Thu Nov 26. These dates assume nobody works Wed afternoon Nov 25 through Sun Nov 29.

| Date | Milestone | antd files left |
|---|---|---|
| Tue Nov 17 | SH-01 merged by noon. SH-02 merged by end of day. SH-03 opened. | 60 |
| Wed Nov 18 | SH-03 merged. Every area owner has merged a first PR. | 55 |
| Fri Nov 20 | Checkpoint: half the files converted. | ≤ 30 |
| Tue Nov 24 | Every area and pool ticket merged. | 0 |
| Wed Nov 25 (AM) | Buffer for anything that slipped | 0 |
| Mon Nov 30 | SH-12: antd removed | — |
| Tue Dec 1 | SH-13: sign-off | — |

Post the number of antd files left in the team chat each evening. Get it with:

```bash
grep -rlE 'from "antd|@ant-design/icons' packages/app/components packages/app/pages | wc -l
```

## Who does what

| | Core tickets | Then |
|---|---|---|
| **K** (Kunal) | SH-02 setup → SH-07 Nav, common, pages, About (13 files) | Reviews any `components/ui` change. SH-12 removes antd. |
| **I** (Ikwo) | SH-01 PR 1 → SH-05 Queue, student side (10 files) | Pool |
| **D** (Dev) | SH-04 Settings (11 files; the profile form is already done as the example) | Pool if ahead |
| **J** (Justin) | SH-03 Cypress safety net → SH-06 Queue, TA side (10 files) | SH-08 (Cypress-heavy), SH-13 sign-off |

**Pool tickets:** whoever finishes their core ticket takes the next one. Put your initial on the card first, so two people never take the same one.

- SH-08: Today check-in flow (J preferred)
- SH-09: Today display
- SH-10: Apply
- SH-11: Insights + Schedule

If you're behind on Mon Nov 23, post the files you haven't started. Anyone free takes them.

Estimated hours, including reviews: K ~23, I ~18 + pool, D ~25, J ~25. The pool is ~25 h. That's about 3 hours a day each, over 8–9 working days.

## Rules that keep reviews fast

1. **Small PRs.** One PR is at most about 5 files or 400 changed lines (not counting `yarn.lock`). A ticket is several PRs. Small PRs get reviewed in minutes.
2. **Don't touch shared files.**
   - `packages/app/components/ui/` belongs to K. If you need a change there, ask K.
   - Only SH-01, SH-02 and SH-12 change `package.json` or `yarn.lock`.
   - Only delete CSS that targets antd (`.ant-…`) when it belongs to a component you converted.
3. **Keep every `data-cy` attribute.** Cypress uses them, so moving a `data-cy` from the antd element to the shadcn element is the most important thing to get right. Count them before and after (step 6 in the PR checklist).
4. **Same behavior, close look.** Converting doesn't mean redesigning. Keep the text, the order of things and what each click does. Small spacing differences are fine.
5. **Reviewers.**
   - Pairs: I ↔ D and J ↔ K. SH-01 is reviewed by J (D if J is busy). SH-02 is reviewed by I.
   - **Review within 4 working hours.** If your partner can't, anyone else can.
6. **Only block a PR for the checklist below.** Everything else is a non-blocking "nit:" comment: approve, and the author fixes it in their next PR or ignores it.
7. **The author merges** as soon as it's approved (**Squash and merge**), deletes the branch and posts "SH-xx part n merged" in the chat.
8. **CI:** lint, typescript and test must be green. After SH-03 merges, Cypress must be green too. Before then, it must not get worse than 21/31.

### Reviewer checklist (5–15 minutes)

Block only if one of these fails:

- [ ] CI is green, as described in rule 8.
- [ ] The PR only touches its ticket's files, plus the Cypress tests for those files.
- [ ] The pasted `grep` output shows no `antd` or `@ant-design/icons` imports left in the changed files.
- [ ] The `data-cy` count is the same before and after.
- [ ] There are before/after screenshots, and they look close.
- [ ] No `package.json`, `yarn.lock` or `components/ui` changes (except in SH-01, SH-02 and SH-12).

## Every PR, step by step

```bash
cd ~/CS6966/Khoury_OH_App_Repo/office-hours-practicum   # your clone
git checkout dev && git pull
yarn install --frozen-lockfile        # only needed when package.json changed on dev
git checkout -b sh-05-queue-student-1 # ticket number + part

# convert the files (see CONVERSION-GUIDE.md), then:
yarn dev                               # click through what you changed, as all 3 roles if relevant
yarn tsc && yarn lint                  # 0 errors

# paste these two outputs into the PR description:
grep -nE 'from "antd|@ant-design/icons' <your files>     # must print nothing
git diff dev --stat                                       # the file list

# data-cy count (both numbers must match):
git diff dev -- <your files> | grep -c '^-.*data-cy'
git diff dev -- <your files> | grep -c '^+.*data-cy'

git add <your files>
git commit -m "SH-05: convert StudentBanner and StudentQueue to shadcn"
git push -u origin sh-05-queue-student-1
```

Open the PR on GitHub. The **base repository must be `justinpak13/office-hours-practicum`** and the **base branch `dev`**. Add your reviewer and the before/after screenshots.

If `dev` moved while you worked: `git fetch origin && git rebase origin/dev`, then push with `git push --force-with-lease`.

The pre-commit hook runs Prettier and ESLint on your files. Let it; don't use `--no-verify` for migration PRs.

## The smoke test (11 steps; run before SH-12 and SH-13, and after any risky PR)

1. Open http://localhost:3000/dev and click **Seed Data**.
2. Log in as the TA (user 3). Open a queue and click **Check In**.
3. In a private window, log in as the student (user 1). Join the queue: **Join Queue** → pick **Concept** → type a question → **Finish**.
4. The TA sees the student **without refreshing**.
5. The TA clicks the student, then the help button (tooltip "Help Student"), then the finish button (tooltip "Finish Helping").
6. The student's question disappears.
7. Log in as the professor (user 5). The check-in calendar on the course admin panel shows events.
8. The Schedule page shows a calendar.
9. In Settings, change your first name and click **Save**. A success message appears, and the name is still there after a reload.
10. The Insights page loads with charts.
11. Click your avatar (top right) → **Logout**. The login page says "You are currently not logged in".

## Files in this folder

- `CONVERSION-GUIDE.md`: antd → shadcn for every component this app uses, with code.
- `ui-examples.tsx`: working code for all 30 shadcn components. It's the test page we used; copy from it.
- `tickets/SH-01.md` … `SH-13.md`: the tickets.
- `notion-shadcn.csv`: import into the Notion board (merge, like last time).
