# CLAUDE.md

Este archivo le da contexto a Claude Code (claude.ai/code) para trabajar en este repositorio.

Cubre lo que es válido para todo el monorepo. Las reglas específicas de cada paquete viven al lado del paquete y **no** se repiten acá — leé la que corresponda al paquete que estés tocando:

- `apps/api/AGENTS.md` — NestJS: estado del scaffold, comandos, los dos setups de Jest, detalles de TypeScript/lint.
- `apps/web/AGENTS.md` — Next.js 16: docs incluidas que hay que leer primero, detalles del stack, estado del scaffold.

Ambos paquetes tienen un `CLAUDE.md` de una línea que importa su `AGENTS.md`, así que cualquiera de los dos nombres de archivo resuelve al mismo contenido. `AGENTS.md` es el archivo real: el equipo usa herramientas mixtas (Claude Code y Cursor), y el contexto del paquete tiene que cargar sin importar cuál se use.

## Contexto de producto

dupla es un SaaS donde clubes de pádel organizan torneos: brackets autogenerados, seguimiento de resultados, y una vista pública gratuita para jugadores. Los clubes son el tenant que paga (su staff opera el panel del club como usuarios autenticados del tenant); los perfiles de jugador son globales a la plataforma —el jugador también puede registrarse y loguearse, pero su cuenta es global y no lo hace usuario de ningún club—, y solo se vinculan a los clubes a través de inscripciones a torneos. Antes de diseñar o implementar una feature, leé `docs/product-brief.md` (alcance y fases) y `docs/decisions.md` (decisiones técnicas: PostgreSQL + Prisma, auth con Passport + JWT, club-as-tenant, monorepo).

**Invariante de tenancy** — toda entidad propiedad de un club (torneos, canchas, inscripciones) lleva un `club_id` indexado. Los guards y queries en endpoints de club siempre filtran por el `club_id` del usuario autenticado, **nunca** por un `club_id` tomado del body/params/query del request. `Player` es la excepción: es una entidad global a la plataforma sin `club_id`. La vista pública es de solo lectura y no requiere autenticación.

## Estado actual

Las decisiones en `docs/decisions.md` están tomadas pero en su mayoría no implementadas todavía. Ambos paquetes siguen siendo su scaffold de fábrica — sin Prisma, sin auth, sin módulos de feature, sin entidades de dominio, y nada en el frontend hablando con la API. No asumas que esa infraestructura ya existe: verificá antes de importarla, y creala como parte de la feature que la necesite por primera vez. Los detalles están en el archivo de cada paquete.

## Workflow del equipo

Una branch por tarea (`feat/`, `fix/`, `chore/`), PR hacia `main` protegido con squash merge, los checks de CI `api`, `web` y `format` tienen que estar verdes. Nunca commitear directo a `main`. Los cambios de API + frontend de una misma feature van en un solo PR. Las decisiones técnicas nuevas se agregan a `docs/decisions.md` en el mismo PR. Guía completa: `docs/workflow.md`.

`.claude/agents/` tiene los agentes especializados del equipo, calibrados para este stack: `api-designer` (contratos de endpoints, correrlo antes de implementar una feature), `db-architect` (schema y migraciones), `test-engineer`, `code-reviewer`, `debugger`.

## Estructura del monorepo

Workspace de pnpm con un solo lockfile en la raíz. Los paquetes viven en `apps/*`:

- `apps/api` — backend NestJS 11 (puerto 3000). Composición estándar de Nest: un módulo por dominio de negocio en `src/<domain>/`, importado en `AppModule`; servicios `@Injectable` en `providers` inyectados vía DI por constructor; clases `@Controller` en `controllers`.
- `apps/web` — frontend Next.js 16, App Router + Tailwind v4 (puerto 3001 en dev). **Leé `apps/web/AGENTS.md` antes de escribir código Next.js** — las convenciones de Next 16 difieren de versiones anteriores.

Corré todo desde la raíz del repo con `pnpm --filter <package>`, o usá los atajos de la raíz de abajo.

## Package manager

Usá **pnpm** (no npm/yarn) — el `packageManager` está fijado en el `package.json` raíz. Instalá con `pnpm install` desde la raíz; nunca instales dentro de un paquete con npm/yarn.

## Comandos

```bash
pnpm run start:dev      # API con watch/hot-reload (loop principal de dev)
pnpm run dev:web        # servidor de dev de Next.js
pnpm run build          # build de todos los paquetes
pnpm run lint           # lint de todos los paquetes
pnpm run test           # tests unitarios en cada paquete que los define
pnpm run test:e2e       # tests e2e de la API
```

Cada uno es un wrapper fino de `pnpm -r` / `pnpm --filter`; los comandos específicos de cada paquete (un solo archivo de test, modo debug, coverage, reproducir el lint de CI exactamente) están documentados en el archivo de cada paquete.

## CI

`.github/workflows/ci.yml` corre tres jobs en cada PR, todos en Node 24 con `pnpm install --frozen-lockfile`:

- **api** — lint, build, tests unitarios, tests e2e.
- **web** — lint, build.
- **format** — `prettier --check` sobre todo el repo (config en `.prettierrc` raíz; `apps/api` tiene el suyo, que gana por cercanía).

El paso de lint de `api` **no** corre el script `lint` propio del paquete; ver `apps/api/AGENTS.md` para entender por qué un lint local limpio puede igual fallar en CI.
