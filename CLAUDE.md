# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product context

dupla is a SaaS where paddle clubs run tournaments: auto-generated brackets, results tracking, and a free public (no-login) view for players. Clubs are the paying tenant (their staff are the authenticated users); player profiles are platform-global, linked to clubs only through tournament inscriptions. Before designing or implementing a feature, read `docs/product-brief.md` (scope and phasing) and `docs/decisions.md` (technical decisions: PostgreSQL + Prisma, Passport + JWT auth, club-as-tenant, monorepo).

## Monorepo layout

pnpm workspace with a single lockfile at the root. Packages live in `apps/*`:

- `apps/api` — NestJS backend (port 3000)
- `apps/web` — Next.js 16 frontend, App Router + Tailwind v4 (port 3001 in dev). **Read `apps/web/AGENTS.md` before writing Next.js code** — Next 16 conventions differ from older versions.

Run everything from the repo root with `pnpm --filter <package>`, or use the root shortcuts below.

## Package manager

Use **pnpm** (not npm/yarn) — `packageManager` is pinned in the root `package.json`. Install with `pnpm install` from the root; never install inside a package with npm/yarn.

## Commands

```bash
# Root shortcuts
pnpm run start:dev      # API with watch/hot-reload (primary dev loop)
pnpm run dev:web        # Next.js dev server
pnpm run build          # build every package
pnpm run lint           # lint every package
pnpm run test           # unit tests in every package that defines them
pnpm run test:e2e       # API e2e tests

# Per package
pnpm --filter api run start:debug   # API with Node inspector
pnpm --filter web run build         # production build of the frontend

# Run a single API unit test file or by name:
pnpm --filter api run test -- src/app.controller.spec.ts
pnpm --filter api run test -- -t "should return"
```

## Testing layout (api)

Two distinct Jest setups inside `apps/api`:
- **Unit tests**: `*.spec.ts` colocated next to source in `apps/api/src/`. Config is inline in `apps/api/package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`).
- **E2E tests**: `*.e2e-spec.ts` in `apps/api/test/`, run via `apps/api/test/jest-e2e.json` (`rootDir: .`). E2E boots the full Nest app with `@nestjs/testing` + supertest.

`apps/web` has no test setup yet.

## Architecture

`apps/api` is a standard NestJS application. Entry point `src/main.ts` bootstraps `AppModule` and listens on `process.env.PORT ?? 3000`. Composition is module-based: providers (`@Injectable` services) are declared in a module's `providers` and injected via constructor DI; HTTP handlers live in `@Controller` classes registered in a module's `controllers`. As features are added, create a feature module per domain and import it into `AppModule`.

`apps/web` is a fresh create-next-app scaffold (App Router, `src/` dir, Tailwind v4, Turbopack).

## TypeScript notes (api)

`apps/api/tsconfig.json` uses `module`/`moduleResolution: nodenext`. `strictNullChecks` is on but `noImplicitAny` and `strictBindCallApply` are off. Decorator metadata is enabled (required for Nest DI).
