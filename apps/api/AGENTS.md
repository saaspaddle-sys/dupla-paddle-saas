# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Repo-wide context (product, tenancy invariant, team workflow, monorepo rules, CI shape) lives in the root `CLAUDE.md` — it applies here too and is not repeated. This file covers only `apps/api`.

## State of the code

`src/` is the untouched NestJS scaffold: `AppModule` → `AppController`/`AppService` returning `"Hello World!"`, and `main.ts` doing nothing but `NestFactory.create` + `listen(process.env.PORT ?? 3000)`. Nothing in `docs/decisions.md` is built yet.

Concretely, none of this exists — check before importing, and create it as part of the feature that first needs it:

- **Prisma** — no `prisma/schema.prisma`, no `PrismaService`, `@prisma/client` is not a dependency.
- **Auth** — no Passport, no JWT, no guards, no `@nestjs/passport`/`@nestjs/jwt`.
- **Validation** — `class-validator`/`class-transformer` are not installed and `main.ts` registers **no global `ValidationPipe`**. DTO decorators alone will silently do nothing until both are added; the first feature with a request body has to wire the pipe.
- **Config** — no `@nestjs/config`, no `.env` loading. Env vars are read off `process.env` directly.
- **Error shape** — no exception filter. The API-wide consistent error shape the specs assume still has to be established by whoever gets there first.

Delete the `app.*` scaffold files as real modules replace them rather than building around them; `app.controller.spec.ts` and `test/app.e2e-spec.ts` assert the `"Hello World!"` response and will need to go with them.

## Commands

Run from the repo root (pnpm workspace, single lockfile):

```bash
pnpm run start:dev                      # watch mode — the primary dev loop (port 3000)
pnpm --filter api run start:debug       # same, with the Node inspector attached
pnpm --filter api run build             # nest build → dist/ (deletes outDir first)

pnpm --filter api run test               # unit tests
pnpm --filter api run test -- src/app.controller.spec.ts   # a single file
pnpm --filter api run test -- -t "should return"           # by test name
pnpm --filter api run test:e2e           # e2e tests (separate Jest config)
pnpm --filter api run test:cov           # coverage → apps/api/coverage/

pnpm --filter api exec eslint "{src,test}/**/*.ts" --max-warnings 0   # exactly what CI lints
```

## Two Jest setups

- **Unit** — `*.spec.ts` colocated in `src/`. Config is inline in `package.json` with `rootDir: src`, so `pnpm run test` cannot see `test/`.
- **E2E** — `*.e2e-spec.ts` in `test/`, run via `test/jest-e2e.json` (`rootDir: .`). These boot the **whole** `AppModule` through `@nestjs/testing` + supertest.

The e2e coupling to the real `AppModule` is the thing to plan for: anything you import into `AppModule` (Prisma, config, auth) must be able to start under e2e. Adding Prisma means the e2e suite needs a reachable database or an overridden provider, and CI runs `test:e2e` on every PR with no database service defined in `.github/workflows/ci.yml`.

## Lint: local vs CI

`pnpm --filter api run lint` runs `eslint --fix` with warnings allowed. CI runs the same files with `--max-warnings 0` and no `--fix`. So a clean local lint can still fail the `api` check — reproduce CI with the last command above before pushing.

This bites on the two rules configured as warnings in `eslint.config.mjs`, which are CI failures in practice: `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-unsafe-argument`.

The rest of the config worth knowing:

- **Type-aware lint is enabled** (`recommendedTypeChecked` with `projectService`). The `no-unsafe-*` family fires on values typed `any`, which is exactly what untyped request bodies and raw JSON produce. `no-explicit-any` is off, so annotating deliberately is fine; letting `any` flow into a call is what gets flagged.
- **Prettier is an error-level lint rule.** Formatting options live in `.prettierrc` (`singleQuote`, `trailingComma: all`); only `endOfLine: auto` is set on the rule itself in `eslint.config.mjs`, so CRLF checkouts on Windows won't fail CI.

## TypeScript specifics

- **Strictness is laxer than `apps/web`**: `strictNullChecks` is on, but `noImplicitAny` and `strictBindCallApply` are **off**. Don't assume an implicit `any` will be caught by the compiler.
- **No path alias.** `baseUrl` is `./` with no `paths` — imports are relative (`./app.service`), unlike web's `@/*`. `module`/`moduleResolution` are `nodenext`.
- **`emitDecoratorMetadata` is on** and required for Nest DI — constructor injection resolves through it.

## Conventions for new modules

**`docs/api-conventions.md` is the contract reference** — module structure, route shape, DTO rules, error codes, and the three endpoint classes every route must be declared as (club / public / platform). Read it before designing or reviewing an endpoint. It is the single source: don't restate its rules here or in an agent prompt.
