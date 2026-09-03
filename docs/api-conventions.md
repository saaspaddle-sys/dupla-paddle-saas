# Convenciones de API — dupla

Reglas de contrato para los endpoints de `apps/api`. Son conocimiento del proyecto, no de una herramienta: las aplica quien diseña una feature, quien la implementa, quien la revisa y el agente `api-designer`. Si una regla cambia, se cambia acá y el resto la hereda.

## Idioma

**Todo va en inglés, menos los comentarios.** Nombres de archivo, clases, métodos, variables, DTOs, rutas, códigos de error, mensajes de error y descripciones de tests (`describe`/`it`): inglés. Comentarios de código y documentación (`docs/`, `AGENTS.md`, `CLAUDE.md`): español.

Esto aplica a `apps/api` y a `apps/web` por igual. Única excepción, ya decidida y vigente: las **URLs públicas de `apps/web`** siguen en español (`/torneos`, `/jugadores`) porque son navegación de cara al usuario, no identificadores de código — ver `docs/decisions.md`. Las rutas de la API no son ese caso: van en inglés como el resto del código.

## Estructura

- **Un módulo por dominio de negocio** en `src/<dominio>/`, importado en `AppModule`. La carpeta se llama como el recurso que expone, en inglés: `src/tournaments/` sirve `/tournaments`.
- Un módulo no importa clases internas de otro: consume solo lo que el otro declara en sus `exports`.

## Rutas

- REST con **sustantivos en plural**, en inglés y en kebab-case: `/tournaments`, `/registrations`, `/match-sets`. Las URLs públicas de `apps/web` van en **español** (`/torneos`, `/jugadores`) — son dos superficies distintas y no una inconsistencia: la API la consume código, las URLs las lee un jugador (`docs/decisions.md`, 2026-08-14).
- **Un nivel de anidamiento como máximo**: `/tournaments/:id/registrations` está bien; `/clubs/:id/tournaments/:id/registrations/:id` no. Si necesitás más profundidad, el recurso anidado probablemente merece ser propio.
- El `club_id` **nunca** aparece en la ruta de un endpoint del club — sale del usuario autenticado (ver abajo).
- **El segmento literal `me` es la forma canónica de un recurso singular derivado del usuario autenticado** (`/clubs/me`). No es un identificador y no viola la regla anterior: existe justamente para que no haya un `:id` que alguien pueda sustituir. Se elige sobre un `/club` singular (rompería "sustantivos en plural") y sobre un `GET /clubs` que devuelva una colección de un elemento (dejaría el `PATCH` sin destino). Si el mismo recurso gana después una vista pública por slug, el handler de `me` se declara **antes** que el paramétrico en el controller o el parámetro se come la ruta literal.
- **Cuando un recurso expone un slug que aparece en una URL, los segmentos de ruta reservados se validan al derivarlo o en el DTO, no en el service** — la lista vive en `apps/api/src/common/transforms/slug.ts`. Es la otra mitad de la defensa del punto anterior.
- `/auth/*` es un **namespace de acciones, no un recurso** (`/auth/login`, `/auth/register`, `/auth/me`). Contradice literalmente "sustantivos en plural", que hasta acá solo exceptuaba a `ops`. Queda reconocido para que no se relea como deuda.

## Las clases de endpoint

Todo endpoint pertenece a una de estas, y la spec lo declara explícitamente. Las tres primeras son de negocio y son la decisión importante; la cuarta es operacional:

1. **Del club** — requiere JWT de staff. El scoping es por el `club_id` del usuario autenticado, **nunca** por un `club_id` que venga del body, params o query. Es el invariante de tenancy del producto (`docs/decisions.md`): un club viendo datos de otro es el peor bug posible de este SaaS. En concreto: todo handler de esta clase lleva `@UseGuards(JwtAuthGuard, ClubScopeGuard)` y recibe el scope por `@ClubId()`, y ningún DTO de entrada declara `clubId` ni `ownerId`. La única excepción es **el endpoint que crea el tenant** (`POST /clubs`): corre con `JwtAuthGuard` solo, porque es el que crea el scope y todavía no hay `club_id` que resolver. No se clasifica como `platform` — esa clase está definida como entidades globales **sin** `club_id`, y un `Club` _es_ el `club_id`.
2. **Público** — la vista gratuita para jugadores (torneos, llaves, resultados, perfiles). Solo lectura, sin auth, y sin exponer datos internos del club.
3. **De plataforma** — operaciones sobre `Player`, que es global y no tiene `club_id`. Definí quién puede crear y editar, y cómo se evitan los duplicados (buscar antes de crear).
4. **Operacional (`ops`)** — lo consume la infraestructura, no un usuario ni el frontend: hoy solo `GET /health`. Sin auth (un readiness probe corre antes de que exista una sesión) y **sin datos de negocio** — si un endpoint `ops` necesita devolver algo del dominio, está mal clasificado. Es la única clase donde una ruta puede no ser un sustantivo plural: `/health` es incontable, y `/healths` sería peor.

## DTOs

- **Todo** body, query y param que entra por un controller pasa por un DTO con decoradores de `class-validator`. Nada de `any` ni de objetos sin validar.
- **DTOs de entrada y de respuesta separados.** Nunca se expone una entidad interna directamente: lo que devuelve la API es una decisión deliberada, no el resultado de serializar el modelo de datos.
- Desde el registro de jugador (slice 1), `class-validator`/`class-transformer` están instalados y el `ValidationPipe` global está cableado (`whitelist`, `forbidNonWhitelisted`, `transform`, con `exceptionFactory` propio) como provider `APP_PIPE` en `AppModule` — ver `apps/api/AGENTS.md`.

## Errores

- Códigos HTTP correctos y específicos: `400` validación, `401` sin autenticar, `403` autenticado pero sin permiso, `404` no existe, `409` conflicto (duplicados, estado inválido), `503` una dependencia no responde y la API sí (es el caso de `/health` con Postgres caído — un `500` ahí diría "la API se rompió", que es otra cosa).
- Se usan las excepciones de Nest (`NotFoundException`, `ConflictException`, …), no respuestas armadas a mano.
- **Mismo shape de error en toda la API**, y sin filtrar detalles internos al cliente (stack traces, mensajes de la base). Establecido por el registro de jugador (slice 1): `{ statusCode, code, message, details }`, siempre las cuatro claves (`details: null` cuando no aplica), vía `AppExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`). Detalle completo en `docs/decisions.md`, "Shape de error uniforme de la API".
- `code` es un identificador estable en **inglés** snake_case (`dni_has_account`, `email_registered`, `validation`) — es lo que el frontend mapea a copy en español. `message` también va en inglés: es texto para debug/logging, no contrato de UI.

## Listas

Si un endpoint devuelve una colección que puede crecer sin techo (inscripciones de un torneo, jugadores), la spec declara la estrategia de paginación en vez de devolver todo. Si devuelve algo acotado por naturaleza (las canchas de un club), decilo explícitamente para que no quede como olvido.

**Cuando se pagina, el shape es `{ items, nextCursor }`** — fijado por `GET /tournaments` (slice 3) y obligatorio de ahí en adelante:

```jsonc
{
  "items": [/* ... */],
  "nextCursor": "0195...", // el id del último item, o null en la última página
}
```

- **Cursor, no offset.** Los ids son UUIDv7 (time-ordered), así que ordenar por `id desc` es ordenar por antigüedad y el cursor es un `WHERE id < ?` que usa el índice de la PK. Un offset sobre miles de filas escanea y descarta, y saltea o repite items cuando se inserta algo entre dos páginas.
- **`limit` es 1–100 con default 20.** Fuera de rango es `400 validation`, no un clamp silencioso.
- **Sin `total`.** Contar cuesta un `COUNT` completo por página; agregarlo después es aditivo.

Elegí bien de entrada: envolver en `{ items, nextCursor }` una colección que ya se publicó como array pelado **no es retrocompatible**, así que ese cambio es un endpoint nuevo, no una edición en el lugar (ver "Evolución del contrato").

## Documentación (OpenAPI)

La API se autodocumenta con `@nestjs/swagger`: UI en `/docs`, documento en `/docs/json`. El setup vive en `apps/api/src/swagger/swagger.setup.ts`. Documentar es parte del contrato, no un extra — un endpoint que no aparece en `/docs` no existe para el resto del equipo ni para el frontend.

- **`@ApiTags` con la clase del endpoint**, tomada de `API_TAGS` (`club`, `public`, `platform`, `ops`), nunca un string suelto. Es lo que hace que la doc se lea agrupada por las clases de arriba, y obliga a decidir la clase al escribir el controller y no al revisarlo.
- **`@ApiOperation({ summary })`** en cada handler: una línea diciendo qué hace.
- **Respuestas declaradas con su DTO de respuesta** — el caso feliz (`@ApiOkResponse`, `@ApiCreatedResponse`) y los errores que el cliente maneja distinto (`404`, `409`, …). Nunca se declara una entidad interna como respuesta, por la misma razón que no se la devuelve.
- **Los endpoints autenticados llevan `@ApiBearerAuth('jwt')`**, con el mismo nombre de security scheme que declara el setup (`JWT_SECURITY_SCHEME`). Si no coincide, Swagger UI no manda el header y el "Try it out" da `401` sin explicar por qué.
- **Los campos de los DTOs no se decoran a mano.** El plugin de `@nestjs/swagger` (activo en `nest-cli.json`) infiere tipo, requerido/opcional y descripción —del JSDoc de la propiedad— para todo archivo `*.dto.ts`. `@ApiProperty` queda para lo que el tipo no dice: `example`, `format`, o fijar un enum.

## Evolución del contrato

La API mergea antes que el frontend que la consume, en su propio PR (`docs/workflow.md`). Eso deja una ventana en la que el endpoint está en `main` sin que nadie lo llame, y otra en la que lo llama un frontend escrito contra el contrato anterior. Por eso **un cambio de contrato tiene que ser retrocompatible por sí solo**: no se puede contar con que el consumidor se actualice al mismo tiempo.

- **Se puede en el lugar**: agregar un endpoint, agregar un campo opcional a un DTO de entrada, agregar un campo a un DTO de respuesta, agregar un `code` de error nuevo, aflojar una validación.
- **No se puede en el lugar**: renombrar o borrar una ruta, un campo o un `code`; cambiar el tipo o el significado de un campo que ya existe; volver requerido un campo de entrada que era opcional; endurecer una validación sobre un payload que hoy se acepta. Se hace en tres pasos: se agrega lo nuevo, el consumidor migra en su propio PR, y lo viejo se borra en un tercero.
- Mientras no exista **ningún** consumidor, un cambio incompatible es libre y es el momento barato para hacerlo — es lo que justificó renombrar `POST /auth/registro` a `POST /auth/register` (`docs/decisions.md`, 2026-08-14). Ese momento se cierra con el primer PR de frontend que consume el endpoint.
- **Lo que el frontend consume es `/docs`**, no la spec en prosa ni el código: un cambio de contrato que no está reflejado ahí no llegó al otro lado.
