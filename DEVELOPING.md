## Installation

### Prerequisites

| Tool | Version |
|---|---|
| [Node](https://nodejs.org/en/download/) | 22.x (run `nvm use` in the repo root; [nvm](https://github.com/nvm-sh/nvm) reads `.nvmrc`) |
| [Yarn](https://classic.yarnpkg.com/en/docs/install) | 1.x. Yarn 2+ does not work with this repo |
| [Docker](https://docs.docker.com/get-docker/) | Runs Postgres 11.5 and Redis for development |

### Setup

1. Run `yarn install --frozen-lockfile` in this directory.
2. Create `packages/server/.env.development`:

   ```ini
   DB_URL=postgres://postgres@localhost:5432/dev
   DOMAIN=http://localhost:3000
   JWT_SECRET=dev-only-not-a-secret
   UPLOAD_LOCATION=uploads
   # Generate with: npx web-push generate-vapid-keys
   PUBLICKEY=<vapid public key>
   PRIVATEKEY=<vapid private key>
   EMAIL=mailto:you@example.com
   ADMIN_SESSION_SECRET=dev-only-not-a-secret
   ```

   This file is not committed. Use your own VAPID keypair here, not the test keypair in `.env.test` (see [Testing](#testing)).

   > **Note:** If the database has problems from a prior run, you may need the newer migration commands:
   > `yarn migration:generate migration/Name` (instead of `yarn migration:generate -n Name`) and
   > `yarn migration:run` (instead of `yarn typeorm migration:run`).

3. Create the uploads folder: `mkdir packages/server/uploads`.
4. Run `yarn dev:db:up` to start Postgres and Redis in Docker. `yarn dev:db:down` stops them. The Postgres container creates the `dev` and `test` databases on first start.
5. Run `yarn dev`, then open http://localhost:3000.
6. Open http://localhost:3000/dev. **Seed Data** deletes all data in the dev database and loads test data (course CS 2500 with queues and questions). Then log in as one of the test users:

   | User ID | Role |
   |---|---|
   | 1, 2 | Student |
   | 3, 4 | TA |
   | 5 | Professor |
   | 6 | User with no courses |

7. For the admin panel, run `yarn cli create:admin <username>` and log in at http://localhost:3000/admin.

In production, users log in through the Khoury Admin Portal, which sends the user and their courses to `POST /api/v1/khoury_login`. The `/dev` page and `/api/v1/login/dev` only work when `DOMAIN` is not the production URL.

### Ports

These are hardcoded.

| Port | Service |
|---|---|
| 3000 | Dev proxy (`infrastructure/dev/devProxy.js`), which serves the app and the API on one origin |
| 3001 | Next.js |
| 3002 | NestJS API |
| 5432 | Postgres |
| 6379 | Redis |

### Server environment variables

The server loads `packages/server/.env`, then `packages/server/.env.development` when `NODE_ENV` isn't `production`. Tests do not read either file; they use `packages/server/.env.test` (see [Testing](#testing)).

| Variable | Used for |
|---|---|
| `NODE_ENV` | `production` turns off TypeORM `synchronize`, skips `.env.development`, and turns on the Admin Portal signature check |
| `DOMAIN` | Base URL for redirects. An `https://` value makes the auth cookie `secure`. The app treats itself as production only when this is `https://officehours.khoury.northeastern.edu` |
| `DB_URL` | Postgres connection string |
| `JWT_SECRET` | Signs the `auth_token` cookie |
| `PUBLICKEY`, `PRIVATEKEY`, `EMAIL` | VAPID keypair and contact (`mailto:` or `https:` URL) for web push. The server does not start without them |
| `UPLOAD_LOCATION` | Folder for profile photos and course calendar files, relative to `packages/server` |
| `ADMIN_SESSION_SECRET` | Signs admin panel sessions |
| `KHOURY_HMAC_KEY` | Verifies the `X-Signature` header on `POST /api/v1/khoury_login` (production only) |
| `SENTRY_APM_DSN`, `SERVICE_VERSION` | Optional Sentry setup |

**When you add a required variable**, add it to your `.env.development`, to this table, and to `packages/server/.env.test` with a test-only value. Otherwise tests will pass on machines that have the variable and fail in CI.

## Technologies

- [Next.js](https://nextjs.org/docs/getting-started) lets us do server-side and client-side React rendering, as well as write backend API endpoints (we don't use this for KOH).
  It also gives us developer ergonomics like hot reload in dev.

- [nestjs](https://nestjs.com/) runs our backend http api. It gives us controllers and services and helps neaten the code

- [Typescript](https://www.typescriptlang.org/docs/home.html) lets us write maintainable, scalable Javascript

- [Postgresql](https://www.postgresql.org/docs/11/index.html) is a very reliable and popular SQL database that is great for 99% of applications

- [TypeORM](https://typeorm.io/) lets us query Postgres easily and with Typescript validating our schema.

- [Docker](https://www.docker.com/products/docker-desktop) sets up a consistent Postgres + Redis environment on all developer's machines

- [Redis](https://redis.io/) passes live-update (Server-Sent Events) messages between API instances, holds locks for the scheduled jobs, and stores admin panel sessions

- [Cypress](https://www.cypress.io/) is used for frontend E2E tests

## File Structure

Source code is in the `packages` folder.

`app` is the next.js app (frontend). Routing is done using the file system. For example, the page `/app/pages/xyz.tsx` would be served at `domain.com/xyz`. Pages are rendered server-side and hydrated client side. Data fetching can happen on the server or client. [Learn more](https://nextjs.org/docs/basic-features/data-fetching)

`server` is the server (backend) that runs the REST API and the Server-Sent Events stream for live queue updates. Each API route is controlled by a module, with a controller and its modules. [Learn more](https://nestjs.com/)

`api-client` is a library to wrap network calls to the api in a neater, **type-safe** interface. Every backend route should be accessible through `api-client`

`common` is where common code, globals, and types go. It is imported into the other three packages.

The `infrastructure` folder is for docker and other deployment files. You can mostly ignore it.

## Developing

Run `yarn dev` at root level to get everything running and hot-reloading. `yarn test` at root level runs the server's unit and integration tests; you can also run `yarn test` inside `packages/server`. Be sure to have the db running with `yarn dev:db:up` before running dev or tests.

Your IDE should do type-checking for you. You can run type-checks manually with `yarn tsc`. The server build (`nest build --webpack`) transpiles without type-checking, so type errors do not fail `yarn build`. `yarn lint` runs eslint.

`yarn cli <command>` runs the server's CLI commands (`create:admin`, `heatmap:generate`, `semester_insights:generate`, `semester:toggleActiveSemester`, and one-off `backfill:*` commands). It starts the full server module, so TypeORM `synchronize` is on unless `NODE_ENV=production` is set.

## Migrations

In development TypeORM `synchronize` is on, so entity changes are applied to the dev database when the server starts. In production it is off, and schema changes are applied with `yarn typeorm migration:run`.

After changing an entity, run `yarn migration:generate -n [migration-name]` and commit the file it writes to `packages/server/migration/`. The script runs `typeorm schema:drop` and `migration:run` against the `DB_URL` database before generating. The TypeORM CLI reads `DB_URL` from `packages/server/.env` only, and defaults to `postgres://postgres@localhost:5432/dev`.

### Adding an API Route

1. Add its request body and response types in `common`
2. Add routes to the NestJS server in `server` (using the `common` types) (to do this, read the NestJS docs, or refer to the wiki written in the future :P )
3. Add client functions in `api-client` calling the endpoint (using the `common` types)

### Adding to the frontend app

Every component in `pages` is served publicly. See https://nextjs.org/docs/routing/introduction. Break pages down into components and add to `components` folder.
Each page should have the `Navbar` up top -- refer to other pages for each page. Consistency, consistency, consistency.

### Testing

Server unit tests (`*.spec.ts`) are colocated with the file they test. Server integration tests are in `packages/server/test/` (`*.integration.ts`). Both use the `test` database on `localhost:5432` and reset its schema on each run. The frontend has no unit tests.

#### Test configuration

Tests read their environment from **`packages/server/.env.test`**, which is committed to the repo. It holds test-only values (including a throwaway VAPID keypair) so tests run the same way on every machine and in CI, without needing `.env.development` or repository secrets.

- Never put real or production secrets in `.env.test`, and never reuse its keys or secrets in `.env.development` or production.
- Keep the file named `.env.test`. The server only loads `.env` and `.env.development`, so these values can never reach a running server.
- The test database connection is hard-coded in `TestTypeOrmModule` (`packages/server/test/util/`), so `DB_URL` is not needed in `.env.test`.

#### Writing server tests

- **Close what you open.** Every spec that creates a Nest testing module should close it in `afterAll` with `await module?.close()` (or `await app?.close()` for integration tests). This closes the database connections; a spec that skips it can leave Jest hanging with "Jest did not exit one second after the test run has completed."
- **Mock services you aren't testing.** `NotificationService` configures web push in its constructor. In specs that only depend on it (for example `question.service.spec.ts`), override it with `.overrideProvider(NotificationService).useValue({ notifyUser: jest.fn() })`. Integration tests can use `modifyMockNotifs` from `test/util/testUtils.ts`.
- **Don't import app-level files into tests.** Importing `src/bootstrap.ts` or `AppModule` pulls in the real TypeORM config and registers a second data source. Shared app setup that tests need, like `addGlobalsToApp`, lives in `src/app-globals.ts`.
- **New entities** must be registered in `TestTypeOrmModule`'s `entities` list, or tests that touch them fail with a "No metadata" error.
- **Avoid parallel queries on one connection.** Inside a transaction, run queries one after another instead of with `Promise.all`. Saving many entities in a single `save([...])` call can also trigger a `pg` deprecation warning ("Calling client.query() when the client is already executing a query"); in test helpers, saving them one at a time avoids it.

#### Debugging test failures

- If you see "You are trying to `import` a file after the Jest environment has been torn down", look further up the output for the first real error. It usually means test setup failed (missing config, database unreachable) while TypeORM was still initializing.
- `npx jest --runInBand` runs test files one at a time so warnings and errors appear under the file that caused them. Add `NODE_OPTIONS=--trace-deprecation` to get stack traces for deprecation warnings.
- `npx jest --detectOpenHandles` shows what is keeping Jest from exiting.

#### Continuous integration

`.github/workflows/test.yml` runs `yarn test` on every pull request with Node 20, using Postgres 11.5 and Redis as service containers. It needs no repository secrets, because test configuration comes from `.env.test`, so pull requests from forks work too. If tests start failing only in CI, check first for a variable that exists in your `.env.development` but is missing from `.env.test`.

#### End to end tests

End to end (E2E) tests are in the `cypress` folder and run against http://localhost:3000, so `yarn dev` has to be running. They use the `/api/v1/seeds/*` and `/api/v1/login/dev` endpoints.
To run them headlessly, do `yarn cypress:run`. To watch them run interactively, use `yarn cypress:open`.

### Installing new packages

Install packages from `cd` into the project you want to install the package for, then run `yarn add <PACKAGE>`. For instance, if you want to install a frontend
package, `cd packages/app` and then `yarn add <FRONTEND PACKAGE>`

## Style

[Prettier](https://prettier.io/), a highly opinionated code formatter, and eslint (`--fix`) run on staged files right before you commit to git (husky + lint-staged). So don't worry about formatting your code! You can also get the Prettier extension in most IDEs, or run `yarn pretty-quick` if you want to.

# Production

Production runs on a Khoury VM: nginx in front of Next.js (port 3001) and the API (port 3002), each run as two pm2 instances from `infrastructure/prod/ecosystem.config.js`, with Postgres and Redis on the same machine. `infrastructure/prod/README.md` describes an older Ubuntu setup.

On the VM, admin accounts are created with `yarn cli create:admin <name>`.
