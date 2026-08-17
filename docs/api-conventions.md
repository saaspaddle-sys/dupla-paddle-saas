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

## Las tres clases de endpoint

Todo endpoint pertenece a una de estas tres, y la spec lo declara explícitamente:

1. **Del club** — requiere JWT de staff. El scoping es por el `club_id` del usuario autenticado, **nunca** por un `club_id` que venga del body, params o query. Es el invariante de tenancy del producto (`docs/decisions.md`): un club viendo datos de otro es el peor bug posible de este SaaS.
2. **Público** — la vista gratuita para jugadores (torneos, llaves, resultados, perfiles). Solo lectura, sin auth, y sin exponer datos internos del club.
3. **De plataforma** — operaciones sobre `Player`, que es global y no tiene `club_id`. Definí quién puede crear y editar, y cómo se evitan los duplicados (buscar antes de crear).

## DTOs

- **Todo** body, query y param que entra por un controller pasa por un DTO con decoradores de `class-validator`. Nada de `any` ni de objetos sin validar.
- **DTOs de entrada y de respuesta separados.** Nunca se expone una entidad interna directamente: lo que devuelve la API es una decisión deliberada, no el resultado de serializar el modelo de datos.
- Desde el registro de jugador (slice 1), `class-validator`/`class-transformer` están instalados y el `ValidationPipe` global está cableado (`whitelist`, `forbidNonWhitelisted`, `transform`, con `exceptionFactory` propio) como provider `APP_PIPE` en `AppModule` — ver `apps/api/AGENTS.md`.

## Errores

- Códigos HTTP correctos y específicos: `400` validación, `401` sin autenticar, `403` autenticado pero sin permiso, `404` no existe, `409` conflicto (duplicados, estado inválido).
- Se usan las excepciones de Nest (`NotFoundException`, `ConflictException`, …), no respuestas armadas a mano.
- **Mismo shape de error en toda la API**, y sin filtrar detalles internos al cliente (stack traces, mensajes de la base). Establecido por el registro de jugador (slice 1): `{ statusCode, code, message, details }`, siempre las cuatro claves (`details: null` cuando no aplica), vía `AppExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`). Detalle completo en `docs/decisions.md`, "Shape de error uniforme de la API".
- `code` es un identificador estable en **inglés** snake_case (`dni_has_account`, `email_registered`, `validation`) — es lo que el frontend mapea a copy en español. `message` también va en inglés: es texto para debug/logging, no contrato de UI.

## Listas

Si un endpoint devuelve una colección que puede crecer sin techo (inscripciones de un torneo, jugadores), la spec declara la estrategia de paginación en vez de devolver todo. Si devuelve algo acotado por naturaleza (las canchas de un club), decilo explícitamente para que no quede como olvido.

## Documentación (OpenAPI)

La API se autodocumenta con `@nestjs/swagger`: UI en `/docs`, documento en `/docs/json`. El setup vive en `apps/api/src/swagger/swagger.setup.ts`. Documentar es parte del contrato, no un extra — un endpoint que no aparece en `/docs` no existe para el resto del equipo ni para el frontend.

- **`@ApiTags` con la clase del endpoint**, tomada de `API_TAGS` (`club`, `public`, `platform`), nunca un string suelto. Es lo que hace que la doc se lea agrupada por las tres clases de arriba, y obliga a decidir la clase al escribir el controller y no al revisarlo.
- **`@ApiOperation({ summary })`** en cada handler: una línea diciendo qué hace.
- **Respuestas declaradas con su DTO de respuesta** — el caso feliz (`@ApiOkResponse`, `@ApiCreatedResponse`) y los errores que el cliente maneja distinto (`404`, `409`, …). Nunca se declara una entidad interna como respuesta, por la misma razón que no se la devuelve.
- **Los endpoints autenticados llevan `@ApiBearerAuth('jwt')`**, con el mismo nombre de security scheme que declara el setup (`JWT_SECURITY_SCHEME`). Si no coincide, Swagger UI no manda el header y el "Try it out" da `401` sin explicar por qué.
- **Los campos de los DTOs no se decoran a mano.** El plugin de `@nestjs/swagger` (activo en `nest-cli.json`) infiere tipo, requerido/opcional y descripción —del JSDoc de la propiedad— para todo archivo `*.dto.ts`. `@ApiProperty` queda para lo que el tipo no dice: `example`, `format`, o fijar un enum.
