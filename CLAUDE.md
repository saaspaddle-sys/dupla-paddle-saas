# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product context

dupla is the API for a SaaS where paddle clubs run tournaments: auto-generated brackets, results tracking, and a free public (no-login) view for players. Clubs are the paying tenant (their staff are the authenticated users); player profiles are platform-global, linked to clubs only through tournament inscriptions. Before designing or implementing a feature, read `docs/product-brief.md` (scope and phasing) and `docs/decisions.md` (technical decisions: PostgreSQL + Prisma, Passport + JWT auth, club-as-tenant).

## Package manager

Use **pnpm** (not npm/yarn) — the repo has `pnpm-lock.yaml` and a `pnpm-workspace.yaml`. Install with `pnpm install`.

## Commands

```bash
pnpm run start:dev      # run with watch/hot-reload (primary dev loop)
pnpm run start:debug    # watch + Node inspector
pnpm run start:prod     # run compiled output (node dist/main)
pnpm run build          # nest build -> dist/
pnpm run lint           # eslint --fix over {src,apps,libs,test}
pnpm run format         # prettier --write over src/ and test/

pnpm run test           # unit tests (Jest)
pnpm run test:watch     # unit tests in watch mode
pnpm run test:cov       # unit tests with coverage -> coverage/
pnpm run test:e2e       # e2e tests (separate config: test/jest-e2e.json)

# Run a single unit test file or by name:
pnpm run test -- src/app.controller.spec.ts
pnpm run test -- -t "should return"
```

## Testing layout

Two distinct Jest setups:
- **Unit tests**: `*.spec.ts` colocated next to source in `src/`. Config is inline in `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`).
- **E2E tests**: `*.e2e-spec.ts` in `test/`, run via `test/jest-e2e.json` (`rootDir: .`). E2E boots the full Nest app with `@nestjs/testing` + supertest.

## Architecture

Standard NestJS application. Entry point `src/main.ts` bootstraps `AppModule` and listens on `process.env.PORT ?? 3000`. Composition is module-based: providers (`@Injectable` services) are declared in a module's `providers` and injected via constructor DI; HTTP handlers live in `@Controller` classes registered in a module's `controllers`.

This is currently a bare scaffold — a single root `AppModule` wiring `AppController` + `AppService`. As features are added, create a feature module per domain (`nest g module <name>`, `nest g controller <name>`, `nest g service <name>`) and import it into `AppModule`.

## TypeScript notes

`tsconfig.json` uses `module`/`moduleResolution: nodenext`. `strictNullChecks` is on but `noImplicitAny` and `strictBindCallApply` are off. Decorator metadata is enabled (required for Nest DI).
