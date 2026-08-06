# CLAUDE.md

Este archivo le da contexto a Claude Code (claude.ai/code) para trabajar en este repositorio.

El contexto que aplica a todo el repo (producto, invariante de tenancy, workflow del equipo, reglas del monorepo, forma de la CI) vive en el `CLAUDE.md` raíz — también aplica acá y no se repite. Este archivo cubre solo `apps/api`.

## Estado del código

`AppController`/`AppService` siguen siendo el scaffold de NestJS devolviendo `"Hello World!"`. Lo que ya no es scaffold: `AppModule` importa `ConfigModule` (global, carga el `.env` de la raíz del monorepo) y `PrismaModule`; hay una sola entidad, `User` (tabla `users`), migrada. El resto de `docs/decisions.md` sigue sin implementar.

En concreto, esto todavía no existe — verificá antes de importarlo, y creálo como parte de la feature que lo necesite por primera vez:

- **Auth** — no hay Passport, no hay JWT, no hay guards, no hay `@nestjs/passport`/`@nestjs/jwt`.
- **Validación** — `class-validator`/`class-transformer` no están instalados y `main.ts` **no registra ningún `ValidationPipe` global**. Los decoradores de DTO solos no van a hacer nada silenciosamente hasta que se agreguen ambos; la primera feature con un request body tiene que cablear el pipe.
- **Forma de los errores** — no hay exception filter. La forma consistente de error a nivel API que asumen las specs todavía la tiene que establecer quien llegue primero a esa necesidad.
- **Guard de tenancy** — el invariante de `club_id` (raíz `CLAUDE.md`) está documentado pero no cableado: no hay todavía ninguna entidad con `club_id` ni un concepto de "usuario autenticado" del que sacarlo. Se implementa junto con auth.

Borrá los archivos de scaffold `app.*` a medida que los reemplacen módulos reales, en vez de construir alrededor de ellos; `app.controller.spec.ts` y `test/app.e2e-spec.ts` verifican la respuesta `"Hello World!"` y tienen que irse junto con ellos.

## Prisma

`prisma/schema.prisma` es el schema real (ver `docs/decisions.md`, entrada "Prisma 7: setup real"). Comandos, todos desde la raíz:

```bash
pnpm run db:up                          # levanta Postgres local (compose.yml)
pnpm run db:migrate                     # prisma migrate dev — crea/aplica una migración
pnpm run db:generate                    # prisma generate — regenera el cliente
pnpm run db:studio                      # prisma studio — GUI de datos
```

El cliente se genera en `apps/api/src/generated/prisma/` — **no se commitea** (está en `.gitignore`, `.prettierignore` y en los `ignores` de `eslint.config.mjs`). Se regenera solo con `pnpm install` (hay un `postinstall` en este paquete) o a mano con `pnpm run db:generate`; si TypeScript se queja de que no encuentra `../generated/prisma/client`, es señal de que falta correrlo. `PrismaService` (`src/prisma/`) extiende `PrismaClient` con el driver adapter de `@prisma/adapter-pg` — Prisma 7 lo exige, ya no hay motor embebido por default.

## Comandos

Corré desde la raíz del repo (workspace de pnpm, un solo lockfile):

```bash
pnpm run start:dev                      # modo watch — el loop principal de dev (puerto 3000)
pnpm --filter api run start:debug       # lo mismo, con el inspector de Node conectado
pnpm --filter api run build             # nest build → dist/ (borra outDir primero)

pnpm --filter api run test               # tests unitarios
pnpm --filter api run test -- src/app.controller.spec.ts   # un solo archivo
pnpm --filter api run test -- -t "should return"           # por nombre de test
pnpm --filter api run test:e2e           # tests e2e (config de Jest separada)
pnpm --filter api run test:cov           # coverage → apps/api/coverage/

pnpm --filter api exec eslint "{src,test}/**/*.ts" --max-warnings 0   # exactamente lo que lintea la CI
```

## Los dos setups de Jest

- **Unit** — `*.spec.ts` ubicados junto al código en `src/`. La config está inline en `package.json` con `rootDir: src`, así que `pnpm run test` no puede ver `test/`.
- **E2E** — `*.e2e-spec.ts` en `test/`, corridos vía `test/jest-e2e.json` (`rootDir: .`). Estos levantan el `AppModule` **completo** a través de `@nestjs/testing` + supertest, contra Postgres real (el `compose.yml` en local, un service container en CI) — no hay provider de Prisma mockeado.

El acoplamiento del e2e al `AppModule` real es lo que hay que tener en cuenta: todo lo que importe `AppModule` tiene que poder arrancar bajo e2e. Dos consecuencias concretas de que Prisma ya esté adentro:

- Cada archivo `*.e2e-spec.ts` que levante `AppModule` tiene que cerrarlo en `afterAll` (`await app.close()`) para que `PrismaService.onModuleDestroy` corra el `$disconnect()`. Un `beforeEach`/`afterEach` sin `close()` deja pools de conexión abiertos y Jest cuelga con el warning de "open handles" — pasó una vez en `app.e2e-spec.ts`, ver el `git blame` de esa sección si vuelve a aparecer.
- `test:e2e` corre con `NODE_OPTIONS=--experimental-vm-modules` (vía `cross-env`, ver el script en `package.json`). Hace falta porque Prisma 7 no tiene motor de Rust: el query compiler es WASM y se carga con `import()` dinámico, que Jest no soporta sin ese flag experimental. Es una limitación de Jest, no algo a "arreglar" — no lo saques si ves el warning de `ExperimentalWarning: VM Modules` en la salida, es esperado.

## Lint: local vs CI

`pnpm --filter api run lint` corre `eslint --fix` permitiendo warnings. La CI corre los mismos archivos con `--max-warnings 0` y sin `--fix`. Así que un lint local limpio puede igual fallar el check de `api` — reproducí la CI con el último comando de arriba antes de pushear.

Esto afecta a las dos reglas configuradas como warning en `eslint.config.mjs`, que en la práctica son fallos de CI: `@typescript-eslint/no-floating-promises` y `@typescript-eslint/no-unsafe-argument`.

El resto de la config que vale la pena conocer:

- **El lint type-aware está habilitado** (`recommendedTypeChecked` con `projectService`). La familia `no-unsafe-*` se dispara con valores tipados `any`, que es exactamente lo que producen los request bodies sin tipar y el JSON crudo. `no-explicit-any` está apagada, así que anotar `any` a propósito está bien; lo que se marca es dejar que un `any` fluya hacia un call.
- **Prettier es una regla de lint a nivel error.** Las opciones de formato viven en `.prettierrc` (`singleQuote`, `trailingComma: all`); en la regla misma, en `eslint.config.mjs`, solo está seteado `endOfLine: auto`, así que los checkouts CRLF en Windows no rompen la CI.

## Detalles de TypeScript

- **La strictness es más laxa que en `apps/web`**: `strictNullChecks` está activo, pero `noImplicitAny` y `strictBindCallApply` están **apagados**. No asumas que el compilador va a atrapar un `any` implícito.
- **Sin path alias.** `baseUrl` es `./` sin `paths` — los imports son relativos (`./app.service`), a diferencia del `@/*` de web. `module`/`moduleResolution` son `nodenext`.
- **`emitDecoratorMetadata` está activo** y es necesario para la DI de Nest — la inyección por constructor se resuelve a través de eso.

## Convenciones para módulos nuevos

**`docs/api-conventions.md` es la referencia del contrato** — estructura de módulo, forma de las rutas, reglas de DTOs, códigos de error, y las tres clases de endpoint en las que toda ruta se tiene que declarar (club / public / platform). Leelo antes de diseñar o revisar un endpoint. Es la fuente única: no repitas sus reglas acá ni en un prompt de agente.
