# Decisiones técnicas — dupla

Una entrada por decisión, la más nueva arriba de su tema. Las entradas no se editan ni se borran: si una decisión se revierte, se agrega una entrada nueva que la reemplaza y se linkea a la vieja.

## 2026-07-20 — Una sola rama de larga vida: `main`

**Contexto**: se había creado una rama `develop` como punto de integración entre los dos devs. El repo ya usa `main` protegida como default y **squash merge** en todos los PRs, y el hosting está diferido — no hay deploy productivo.
**Decisión**: no se usa una rama `develop` intermedia. `main` es la única rama de larga vida; las ramas de tarea (`feat/`, `fix/`, `chore/`) salen de `main` y vuelven a `main` por PR. La `develop` existente se borra (no tenía commits propios: `git diff main develop` daba vacío).
**Consecuencias**: lo que habilita el trabajo en paralelo son las ramas cortas, el PR con CI y la aprobación cruzada — no la rama de integración, que sirve para separar "mergeado" de "deployado" y hoy no habría nada que separar. Además una rama de larga vida choca con el squash merge: el squash reescribe los SHAs, así que `develop` y `main` nunca comparten historia real y aparecen divergidas aunque el contenido sea idéntico (ya pasó con el PR #5/#6). Si en algún momento hace falta separar producción de desarrollo, se reevalúa junto con la estrategia de merge — la conversación va a ser squash vs. merge commits, no solo la rama. El ciclo operativo está en [git-guide.md](./git-guide.md).

## 2026-07-20 — `AGENTS.md` por paquete y convenciones en `docs/`

**Contexto**: el equipo usa herramientas distintas (Claude Code y Cursor). El contexto del proyecto estaba en archivos `CLAUDE.md`, que solo lee una de las dos, y las convenciones de API vivían dentro de `.claude/agents/api-designer.md` — inalcanzables para el resto.
**Decisión**: el archivo real de contexto de cada paquete es `AGENTS.md`, con un `CLAUDE.md` de una línea (`@AGENTS.md`) al lado para que cualquiera de los dos nombres resuelva al mismo contenido. Las convenciones compartidas salen de los agentes a `docs/` (`docs/api-conventions.md` es la primera); `.claude/agents/` queda con rol, herramientas y formato de salida, referenciando esos docs.
**Consecuencias**: una sola fuente por regla, sin copias divergiendo entre agentes y docs. La capa que **no** es portable es el allowlist de herramientas: en Claude Code `code-reviewer` y `api-designer` no pueden editar archivos, y en otra herramienta eso es una instrucción, no una garantía — el backstop es leer el `git diff` antes de commitear. Guía de uso en `docs/agents.md`.

## 2026-07-16 — Monorepo con Next.js para el frontend

**Contexto**: el frontend iba a vivir en un repo separado (`dupla-saas-client`), que quedó vacío antes de arrancar. El contrato API↔frontend en un solo PR, los docs/agentes compartidos y los tipos compartibles pesan más que el aislamiento de repos para un equipo chico.
**Decisión**: monorepo con pnpm workspaces — `apps/api` (NestJS) y `apps/web` (Next.js 16, App Router, Tailwind v4). Next.js y no una SPA porque la vista pública de torneos necesita SSR/SEO. El repo `dupla-saas-client` se archiva.
**Consecuencias**: un solo lockfile en la raíz; CI con un job por app; en dev la API corre en :3000 y el frontend en :3001.

## 2026-07-16 — Tenancy: el club es el tenant

**Contexto**: SaaS B2B — pagan los clubes; los jugadores no tienen cuenta en fase 1.
**Decisión**: toda entidad de negocio del club (torneos, canchas, inscripciones) lleva `club_id` indexado. Los usuarios del sistema son el staff de los clubes.
**Consecuencias**: los guards y las queries de endpoints del club filtran siempre por el `club_id` del usuario autenticado — nunca por un `club_id` que venga del request sin verificar. La vista pública es read-only y sin auth.

## 2026-07-16 — Jugadores como perfiles globales

**Contexto**: los jugadores rotan entre clubes; se quiere habilitar historial y rankings cross-club como diferencial futuro.
**Decisión**: `Player` es una entidad de plataforma, **sin** `club_id`. Su vínculo con clubes es vía inscripciones a torneos.
**Consecuencias**: hay que resolver duplicados al cargar jugadores (búsqueda/match antes de crear). Quién puede editar un perfil global queda por definir en fase 2, cuando exista la inscripción online.

## 2026-07-16 — PostgreSQL + Prisma

**Decisión**: PostgreSQL como única base de datos. Prisma como ORM: schema declarativo en `prisma/schema.prisma`, migraciones con `prisma migrate`.
**Consecuencias**: Prisma no genera migraciones de reversa — revertir un cambio es una nueva migración hacia adelante. El `PrismaService` se inyecta vía DI de Nest como cualquier provider.

## 2026-07-16 — Auth propia: Passport + JWT

**Contexto**: los usuarios de fase 1 son staff de clubes — pocos, sin necesidad de social login ni SSO.
**Decisión**: autenticación propia con Passport + JWT (el camino estándar de Nest). Sin proveedor externo.
**Consecuencias**: sin costo por usuario ni dependencia de terceros. La identidad de jugadores (fase 2, inscripción online) se diseñará sobre esta misma base.

## 2026-07-16 — Cobro manual, pasarela diferida

**Decisión**: sin integración de pagos en el MVP. Clubes se activan a mano. Cuando se valide el producto, la pasarela es Mercado Pago (mercado inicial: Argentina).

## 2026-07-16 — Hosting: pendiente

**Estado**: decisión diferida a propósito hasta acercarse al primer deploy. No bloquea el desarrollo.
