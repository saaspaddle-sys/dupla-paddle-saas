# CLAUDE.md

Este archivo le da contexto a Claude Code (claude.ai/code) para trabajar en este repositorio.

El contexto que aplica a todo el repo (producto, invariante de tenancy, workflow del equipo, reglas del monorepo, forma de la CI) vive en el `CLAUDE.md` raíz — también aplica acá y no se repite. Este archivo cubre solo `apps/api`.

## Estado del código

El scaffold `app.controller.ts`/`app.service.ts` (y sus specs) ya no existe — se borró cuando entró el primer módulo real, siguiendo la regla de abajo. `AppModule` importa `ConfigModule` (global, carga el `.env` de la raíz del monorepo), `ThrottlerModule` (global, sin registrarse como `APP_GUARD` — `GET /health` no se throttlea), `PrismaModule`, `HealthModule` (`GET /health` — ver `docs/database.md`, y la entrada del 2026-08-16 en `docs/decisions.md`), `PlayersModule` y `AuthModule`, y registra `ValidationPipe` y el filtro de excepciones globales como providers (`APP_PIPE`/`APP_FILTER`, no en `main.ts` — ver por qué en la próxima sección). `main.ts` monta Swagger antes de `listen()` (ver abajo). Hay dos entidades migradas, `User` (`users`) y `Player` (`players`); el resto de `docs/decisions.md` sigue sin implementar.

En concreto, esto todavía no existe — verificá antes de importarlo, y creálo como parte de la feature que lo necesite por primera vez:

- **Guard de tenancy** — el invariante de `club_id` (raíz `CLAUDE.md`) está documentado pero no cableado: no hay todavía ninguna entidad con `club_id`. `Player` es la entidad global sin `club_id`; `Club` (con guard incluido) llega en el slice de tenant. El lugar donde ese guard va a leer el `clubId` ya existe: `JwtStrategy.validate` (`src/auth/strategies/jwt.strategy.ts`), que resuelve el usuario autenticado contra la DB en cada request.

Lo que dejó de faltar con el registro de jugador (slice 1, `docs/data-model.md`), por si algún prompt o doc viejo todavía asume que no está: `class-validator`/`class-transformer` instalados y el `ValidationPipe` global cableado (`whitelist`, `forbidNonWhitelisted`, `transform`, `exceptionFactory` propio); el shape de error uniforme (`AppExceptionFilter`, ver `docs/decisions.md` "Shape de error uniforme de la API"); y `bcryptjs` para hashear contraseñas (`common/crypto/password.ts`, ahora compartido con `auth/`).

Y lo que dejó de faltar con el login: `@nestjs/passport`, `@nestjs/jwt`, `@nestjs/throttler` instalados; `AuthModule` (`src/auth/`) con `POST /auth/login`, `GET /auth/me`, `JwtStrategy` y `JwtAuthGuard`; rate limiting por `@Throttle` en los controllers de `/auth/login` y `/auth/register`; y la variable de entorno `JWT_SECRET` (`.env.example` en la raíz, y en el `env:` del job `api` de `ci.yml` — la API no arranca sin ella, `getOrThrow`). Detalle completo en `docs/decisions.md`, entrada de sesión (2026-08-17).

Los archivos de scaffold `app.*` se borran a medida que los reemplacen módulos reales, en vez de construir alrededor de ellos — así se hizo con `players/`. Si un módulo nuevo entra y todavía quedara algún `app.*`, es la señal de que ese borrado se salteó.

## Prisma

Guía operativa completa (setup local, día a día, troubleshooting) en `docs/database.md`. Acá, lo específico de este paquete: `prisma/schema.prisma` es el schema real (ver `docs/decisions.md`, entrada "Prisma 7: setup real"). Comandos, todos desde la raíz:

```bash
pnpm run db:up                          # levanta Postgres local (compose.yml)
pnpm run db:migrate                     # prisma migrate dev — crea/aplica una migración
pnpm run db:verify                      # validate + migrate status + check de drift
pnpm run db:status                      # prisma migrate status — qué está aplicado
pnpm run db:generate                    # prisma generate — regenera el cliente
pnpm run db:studio                      # prisma studio — GUI de datos
```

Corré `db:verify` antes de commitear cualquier cambio en `prisma/`: `migrate deploy` (lo que corre la CI) **no** compara contra `schema.prisma`, así que un schema editado sin su migración compila, pasa los tests y se cae recién en el deploy. Desde este PR la CI corre el mismo check de drift, y el agente `db-verifier` lo interpreta junto con el SQL generado. `prisma db push` no se usa acá — ver `docs/database.md`.

Todo comando de Prisma va vía `pnpm --filter api exec` (o los scripts de la raíz), **nunca `npx prisma` desde otro directorio**: `prisma.config.ts` resuelve el `.env` como `../../.env` asumiendo `cwd == apps/api`, y desde la raíz falla con un error de datasource que no dice nada del cwd.

El cliente se genera en `apps/api/src/generated/prisma/` — **no se commitea** (está en `.gitignore`, `.prettierignore` y en los `ignores` de `eslint.config.mjs`). Se regenera solo con `pnpm install` (hay un `postinstall` en este paquete) o a mano con `pnpm run db:generate`; si TypeScript se queja de que no encuentra `../generated/prisma/client`, es señal de que falta correrlo. `PrismaService` (`src/prisma/`) extiende `PrismaClient` con el driver adapter de `@prisma/adapter-pg` — Prisma 7 lo exige, ya no hay motor embebido por default.

## Swagger

El setup vive en `src/swagger/swagger.setup.ts` y lo llama `main.ts` **antes de `listen()`**. No es un módulo de Nest a propósito (ver `docs/decisions.md`, entrada del 2026-08-14). Lo que decora un endpoint —tags, `@ApiOperation`, respuestas, `@ApiBearerAuth`— es regla de contrato y vive en `docs/api-conventions.md`, sección "Documentación (OpenAPI)": no se repite acá.

- UI en `http://localhost:3000/docs`; documento en `/docs/json` y `/docs/yaml`.
- Se sirve salvo con `NODE_ENV=production`. `SWAGGER_ENABLED=true|false` (en el `.env` de la raíz) fuerza cualquiera de los dos lados.
- **El plugin de `@nestjs/swagger` está activo** en `nest-cli.json` (`introspectComments: true`) — por eso los DTOs no llevan un `@ApiProperty` por campo. Corre en `nest build` y `nest start`, **no bajo ts-jest**: un test que construya el documento va a ver los DTOs sin la metadata inferida, y eso es esperado, no un bug del test. Si alguna vez hace falta ahí, se genera con `metadataDestination` + `SwaggerModule.loadPluginMetadata()`.
- La doc se monta sobre la app en `main.ts`, no en `AppModule`, así que los e2e **no la ven** salvo que llamen `setupSwagger(app)` antes de `init()` — `test/swagger.e2e-spec.ts` es el ejemplo.

## Comandos

Corré desde la raíz del repo (workspace de pnpm, un solo lockfile):

```bash
pnpm run start:dev                      # modo watch — el loop principal de dev (puerto 3000)
pnpm --filter api run start:debug       # lo mismo, con el inspector de Node conectado
pnpm --filter api run build             # nest build → dist/ (borra outDir primero)

pnpm --filter api run test               # tests unitarios
pnpm --filter api run test -- src/players/players.service.spec.ts   # un solo archivo
pnpm --filter api run test -- -t "links the existing profile"       # por nombre de test
pnpm --filter api run test:e2e           # tests e2e (config de Jest separada)
pnpm --filter api run test:cov           # coverage → apps/api/coverage/

pnpm --filter api exec eslint "{src,test}/**/*.ts" --max-warnings 0   # exactamente lo que lintea la CI
```

## Los dos setups de Jest

- **Unit** — `*.spec.ts` ubicados junto al código en `src/`. La config está inline en `package.json` con `rootDir: src`, así que `pnpm run test` no puede ver `test/`.
- **E2E** — `*.e2e-spec.ts` en `test/`, corridos vía `test/jest-e2e.json` (`rootDir: .`). Estos levantan el `AppModule` **completo** a través de `@nestjs/testing` + supertest, contra Postgres real (el `compose.yml` en local, un service container en CI) — no hay provider de Prisma mockeado.

El acoplamiento del e2e al `AppModule` real es lo que hay que tener en cuenta: todo lo que importe `AppModule` tiene que poder arrancar bajo e2e. Dos consecuencias concretas de que Prisma ya esté adentro:

- Cada archivo `*.e2e-spec.ts` que levante `AppModule` tiene que cerrarlo en `afterAll` (`await app.close()`) para que `PrismaService.onModuleDestroy` corra el `$disconnect()`. Un `beforeEach`/`afterEach` sin `close()` deja pools de conexión abiertos y Jest cuelga con el warning de "open handles" — ya pasó una vez en este repo, así que si vuelve a aparecer es la primera sospecha, no una casualidad.
- `test:e2e` corre con `NODE_OPTIONS=--experimental-vm-modules` (vía `cross-env`, ver el script en `package.json`). Hace falta porque Prisma 7 no tiene motor de Rust: el query compiler es WASM y se carga con `import()` dinámico, que Jest no soporta sin ese flag experimental. Es una limitación de Jest, no algo a "arreglar" — no lo saques si ves el warning de `ExperimentalWarning: VM Modules` en la salida, es esperado.

## Lint: local vs CI

`pnpm --filter api run lint` corre `eslint --fix` permitiendo warnings. La CI corre los mismos archivos con `--max-warnings 0` y sin `--fix`. Así que un lint local limpio puede igual fallar el check de `api` — reproducí la CI con el último comando de arriba antes de pushear.

Esto afecta a las dos reglas configuradas como warning en `eslint.config.mjs`, que en la práctica son fallos de CI: `@typescript-eslint/no-floating-promises` y `@typescript-eslint/no-unsafe-argument`.

El resto de la config que vale la pena conocer:

- **El lint type-aware está habilitado** (`recommendedTypeChecked` con `projectService`). La familia `no-unsafe-*` se dispara con valores tipados `any`, que es exactamente lo que producen los request bodies sin tipar y el JSON crudo. `no-explicit-any` está apagada, así que anotar `any` a propósito está bien; lo que se marca es dejar que un `any` fluya hacia un call.
- **Prettier es una regla de lint a nivel error.** Las opciones de formato viven en `.prettierrc` (`singleQuote`, `trailingComma: all`); en la regla misma, en `eslint.config.mjs`, solo está seteado `endOfLine: auto`, así que los checkouts CRLF en Windows no rompen la CI.

## Detalles de TypeScript

- **La strictness es más laxa que en `apps/web`**: `strictNullChecks` está activo, pero `noImplicitAny` y `strictBindCallApply` están **apagados**. No asumas que el compilador va a atrapar un `any` implícito.
- **Sin path alias.** `baseUrl` es `./` sin `paths` — los imports son relativos (`./players.service`), a diferencia del `@/*` de web. `module`/`moduleResolution` son `nodenext`.
- **`emitDecoratorMetadata` está activo** y es necesario para la DI de Nest — la inyección por constructor se resuelve a través de eso.

## Convenciones para módulos nuevos

**`docs/api-conventions.md` es la referencia del contrato** — estructura de módulo, forma de las rutas, reglas de DTOs, códigos de error, y las clases de endpoint en las que toda ruta se tiene que declarar (club / public / platform, más `ops` para lo operacional). Leelo antes de diseñar o revisar un endpoint. Es la fuente única: no repitas sus reglas acá ni en un prompt de agente.
