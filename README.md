# dupla

[![CI](https://github.com/saaspaddle-sys/dupla-paddle-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/saaspaddle-sys/dupla-paddle-saas/actions/workflows/ci.yml)

SaaS de torneos de pádel para clubes: torneos, llaves automáticas, resultados y vista pública gratuita para jugadores.

> **Estado**: en desarrollo activo, sin release todavía. Las decisiones técnicas están tomadas pero la mayoría no está implementada — ambos paquetes siguen siendo su scaffold de fábrica. El alcance de la fase 1 está en [`docs/product-brief.md`](docs/product-brief.md).

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
pnpm install         # desde la raíz — hay un solo lockfile

pnpm run start:dev   # API con hot-reload (:3000)
pnpm run dev:web     # frontend (:3001)

pnpm run build       # build de todos los packages
pnpm run lint        # lint de todos los packages
pnpm run test        # tests unitarios
pnpm run test:e2e    # tests e2e de la API
```

Los comandos específicos de cada paquete (un solo archivo de test, modo debug, coverage) están en el `AGENTS.md` correspondiente.

## Documentación

| Documento                                            | Qué cubre                                         |
| ---------------------------------------------------- | ------------------------------------------------- |
| [`docs/product-brief.md`](docs/product-brief.md)     | Producto, modelo de negocio y alcance por fase    |
| [`docs/decisions.md`](docs/decisions.md)             | Decisiones técnicas, una entrada por decisión     |
| [`docs/workflow.md`](docs/workflow.md)               | Branches, PRs y checks de CI                      |
| [`docs/api-conventions.md`](docs/api-conventions.md) | Contrato de la API: rutas, DTOs, códigos de error |
| [`docs/agents.md`](docs/agents.md)                   | Agentes de IA del equipo y cómo usarlos           |

El contexto para asistentes de IA vive en `CLAUDE.md` en la raíz y en un `AGENTS.md` por paquete.

## Contribuir

Una branch por tarea (`feat/`, `fix/`, `chore/`), PR hacia `main` con squash merge, los checks `api` y `web` en verde. Nunca commitear directo a `main`. Detalle completo en [`docs/workflow.md`](docs/workflow.md).

## Licencia

Software propietario. Todos los derechos reservados.
