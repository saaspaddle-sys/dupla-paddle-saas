# dupla

[![CI](https://github.com/saaspaddle-sys/dupla-paddle-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/saaspaddle-sys/dupla-paddle-saas/actions/workflows/ci.yml)

SaaS de torneos de pádel para clubes: torneos, llaves automáticas, resultados y vista pública gratuita para jugadores.

> **Estado**: en desarrollo activo. La API ya cuenta con autenticación, tenancy, torneos, duplas y operaciones de la llave; esto no implica que toda la fase 1 esté entregada. El alcance objetivo está en [el brief](docs/product-brief.md) y el detalle de implementación en [el contexto de API](apps/api/AGENTS.md) y [la documentación web](apps/web/docs/README.md).

## Stack

NestJS 11 · Next.js 16 (App Router, Tailwind v4) · PostgreSQL + Prisma · Passport + JWT · monorepo pnpm

El porqué de cada elección está en [`docs/decisions.md`](docs/decisions.md).

## Estructura

- `apps/api` — backend NestJS (puerto 3000)
- `apps/web` — frontend Next.js (puerto 3001 en dev)
- `docs/` — producto, decisiones técnicas y convenciones de API

## Requisitos

- **Node 24** (es la versión que usa la CI)
- **pnpm 11.1.1** — está fijado en `packageManager`; habilitalo con `corepack enable`

## Desarrollo

```bash
pnpm install          # desde la raíz — hay un solo lockfile
cp .env.example .env  # DATABASE_URL y JWT_SECRET para desarrollo
pnpm run db:up        # levanta solo Postgres
pnpm run db:migrate   # aplica las migraciones de Prisma

pnpm run start:dev   # API con hot-reload (:3000)
pnpm run dev:web     # frontend (:3001)

pnpm run build       # build de todos los packages
pnpm run lint        # lint de todos los packages
pnpm run test        # tests unitarios
pnpm run test:e2e    # tests e2e de la API
```

Los comandos específicos de cada paquete (un solo archivo de test, modo debug, coverage) están en el `AGENTS.md` correspondiente. Detalle de la base de datos (Postgres, Prisma, migraciones) en [`docs/database.md`](docs/database.md).

## Documentación

Comenzar por el [índice de documentación](docs/README.md): distingue referencias vigentes, alcance planificado e historia.

| Documento                                            | Qué cubre                                         |
| ---------------------------------------------------- | ------------------------------------------------- |
| [`docs/product-brief.md`](docs/product-brief.md)     | Producto, modelo de negocio y alcance por fase    |
| [`docs/decisions.md`](docs/decisions.md)             | Decisiones técnicas, una entrada por decisión     |
| [`docs/database.md`](docs/database.md)               | Postgres local, config de Prisma y migraciones    |
| [`docs/workflow.md`](docs/workflow.md)               | Branches, PRs y checks de CI — las reglas         |
| [`docs/git-guide.md`](docs/git-guide.md)             | Guía paso a paso de git y GitHub — los comandos   |
| [`docs/api-conventions.md`](docs/api-conventions.md) | Contrato de la API: rutas, DTOs, códigos de error |
| [`docs/agents.md`](docs/agents.md)                   | Agentes de IA del equipo y cómo usarlos           |

El contexto para asistentes de IA vive en `CLAUDE.md` en la raíz y en un `AGENTS.md` por paquete.

## Contribuir

Una branch por tarea (`feat/`, `fix/`, `chore/`), PR hacia `main` con squash merge, los checks `api`, `web` y `format` en verde. Nunca commitear directo a `main`. Detalle completo en [`docs/workflow.md`](docs/workflow.md).

## Licencia

Software propietario. Todos los derechos reservados.
