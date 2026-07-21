# Convenciones de API — dupla

Reglas de contrato para los endpoints de `apps/api`. Son conocimiento del proyecto, no de una herramienta: las aplica quien diseña una feature, quien la implementa, quien la revisa y el agente `api-designer`. Si una regla cambia, se cambia acá y el resto la hereda.

## Estructura

- **Un módulo por dominio de negocio** en `src/<dominio>/`, importado en `AppModule`.
- Un módulo no importa clases internas de otro: consume solo lo que el otro declara en sus `exports`.

## Rutas

- REST con **sustantivos en plural**, en kebab-case: `/torneos`, `/inscripciones`.
- **Un nivel de anidamiento como máximo**: `/torneos/:id/inscripciones` está bien; `/clubes/:id/torneos/:id/inscripciones/:id` no. Si necesitás más profundidad, el recurso anidado probablemente merece ser propio.
- El `club_id` **nunca** aparece en la ruta de un endpoint del club — sale del usuario autenticado (ver abajo).

## Las tres clases de endpoint

Todo endpoint pertenece a una de estas tres, y la spec lo declara explícitamente:

1. **Del club** — requiere JWT de staff. El scoping es por el `club_id` del usuario autenticado, **nunca** por un `club_id` que venga del body, params o query. Es el invariante de tenancy del producto (`docs/decisions.md`): un club viendo datos de otro es el peor bug posible de este SaaS.
2. **Público** — la vista gratuita para jugadores (torneos, llaves, resultados, perfiles). Solo lectura, sin auth, y sin exponer datos internos del club.
3. **De plataforma** — operaciones sobre `Player`, que es global y no tiene `club_id`. Definí quién puede crear y editar, y cómo se evitan los duplicados (buscar antes de crear).

## DTOs

- **Todo** body, query y param que entra por un controller pasa por un DTO con decoradores de `class-validator`. Nada de `any` ni de objetos sin validar.
- **DTOs de entrada y de respuesta separados.** Nunca se expone una entidad interna directamente: lo que devuelve la API es una decisión deliberada, no el resultado de serializar el modelo de datos.
- Ojo con el estado actual del repo: `class-validator` no está instalado y `main.ts` no registra un `ValidationPipe` global. Hasta que ambas cosas existan, **los decoradores no validan nada** — ver `apps/api/AGENTS.md`.

## Errores

- Códigos HTTP correctos y específicos: `400` validación, `401` sin autenticar, `403` autenticado pero sin permiso, `404` no existe, `409` conflicto (duplicados, estado inválido).
- Se usan las excepciones de Nest (`NotFoundException`, `ConflictException`, …), no respuestas armadas a mano.
- **Mismo shape de error en toda la API**, y sin filtrar detalles internos al cliente (stack traces, mensajes de la base). El shape todavía no está establecido: la primera feature que llegue acá lo define y lo documenta en `docs/decisions.md`.

## Listas

Si un endpoint devuelve una colección que puede crecer sin techo (inscripciones de un torneo, jugadores), la spec declara la estrategia de paginación en vez de devolver todo. Si devuelve algo acotado por naturaleza (las canchas de un club), decilo explícitamente para que no quede como olvido.
