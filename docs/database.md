# Base de datos — dupla

Cómo está armada la infra de datos y cómo se opera el día a día: Postgres local, configuración de Prisma, migraciones, y cómo se usa desde Nest. El **porqué** de cada decisión no discrecional que impone Prisma 7 está en [`decisions.md`](./decisions.md), entrada "Prisma 7: setup real" — no se repite acá. El modelo de datos (ERD, tablas planeadas) está en [`data-model.md`](./data-model.md). Detalles de Jest, lint y TypeScript de `apps/api` están en `apps/api/AGENTS.md`.

## Setup local

Desde la raíz del repo:

```bash
pnpm install                 # incluye postinstall → prisma generate
cp .env.example .env         # DATABASE_URL ya apunta al compose de abajo
pnpm run db:up                # Postgres 17 en :5432 (+ Adminer en :8080)
pnpm run db:migrate           # aplica apps/api/prisma/migrations
```

Para verificar que quedó bien:

```bash
pnpm --filter api run test:e2e
```

`test/prisma.e2e-spec.ts` escribe y lee un `User` real contra la base que acabás de levantar.

## Las piezas

### `compose.yml` (raíz)

`postgres:17` con credenciales `dupla`/`dupla`, expuesto en `:5432`. Los datos viven en el volumen `dupla-pgdata`, así que sobreviven a `pnpm run db:down` — para arrancar de cero hay que borrar el volumen a mano. Incluye Adminer (GUI de DB) opcional en `:8080`, con `depends_on` al healthcheck de Postgres.

### `.env` / `.env.example` (raíz)

`DATABASE_URL` es la única env var que necesita la API, y vive en el `.env` de la **raíz** del monorepo — no hay un `.env` por paquete. El `.env` no se commitea; `.env.example` sí, y es lo que copiás en el setup local.

### `apps/api/prisma.config.ts`

Prisma 7 no autocarga `.env` (comportamiento nuevo respecto de v6). Este archivo carga `dotenv` a mano apuntando a `../../.env` — asume `cwd == apps/api`, que es lo que garantiza correr todo vía `pnpm --filter api` en vez de invocar el CLI de Prisma directo desde otro directorio.

### `apps/api/prisma/schema.prisma`

- `generator client` usa el provider `prisma-client` (no `prisma-client-js`, deprecado en v7), con `output` **obligatorio**: apunta a `apps/api/src/generated/prisma`, adentro de `src/` porque `nest build` solo compila esa carpeta.
- `moduleFormat = "cjs"` porque Nest es CommonJS y el default de v7 es ESM.
- `importFileExtension = ""` porque el cliente generado con extensión `.js` explícita en sus imports internos rompe la resolución de módulos de Jest.
- `datasource db` no tiene `url` — se la inyecta `prisma.config.ts` en runtime, no el schema.

El modelo `User` es la plantilla a seguir para toda tabla nueva:

- `id` con `@default(uuid(7))` y `@db.Uuid` — UUIDv7, no autoincremental.
- `@map` de cada campo a `snake_case` y `@@map` del modelo al nombre de tabla en plural.
- Columnas de tiempo con `@db.Timestamptz(3)`, nunca `timestamp` sin zona horaria.
- Enums de Prisma para campos de estado (acá `UserStatus`), mapeados a un enum nativo de Postgres con `@@map`.

### `apps/api/src/prisma/prisma.service.ts` y `prisma.module.ts`

`PrismaService` extiende `PrismaClient` pasándole un `PrismaPg` (driver adapter de `@prisma/adapter-pg`) construido con la `DATABASE_URL` que resuelve `ConfigService.getOrThrow`. Prisma 7 exige un adapter explícito — ya no hay motor embebido por default. Implementa `OnModuleInit`/`OnModuleDestroy` para atar el pool al ciclo de vida de Nest, pero los dos extremos no son simétricos: el `$disconnect()` del destroy cierra el pool de verdad, mientras que el `$connect()` del init **no verifica que la base sea alcanzable**. Con driver adapter el pool de `pg` es lazy y no abre socket hasta la primera query, así que la API arranca perfecto con Postgres apagado —`Nest application successfully started`, `/docs` respondiendo— y recién falla en el primer request que toca la DB: 500 `internal_error` al cliente, con el `ECONNREFUSED` solo en el log del server. **Un arranque limpio no dice nada sobre el estado de la base**: eso lo contesta `GET /health` (`src/health/`), que corre un `SELECT 1` y devuelve 503 `database_unavailable` si no llega.

`PrismaModule` exporta `PrismaService` pero **no es `@Global()`** — cada módulo de feature que necesite la DB tiene que importar `PrismaModule` explícitamente, no asumir que está disponible.

### `apps/api/src/app.module.ts` y `main.ts`

`ConfigModule.forRoot({ isGlobal: true, envFilePath: ... })` carga el `.env` de la raíz y lo deja disponible en toda la app vía DI. `app.enableShutdownHooks()` en `main.ts` es lo que hace que Nest dispare `onModuleDestroy` (y por lo tanto `$disconnect()`) ante SIGINT/SIGTERM — sin esa línea el pool de conexiones no se cierra prolijo al parar el proceso.

### Scripts

| Script        | Qué hace                                                           |
| ------------- | ------------------------------------------------------------------ |
| `db:up`       | `docker compose up -d db` — solo el servicio de Postgres           |
| `db:down`     | `docker compose down` — para los contenedores, conserva el volumen |
| `db:migrate`  | `prisma migrate dev` — crea y aplica una migración                 |
| `db:status`   | `prisma migrate status` — qué migraciones están aplicadas          |
| `db:verify`   | `validate` + `migrate status` + check de drift — ver abajo         |
| `db:generate` | `prisma generate` — regenera el cliente sin migrar                 |
| `db:studio`   | `prisma studio` — GUI para inspeccionar datos                      |

Todos corren desde la raíz (`pnpm run db:*`) y son wrappers de `pnpm --filter api exec prisma ...`. Además, `apps/api/package.json` tiene un `postinstall: prisma generate`, así que un `pnpm install` limpio ya deja el cliente generado.

### Cliente generado

`apps/api/src/generated/prisma/` **no se commitea** — está en `apps/api/.gitignore`, en `.prettierignore` (raíz) y en los `ignores` de `apps/api/eslint.config.mjs`. Se regenera solo con `pnpm install` o a mano con `pnpm run db:generate`. Si TypeScript se queja de que no encuentra `../generated/prisma/client`, es señal de que falta correr uno de los dos.

## Día a día

### Agregar o cambiar una tabla

1. Editá `apps/api/prisma/schema.prisma` siguiendo las convenciones del modelo `User` (arriba).
2. `pnpm run db:migrate` — te va a pedir un nombre para la migración.
3. **Leé el SQL generado** en `apps/api/prisma/migrations/<timestamp>_<nombre>/migration.sql` antes de commitear — es lo que se corre en CI y en prod, no un detalle interno.
4. `pnpm run db:verify` — ver la sección de abajo.
5. Commiteá el `schema.prisma` y la carpeta de la migración juntos, en el mismo PR que la feature que la necesita.
6. Quien mergea y actualiza su rama corre `pnpm install && pnpm run db:migrate` para aplicar la migración nueva localmente.

Recordá el invariante de tenancy del `CLAUDE.md` raíz: toda entidad propiedad de un club lleva `club_id` indexado (`Player` es la excepción, es global a la plataforma). Para schema nuevo, el camino recomendado es pasarlo por el agente `db-architect` antes de migrar.

**`prisma db push` no se usa en este repo.** Sincroniza la base con el schema sin generar una migración, así que tu base local queda bien, el check de drift de abajo pasa en verde, y el repo queda sin el SQL que necesitan CI, tus compañeros y producción. Si querés iterar rápido sobre una idea, hacelo con `db:migrate` y después juntá las migraciones de prueba en una sola antes de abrir el PR.

### Verificar antes de commitear

```bash
pnpm run db:verify     # necesita pnpm run db:up
```

Encadena tres cosas, de la más barata a la más cara:

1. `prisma validate` — el schema y la config parsean. No necesita la base.
2. `prisma migrate status` — no hay migraciones pendientes, fallidas, ni aplicadas en la base pero ausentes del repo.
3. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` — **el check de drift**: compara tu base contra `schema.prisma` y falla si difieren.

El paso 3 es el que atrapa el error más común y más silencioso: **editaste `schema.prisma` y te olvidaste de generar la migración.** El cliente de Prisma se genera desde el `.prisma`, no desde el SQL, así que el código compila igual y los tests pasan hasta que alguno toca la columna que no existe. La CI corre ese mismo comando (ver abajo).

Para lo que un comando no cubre —que el SQL diga lo mismo que el schema, migraciones ya commiteadas que fueron editadas, cambios destructivos— está el agente `db-verifier`, que corre esto y lee el diff. Solo reporta: no toca archivos ni la base.

Si `db:verify` marca drift, el arreglo es generar la migración que falta con `pnpm run db:migrate`. **Nunca al revés**: editar el `.sql` de una migración que ya está en `main` rompe el checksum en toda base donde ya se aplicó.

### Usar Prisma desde un módulo de feature

```ts
@Module({
  imports: [PrismaModule],
  providers: [TournamentsService],
})
export class TournamentsModule {}

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}
}
```

### Tests contra la base de datos

Los e2e (`test/*.e2e-spec.ts`) corren contra Postgres real — no hay provider de Prisma mockeado. Reglas vigentes, ver `test/prisma.e2e-spec.ts` como ejemplo:

- Cerrá el `AppModule` en `afterAll` con `await app.close()`, para que `PrismaService.onModuleDestroy` corra el `$disconnect()`. Sin esto Jest cuelga con el warning de "open handles".
- Los datos que crea un test se limpian ahí mismo (patrón: email único con `randomUUID()` + `deleteMany` al final), no dependas de un rollback automático.
- `test:e2e` corre con `NODE_OPTIONS=--experimental-vm-modules` — necesario porque el query compiler WASM de Prisma 7 carga con `import()` dinámico, y Jest no lo soporta sin ese flag. Es esperado, no lo saques si aparece.

## Cómo corre en CI

El job `api` de `.github/workflows/ci.yml` levanta un service container `postgres:17` con el mismo healthcheck que el compose local, y define `DATABASE_URL` a nivel de job. Orden de los pasos: check de migraciones inmutables → `prisma generate` (explícito, no solo confiado al `postinstall` — pnpm restaurando desde su store cacheado no siempre lo dispara) → lint → build → `prisma migrate deploy` → check de drift → unit tests → e2e tests.

`migrate deploy` y no `migrate dev`: aplica las migraciones existentes sin generar una nueva ni pedir input, y es el comando pensado para CI/producción. **Lo que `migrate deploy` no hace es comparar contra `schema.prisma`** — solo aplica el historial de migraciones y verifica los checksums de lo ya aplicado. En una base recién creada como la de CI no hay historial previo, así que un `schema.prisma` editado sin su migración le pasa por al lado. Por eso hay un paso aparte:

- **Check de drift** — el mismo `migrate diff` que corre `db:verify`, justo después de `migrate deploy` y antes de los tests (así falla rápido, y ningún test pudo haber mutado el schema en el medio). Como la base de CI se construye desde cero aplicando las migraciones, compararla contra `schema.prisma` **es** comparar migraciones contra schema.
- **Check de migraciones inmutables** — primer paso del job, solo en PRs. Falla si el PR modifica o borra un `.sql` que ya está en `main`. Necesita `fetch-depth: 0` en el checkout para tener historia contra la que comparar. Una migración creada y corregida dentro del mismo PR no dispara el check: figura como agregada, no modificada.

Es la única barrera que cubre a todo el equipo, independiente de qué editor o agente use cada uno. No hay hooks de git ni de pre-commit en este repo, a propósito — ver la entrada correspondiente en `decisions.md`.

## Cuando algo falla

| Síntoma                                               | Causa                                                  | Arreglo                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `Cannot find module '../generated/prisma/client'`     | Falta generar el cliente                               | `pnpm run db:generate`                                                            |
| `Can't reach database server at localhost:5432`       | Docker apagado o Postgres no levantado                 | `pnpm run db:up`                                                                  |
| La API arranca bien pero todo endpoint da 500         | Igual que la fila de arriba — el arranque no conecta   | `curl localhost:3000/health` para confirmarlo, después `pnpm run db:up`           |
| Jest queda colgado, warning de "open handles"         | Un e2e sin `await app.close()`                         | Agregar el `afterAll` que cierra la app                                           |
| `ExperimentalWarning: VM Modules` en la salida de e2e | Esperado — ver arriba                                  | Ninguno, no sacar el flag                                                         |
| `db:verify` falla en el paso de `migrate diff`        | Editaste `schema.prisma` y falta generar la migración  | `pnpm run db:migrate` — nunca editando el `.sql` de una migración ya commiteada   |
| Base local en estado raro que `db:migrate` no arregla | Migraciones aplicadas a mano, o `db push` en el pasado | `pnpm --filter api exec prisma migrate reset` (**borra todos los datos locales**) |
| Puerto `5432` ocupado al hacer `db:up`                | Otro Postgres corriendo en la máquina                  | Parar el otro proceso o cambiar el puerto en `compose.yml` y en `DATABASE_URL`    |

## Lo que todavía no está

No hay seeds. El ERD de `data-model.md` está migrado solo en su primera tabla (`users`); el resto se migra tabla por tabla a medida que cada feature la necesita. No hay guard de tenancy todavía — se cablea junto con auth. No hay estrategia de hosting ni de backup definida para producción.
