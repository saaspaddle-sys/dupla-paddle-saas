# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

It covers what is true across the whole monorepo. Package-specific rules live next to the package and are **not** repeated here — read the one for the package you are touching:

- `apps/api/AGENTS.md` — NestJS: state of the scaffold, commands, the two Jest setups, TypeScript/lint specifics.
- `apps/web/AGENTS.md` — Next.js 16: bundled docs to read first, stack specifics, state of the scaffold.

Both packages keep a one-line `CLAUDE.md` importing their `AGENTS.md`, so either filename resolves to the same content. `AGENTS.md` is the real file: the team runs mixed tooling (Claude Code and Cursor), and package context has to load regardless of which one you use.

## Product context

dupla is a SaaS where paddle clubs run tournaments: auto-generated brackets, results tracking, and a free public view for players. Clubs are the paying tenant (their staff are the authenticated users); player profiles are platform-global, linked to clubs only through tournament inscriptions. Before designing or implementing a feature, read `docs/product-brief.md` (scope and phasing) and `docs/decisions.md` (technical decisions: PostgreSQL + Prisma, Passport + JWT auth, club-as-tenant, monorepo).

**Tenancy invariant** — every club-owned entity (tournaments, courts, inscriptions) carries an indexed `club_id`. Guards and queries on club endpoints always filter by the `club_id` of the authenticated user, **never** by a `club_id` taken from the request body/params/query. `Player` is the exception: it is a platform-global entity with no `club_id`. The public view is read-only and unauthenticated.

## Current state

The decisions in `docs/decisions.md` are committed to but mostly not built yet. Both packages are still their stock scaffolds — no Prisma, no auth, no feature modules, no domain entities, and nothing on the frontend talking to the API. Do not assume any of that infrastructure is available: check before importing it, and create it as part of the feature that first needs it. Each package's own file has the specifics.

## Team workflow

Branch per task (`feat/`, `fix/`, `chore/`), PR into protected `main` with squash merge, CI checks `api` and `web` must be green. Never commit directly to `main`. API + frontend changes for the same feature go in one PR. New technical decisions get an entry in `docs/decisions.md` in the same PR. Full guide: `docs/workflow.md`.

`.claude/agents/` holds the team's specialised agents, calibrated to this stack: `api-designer` (endpoint contracts, run it before implementing a feature), `db-architect` (schema and migrations), `test-engineer`, `code-reviewer`, `debugger`.

## Monorepo layout

pnpm workspace with a single lockfile at the root. Packages live in `apps/*`:

- `apps/api` — NestJS 11 backend (port 3000). Standard Nest composition: one module per business domain in `src/<domain>/`, imported into `AppModule`; `@Injectable` services in `providers` injected via constructor DI; `@Controller` classes in `controllers`.
- `apps/web` — Next.js 16 frontend, App Router + Tailwind v4 (port 3001 in dev). **Read `apps/web/AGENTS.md` before writing Next.js code** — Next 16 conventions differ from older versions.

Run everything from the repo root with `pnpm --filter <package>`, or use the root shortcuts below.

## Package manager

Use **pnpm** (not npm/yarn) — `packageManager` is pinned in the root `package.json`. Install with `pnpm install` from the root; never install inside a package with npm/yarn.

## Commands

```bash
pnpm run start:dev      # API with watch/hot-reload (primary dev loop)
pnpm run dev:web        # Next.js dev server
pnpm run build          # build every package
pnpm run lint           # lint every package
pnpm run test           # unit tests in every package that defines them
pnpm run test:e2e       # API e2e tests
```

Each is a thin `pnpm -r` / `pnpm --filter` wrapper; per-package commands (single test files, debug mode, coverage, reproducing CI lint exactly) are documented in each package's own file.

## CI

`.github/workflows/ci.yml` runs two jobs on every PR, both on Node 24 with `pnpm install --frozen-lockfile`:

- **api** — lint, build, unit tests, e2e tests.
- **web** — lint, build.

The lint step for `api` does **not** run the package's own `lint` script; see `apps/api/AGENTS.md` for why a clean local lint can still fail CI.
