# Decisiones técnicas — dupla

Una entrada por decisión, la más nueva arriba de su tema. Las entradas no se editan ni se borran: si una decisión se revierte, se agrega una entrada nueva que la reemplaza y se linkea a la vieja.

## 2026-07-23 — Modelo de identidad y suscripción: `User`, `Player`, `Club`

**Contexto**: la decisión "los jugadores tienen cuenta desde fase 1" (más abajo, misma fecha) dejó por definir la relación entre el usuario-staff y el `Player`, y dónde vive la suscripción. Se cierra acá.

**Decisión**:

- **Tres entidades.** `User` = identidad de login (email + contraseña), **sin rol propio** — la autenticación es igual para todos. `Player` = perfil global de torneos, **sin `club_id`**, con `userId` opcional (1:1) hacia `User`. `Club` = el tenant (dueño de torneos, canchas, inscripciones; lleva `club_id`).
- **El login no lleva rol.** "Organizador" se deriva de tener/pertenecer a un `Club`; "jugador", de tener un `Player`. La app muestra el dashboard de organizador o el menú de jugador según esas relaciones (se resuelven al loguearse y viajan en el JWT), no según un flag. Un mismo `User` puede ser **ambos** (su `Club` + su `Player`), y un jugador que luego crea un club pasa a organizador sin mutar nada. En el registro sí se elige crear cuenta de organizador (crea `Club`, queda pendiente) o de jugador (crea `Player`); la elección se materializa en esas relaciones.
- **Todo el que se registra tiene contraseña.** Jugador que se registra → `User` + `Player` linkeados. Jugador que carga el organizador → `Player` con `userId = null` (sin login) hasta que esa persona se registre y reclame el perfil (dedup: buscar antes de crear).
- **La suscripción vive en el `User` dueño** (organizador), no en el `Club`. El plan define cuotas de uso (p. ej. cantidad de torneos). Esto revisa el "pagan los clubes" de la decisión de tenancy (2026-07-16): el que paga es la cuenta dueña, no el club en sí.
- **MVP: un club por dueño.** El schema deja `User` → varios `Club`, pero la cuota se capea en 1 en fase 1. Con eso el invariante de tenancy **no cambia**: el `club_id` se sigue derivando de la identidad del usuario autenticado (1 usuario = 1 club), nunca del request. Multi-club es un flip posterior (subir la cuota) que, cuando se active, mueve el `club_id` al request verificado contra los clubes del dueño — se decide entonces, no ahora.

**Consecuencias**: el cobro **manual** (2026-07-16, pasarela diferida) implica que registrarse como organizador crea el `User` dueño + su `Club`, pero la cuenta queda pendiente/inactiva hasta activarla a mano — no hay checkout en el registro. Aparece el concepto de **plan/tier** con cuotas, aunque en fase 1 el único enforcement real es el cap de 1 club y las cuotas de torneos se setean a mano. **Por definir en el schema** (db-architect): cómo se modela la pertenencia `User`↔`Club` (owner vs. staff, de cara al multi-staff futuro), los nombres de tablas/campos, y la migración inicial. (Que un `User` sea organizador y jugador a la vez ya queda resuelto: tiene su `Club` y su `Player`.)

## 2026-07-23 — Los jugadores tienen cuenta desde fase 1

**Contexto**: la decisión de tenancy (2026-07-16) fijó que "los jugadores no tienen cuenta en fase 1", y la de auth (2026-07-16) dejó la identidad de jugadores para fase 2, atada a la inscripción online. La dirección de producto cambió: el jugador se registra e inicia sesión desde el primer release, y el organizador también puede crear el perfil cuando hace falta.

**Decisión**: el jugador es un principal autenticado desde fase 1. Un perfil de `Player` (global, sin `club_id`) nace por dos caminos —auto-registro del jugador o alta por el organizador— y ambos comparten la misma resolución de identidad/duplicados. La auth con Passport + JWT (2026-07-16) pasa a cubrir dos tipos de principal: **staff de club** (usuario del tenant, opera el panel del club) y **jugador** (global, sin tenant, sin acceso a ningún panel de club). Esta entrada reemplaza el "los jugadores no tienen cuenta en fase 1" de la decisión de tenancy (2026-07-16) y adelanta a fase 1 la identidad de jugador que la decisión de auth (2026-07-16) ubicaba en fase 2.

**Consecuencias**: el dedup "buscar antes de crear" corre en dos puntos —el signup del jugador y el alta manual del organizador—, y un auto-registro no debe duplicar un perfil que el club ya cargó, ni al revés. La "inscripción online" (fase 2) deja de estar bloqueada por la identidad de jugador, ya resuelta en fase 1, y queda acotada al flujo de auto-inscribirse a un torneo puntual, distinto de tener cuenta. La invariante de tenancy no se toca: `Player` sigue sin `club_id`, y los guards de endpoints de club siguen filtrando por el `club_id` del staff autenticado, nunca por uno del request; que el jugador tenga cuenta no le da acceso a datos de club más allá de la vista pública. **Por definir en el modelado** (no lo cierra esta decisión): la relación entre el usuario-staff y el `Player` —entidades separadas con auth compartida, o si una misma persona puede ser ambas—, y qué superficie autenticada ve el jugador en fase 1 más allá de su perfil/historial.

## 2026-07-23 — Docker Compose para servicios de desarrollo (fase 1)

**Contexto**: PostgreSQL + Prisma está decidido (2026-07-16) pero sin implementar. Sin una forma común de levantar Postgres, cada dev lo instalaría a mano en su máquina (Windows/macOS), con versiones y config divergentes. Además, la CI corre `test:e2e` sobre el `AppModule` completo sin ninguna base de datos definida en `ci.yml` (ver `apps/api/AGENTS.md`): hoy pasa porque el e2e solo verifica `"Hello World!"`, pero en cuanto Prisma entre a `AppModule` la suite e2e va a necesitar una DB alcanzable y el check `api` empezaría a fallar.

**Decisión**: Docker se usa en fase 1 **solo para los servicios de backing**, no para las apps. Se agrega un `compose.yml` en la raíz con Postgres (versión pinneada, volumen nombrado para persistir datos, healthcheck) y Adminer opcional como GUI, más un `.env.example` con `DATABASE_URL`. Las apps (`apps/api`, `apps/web`) siguen corriendo nativas con `pnpm start:dev` / `dev:web`. En la CI, el job `api` gana un service container de Postgres con la misma versión y credenciales, y un `DATABASE_URL` a nivel de job.

**Consecuencias**: el HMR de Next 16 + Turbopack con bind mounts en Windows se degrada, por eso las apps no se containerizan en dev — Docker cubre lo difícil de reproducir (la DB) y Node nativo cubre lo que Docker empeora (el hot-reload). El service de Postgres en CI es **preparatorio**: mientras el e2e no toque la DB no cambia el resultado del check `api`, pero deja la infra lista para que la PR que introduzca Prisma no rompa la CI por un error de conexión. Las credenciales de dev/CI (`dupla`/`dupla`/`dupla`) son solo para local y CI, nunca para un entorno real. Containerizar la DB local **no** compromete la decisión de hosting, que sigue diferida (2026-07-16): los Dockerfiles de producción multi-stage para api y web son **fase 2**, disparada cuando se decida el hosting.

## 2026-07-20 — Formato compartido: Prettier en la raíz y check en la CI

**Contexto**: solo `apps/api` tenía el formato garantizado (Prettier como regla de ESLint a nivel error). En `apps/web`, `docs/` y la raíz el formato lo decidía la extensión del editor de cada dev, sin config versionada. Siendo dos, eso produce PRs donde un archivo aparece reformateado entero y el cambio real queda enterrado.
**Decisión**: Prettier pasa a ser devDependency de la raíz con scripts `format` y `format:check`, más `.prettierrc`, `.prettierignore`, `.editorconfig` y `.gitattributes`. Se agrega un tercer job `format` a la CI que corre `prettier --check` sobre todo el repo.
**Consecuencias**: el `.prettierrc` raíz se deja mínimo (`endOfLine` solamente) porque Prettier usa el config más cercano a cada archivo y **no los fusiona** — `apps/api` sigue mandando con el suyo y `apps/web` con los defaults, que es lo que ya usaba su scaffold; un config raíz más opinionado reescribiría medio `apps/web`. El check `format` es un tercer status check: hay que agregarlo a los required checks de la branch protection de `main` para que bloquee. `.gitattributes` (`* text=auto eol=lf`) mueve la normalización de finales de línea del `core.autocrlf` de cada máquina al repo; como efecto secundario, el `endOfLine: "auto"` que `apps/api/eslint.config.mjs` tiene como parche para checkouts CRLF en Windows deja de ser necesario, pero se conserva por ahora (sacarlo es un cambio de comportamiento de lint y va en su propio PR).

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
