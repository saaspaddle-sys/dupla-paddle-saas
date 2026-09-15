# Decisiones técnicas — dupla

Una entrada por decisión, la más nueva arriba de su tema. El texto histórico de las entradas no se reescribe ni se borra: si una decisión se revierte, se agrega una entrada nueva y se enlazan ambas mediante notas de estado.

## Cómo consultar este registro

Este archivo conserva decisiones históricas, no una lista de funcionalidades entregadas. Las reglas vigentes se consultan en [API](./api-conventions.md), [workflow](./workflow.md) y [producto](./product-brief.md).

| Tema                   | Entrada de referencia               |
| ---------------------- | ----------------------------------- |
| Plan gratuito y cuotas | [Plan free](#billing-vigente)       |
| Registro e identidad   | [Registro único](#registro-vigente) |
| Autenticación y sesión | [Login API](#sesion-vigente)        |
| Límites de los PRs     | [PRs por paquete](#prs-vigente)     |
| Identificadores        | [UUIDv7](#ids-vigentes)             |

## 2026-09-14 - Checkout recurrente pendiente no altera la suscripción efectiva

**Decisión**: el backend inicia suscripciones mensuales con Mercado Pago Preapproval. Cada intento queda correlacionado por una referencia opaca generada en el servidor y una fila subscription_checkouts; el cliente no envia precio, moneda, owner, suscripción ni credenciales.

**Consecuencias**: mientras el checkout esta pendiente, subscriptions.plan, status y max_tournaments no cambian. Solo un webhook verificado puede activar o degradar la suscripción. La reserva local comienza en `recovery_required`; cualquier timeout, fallo de transporte, respuesta 2xx malformada o 4xx sin una condición de cuerpo documentada que pruebe que no se creó el preapproval conserva esa reserva y responde `billing_checkout_recovery_required`, evitando un segundo preapproval accidental. Hoy el adaptador no clasifica ningún 4xx de Mercado Pago como definitivo. Existe como maximo un checkout activo o recuperable por suscripción: repetir el mismo plan reutiliza su URL una vez persistida y pedir otro plan devuelve checkout_pending_for_another_plan. Solo se borra la correlación ante un rechazo explícitamente definitivo que demuestra que no se creó el preapproval, o ante una cancelación verificada.

## 2026-09-14 — El email de Player es obligatorio para poder reclamar el perfil

**Decisión**: `players.email` pasa a ser `NOT NULL` mediante una migración nueva. No hay datos de producción que conservar, por lo que se reemplaza la compatibilidad nullable prevista inicialmente para perfiles históricos. El registro público y el alta por organizador ya exigen email, así que ambos caminos satisfacen el invariante.

**Consecuencia**: no existe una rama de recuperación para perfiles sin email. Un perfil sin `user_id` bloquea `POST /auth/register` con `409 profile_claim_verification_required`; el futuro flujo de claim debe verificar control del email ya guardado. Hasta que exista ese flujo, el contrato de registro solo puede devolver `outcome: "created"`: no anuncia ni produce `claimed`.

## 2026-09-14 — Alta por organizador y reclamo seguro de perfiles globales

**Decisión histórica (estado: supersedida por la entrada anterior)**: `POST /players` permite al staff autenticado de un club crear un `Player` global sin credenciales. En este diseño inicial, el endpoint exigía un email válido en su DTO mientras `players.email` permanecía nullable para perfiles históricos. La decisión vigente reemplazó esa compatibilidad: `players.email` es `NOT NULL`. El `club_id` se obtiene exclusivamente de `ClubScopeGuard` y autoriza la operación; nunca se persiste en `Player`.

`GET /players` es la búsqueda paginada para ese mismo staff. Devuelve una proyección deliberada sin DNI, email, teléfonos ni contacto de emergencia. La clave de deduplicación sigue siendo únicamente el DNI y el índice único de la base resuelve carreras.

**Reemplaza para los perfiles sin dueño** la regla histórica de auto-link por DNI de la entrada de 2026-08-11: un DNI no prueba identidad. `POST /auth/register` ahora responde `409 profile_claim_verification_required` sin crear un `User` ni modificar el perfil. Un flujo posterior debe demostrar control del email que ya está almacenado en el perfil; nunca puede usar un email suministrado por quien intenta reclamarlo. La entrega de email y el flujo de claim quedan fuera de este work unit.

## 2026-09-07 — Consultar y borrar el cuadro sin perder resultados

`GET /tournaments/:tournamentId/bracket` devuelve el mismo DTO que el POST, leído del cuadro persistido y ordenado por ronda y posición. No vuelve a sortear. La lectura del scope y los partidos comparte una transacción `RepeatableRead`; un borrado concurrente no mezcla dos snapshots. Un torneo ajeno o inexistente devuelve `404 tournament_not_found`; uno propio sin cuadro devuelve `404 bracket_not_found`.

`DELETE` devuelve `204` y reabre la inscripción (`in_progress → open`) en la misma transacción `Serializable` que elimina los partidos. Solo permite torneos en curso: un cuadro de un torneo cancelado o terminado devuelve `409 tournament_not_in_progress`, sin reabrirlo. Un segundo borrado devuelve `404 bracket_not_found`.

La condición de borrado distingue resultados de byes: `normal`, `walkover`, `retirement` o cualquier set cargado producen `409 bracket_has_results`. Los byes automáticos no lo impiden, aunque su estado sea `finished`. El compare-and-swap toma el estado antes de leer resultados y se revierte si aparece un impedimento. El árbol se elimina con un solo `deleteMany` por torneo y club, como requiere su FK `NoAction`. El futuro handler de resultados debe participar también en transacciones serializables para mantener esa garantía frente a un borrado concurrente.

Ambas rutas son clase `club`, con JWT y `ClubScopeGuard`; no agregan una ruta pública. Regenerar después de borrar produce nuevos ids y un sorteo nuevo, sin prometer que la disposición necesariamente sea distinta.

## 2026-09-07 — El documento OpenAPI se commitea, y CI falla si quedó desincronizado

**Contexto**: la convención ya decía que "lo que el frontend consume es `/docs`". El problema es que `/docs` solo existe con la API corriendo: para responder "qué endpoint llamo y qué me devuelve", quien trabaja en `apps/web` tenía que clonar `apps/api`, levantar Postgres, aplicar migraciones y bootear Nest. Preguntarle al backend sale más barato que eso, así que es lo que pasaba. El contrato estaba documentado y era, en la práctica, inaccesible para su único consumidor.

**Decisión**: el documento se emite a `apps/api/openapi.json` y se commitea. `pnpm --filter api run openapi` lo regenera; `openapi:check` compara y falla si difiere, y CI lo corre después del build.

**Tres cosas que condicionaron la implementación**:

**1. Corre sobre `dist/`, no sobre las fuentes.** El plugin de `@nestjs/swagger` de `nest-cli.json` es un transformer de compilación: es el que infiere tipos y descripciones de los DTOs. Generar el documento con ts-node saltea el plugin y emite los 25 schemas sin una sola propiedad — un archivo que parece válido y no sirve para nada. Por eso los scripts son `nest build && node dist/swagger/generate-openapi.js`, y por eso el generador vive en `src/swagger/` y no en un `scripts/` en la raíz del paquete: `tsconfig.build.json` ya documenta que un archivo fuera de `src/` corre el `rootDir` inferido un nivel para arriba y desplaza todo el output.

**2. `preview: true` para no necesitar la base.** `PrismaService` pide `DATABASE_URL` en el constructor y abre conexión en `onModuleInit`. Con `NestFactory.create(AppModule, { preview: true })` Nest arma el grafo de módulos y registra los controllers, pero no instancia providers ni corre hooks de ciclo de vida — que es exactamente lo que hace falta, porque Swagger lee metadata de las clases vía Reflect, no de las instancias. Sin esto, generar un contrato HTTP dependería de tener Postgres levantado, que es el mismo problema que la decisión venía a resolver.

**3. El archivo va a `.prettierignore`.** Prettier colapsa los arrays cortos en una línea y `JSON.stringify` no. Con los dos formateando el mismo archivo, cada `format --write` lo dejaría en un estado que `openapi:check` lee como drift. El formato lo fija el generador, que es la única autoridad sobre ese archivo.

**Lo que esto habilita**: los `code` de error dejan de estar solo en los decoradores y desperdigados en este archivo — quedan los 11 en un artefacto legible desde el repo. Y un cambio de contrato aparece en el diff del PR de la API, así que se ve al revisar y no en runtime del otro lado. Se descartó publicar el `.json` como release o exponerlo en un endpoint estático: las dos opciones lo sacan del diff, que es la mitad del valor.

## 2026-09-07 — Generar el cuadro: cerrar la inscripción primero, y escribir el árbol de la final hacia atrás

**Contexto**: `POST /tournaments/:id/bracket` sortea la llave, la persiste entera y arranca el torneo. Tres problemas que no son obvios hasta que se escribe.

**1. El árbol se escribe de la final hacia la primera ronda, una ronda por query.** No es una optimización: `next_match_id` es una FK contra `matches`, así que el partido destino tiene que existir cuando se inserta el que lo apunta. Yendo al revés —de la primera ronda hacia adelante, que es como se lee un cuadro— cada puntero apuntaría a algo que todavía no existe. Se usa `createManyAndReturn` y no `createMany` porque hacen falta los ids recién generados para armar los punteros de la ronda siguiente; con `createMany` habría que pedirlos con un `findMany` más por ronda.

Se descartó insertar todo en una sola query confiando en que Postgres difiere el chequeo de FK al final de la sentencia. Es cierto —los triggers de una FK no diferible corren al terminar el statement, no fila por fila— pero es una sutileza del motor que nadie que lea el código va a tener presente, y el día que alguien parta el insert en dos se rompe sin que ningún test lo explique. El orden explícito se sostiene solo, y tiene un test que lo fija.

**2. El torneo se cierra antes de leer los inscriptos, no después.** Mientras el torneo siga `open`, `TeamsService` acepta inscripciones. Leer las duplas y después cerrar deja una ventana en la que una inscripción que la API ya aceptó queda afuera de un cuadro que ya se generó — y como el cuadro es el único registro del sorteo, esa dupla no aparece en ningún lado.

El cierre es un **compare-and-swap**: `updateMany` con `where: { status: 'open' }`. Si actualiza cero filas, otro request ganó la carrera y la respuesta es `409 bracket_already_exists`. Es lo que ya anticipaba el comentario de `TournamentsService.update` ("cuando existan `in_progress` y `finished` como transiciones reales, esto pasa a ser un `updateMany` condicionado por el estado leído").

**3. Corre en `Serializable`, igual que el alta de duplas, y tiene que ser el mismo nivel.** El aislamiento serializable de Postgres (SSI) solo garantiza serializabilidad **entre transacciones serializables**: si esta corriera en Read Committed, Postgres no tendría cómo detectar el conflicto entre "inscribo una dupla" y "congelo la lista de inscriptos", y el CAS no alcanzaría porque la otra transacción ya tomó su snapshot. Una transacción más débil al lado de una serializable no es "un poco menos segura": deja de haber garantía.

**Otras dos cosas que quedaron decididas acá**:

- **`open → in_progress` no es una transición que el cliente pueda pedir.** No entra en `ALLOWED_STATUS_TRANSITIONS`, así que un `PATCH /tournaments/:id` con `status: 'in_progress'` sigue devolviendo `409 invalid_status_transition`. El estado es una consecuencia de generar el cuadro, no algo que se setee por separado — poder hacerlo a mano permitiría un torneo `in_progress` sin llave.
- **`bracket_already_exists` y no `tournament_not_open`** cuando el torneo ya arrancó. Es el error que de verdad va a pasar (el club aprieta "generar" dos veces) y merece decir eso, no "el torneo no está abierto para inscripciones", que manda a buscar un problema que no existe.

El shape de la respuesta (`BracketResponseDto`) se diseñó pensando en que lo van a reusar el `GET` y después la vista pública: no sale `clubId` de ningún nivel, y las duplas van con `PlayerSummaryDto`, que ya tiene la garantía de no exponer `dni`.

## 2026-09-06 — Un P2002 de Prisma 7 no trae `meta.target`, y eso dejó tres mapeos a 409 sin efecto

**Contexto**: al implementar `PATCH /tournaments/:id/teams/:teamId`, el test e2e del `duplicate_seed` devolvió **500 en vez de 409**. El código mapeaba la violación del índice único leyendo `error.meta.target`, que es la forma clásica del motor de Rust.

**Hallazgo**: Prisma 7 no tiene motor de Rust. Con el driver adapter (`@prisma/adapter-pg`, obligatorio desde la entrada "Prisma 7: setup real") un P2002 llega **sin `target` por ningún lado**:

```
meta: {
  modelName: 'Team',
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '23505',
      originalMessage: 'duplicate key value violates unique constraint "teams_tournament_id_seed_key"',
      kind: 'UniqueConstraintViolation',
      constraint: { fields: ['tournament_id', 'seed'] },
    },
  },
}
```

Las columnas viajan en `cause.constraint.fields` (snake_case), o el nombre del índice en `cause.constraint.index` cuando el adapter no las pudo resolver.

**Por qué no se había notado**: los tres services que mapean P2002 (`PlayersService`, `ClubsService`, `TeamsService`) lo usan como **fallback de carrera**, no como camino normal — un `SELECT` previo da el 409 en el caso común. El fallback solo corre cuando dos requests simultáneos ganan la carrera, que es justo lo que ningún test determinista ejercita. Los tests unitarios tampoco lo agarraban: **mockeaban el error con `meta.target`**, o sea con una forma que en producción no existe. Un mock puede confirmar una suposición equivocada indefinidamente.

**Decisión**: la lectura del índice se centraliza en `common/prisma/unique-violation.ts` (`uniqueViolationTargets` / `uniqueViolationMentions`), que mira las tres formas —`meta.target`, `constraint.fields` y `constraint.index`— y devuelve todo en minúscula. Los tests de ese helper usan la forma real capturada contra Postgres, no una inventada.

**Estado**: los tres services usan el helper (`TeamsService` con `duplicate_team` y `duplicate_seed`, `PlayersService` con `dni_has_account` y `email_registered`, `ClubsService` con `slug_taken` y `club_limit_reached`), y los tres `constraintTarget` privados duplicados dejaron de existir.

Un detalle del de `ClubsService`: el índice `subscriptions_user_id_key` se busca con **dos** fragmentos, `user_id` y `userid`. Son el mismo campo escrito de las dos formas en que puede llegar —la columna, que es lo que reporta el adapter, y `userId` en minúscula, que es lo que llegaría por `meta.target`—, y con uno solo la mitad de las formas caería al 500 igual que antes.

**Regla que queda**: cuando un mock construye un error de una librería, la forma del mock se verifica contra la real al menos una vez. Si no, lo único que se prueba es que el código coincide con lo que creíamos.

Los tests de los tres services ahora tienen las dos formas: la clásica y la del adapter. Se comprobó que los cinco casos de la forma real **fallan** si se rompe el helper a propósito, que es la única manera de saber que un test de regresión regresiona algo.

## 2026-09-05 — Slice 4: el sistema sortea la llave respetando cabezas de serie, y los byes van a las sembradas

**Contexto**: el slice 4 genera la llave. Había que decidir en qué orden entran las duplas al cuadro, y qué pasa cuando la cantidad no es potencia de 2 —que es casi siempre— y sobran lugares.

**Decisión**:

- **El sorteo lo hace el sistema, con cabezas de serie.** `teams.seed` es un `Int?` nullable con `UNIQUE (tournament_id, seed)`: las duplas sembradas van a las posiciones protegidas del cuadro y **el resto se sortea** entre los lugares que quedan. Es el híbrido de los torneos reales. Se descartó el orden de inscripción, que le regalaría el cuadro fácil al que se anotó primero, y se descartó el azar puro, que puede cruzar a las dos mejores en primera ronda y arruinar el torneo antes de empezar.
- **`seed` es editable y no un dato de alta** (`PATCH /tournaments/:id/teams/:teamId`, solo con el torneo `open`): el club decide las cabezas cuando cierra la inscripción y ya sabe quién se anotó. Los `NULL` no colisionan entre sí en el índice único, así que cualquier cantidad de duplas sin sembrar convive.
- **Las cabezas tienen que ser `1..k` sin huecos** al generar, o `409 invalid_seeding`. Con seeds 1, 2 y 7 la posición 3 del cuadro quedaría vacía mientras existe una cabeza 7: es un error del club, no un cuadro que la API deba inventar.
- **Los byes van a las sembradas**, y no hace falta código que los reparta: sale de la secuencia de siembra. Los lugares vacíos son los números de entrada más altos, y cada uno se empareja con el más bajo disponible, así que caen enfrente de las mejores cabezas. Es además la regla real de un torneo, donde el bye es el premio a la siembra.

**Se evaluó y se descartó sortear los byes entre todas.** Suena más justo y es peor: una dupla débil se lleva el pase gratis y las dos mejores pueden cruzarse en primera ronda, que es exactamente lo que la siembra existe para evitar. El bye es inevitable —en eliminación directa el cuadro es potencia de 2 y alguien se saltea la primera ronda—, así que la única pregunta posible es quién, y de los criterios disponibles el sembrado es el menos arbitrario.

**Consecuencias**: con sorteo, borrar y volver a generar da **un cuadro distinto**. Eso es correcto (un resorteo es un sorteo nuevo) pero implica que **el bracket generado es el único registro del sorteo**: no se puede reconstruir, así que borrarlo destruye información irrecuperable. Por eso `DELETE /bracket` exige que no haya ni un resultado cargado.

También cambia cómo se testea el generador: ya no vale "mismo input, mismo output". El barajado entra **inyectado**, los tests usan uno determinista, y lo que se fija son los invariantes que valen siempre — `S−1` partidos, las cabezas en sus posiciones protegidas, ningún bye contra otro bye, y ningún bye en el lado A.

Queda anotado que **la siembra hoy la decide el club a dedo**: no hay ranking, y `players.category` no ordena nada. La mitigación no es cambiar el algoritmo sino que se vea — el cuadro guarda `outcome: 'bye'` y el número de siembra, así que la vista pública puede mostrar quién se salteó la primera ronda y por qué.

## 2026-09-05 — "Esto es la final" no se deriva de que el puntero de avance sea nulo

**Contexto**: al diseñar la carga de resultados, la regla natural es "si el partido no tiene `next_match_id`, es la final, así que cerrá el torneo". Es cierta hoy y sería una trampa mañana.

**Decisión**: la condición se escribe **explícita** desde el primer día, no derivada del puntero nulo.

**Por qué**: el enum `TournamentFormat` existe para admitir formatos nuevos, y el más probable es zonas + llave (muy común en el pádel amateur argentino, y la respuesta natural a "¿por qué el sembrado juega menos partidos?"). Un partido de zona **también** tiene el puntero nulo —no avanza a ningún partido, alimenta una tabla de posiciones—, así que la regla del puntero marcaría un torneo como terminado al cargar el resultado de un partido de grupo. El modo de falla es silencioso y con datos reales adentro.

Cuando exista ese formato se agrega una columna `phase` (`group`/`knockout`), que es aditiva, y la condición pasa a ser "sin puntero **y** de fase knockout".

**Consecuencias**: sirve además como evaluación de cuánto costaría el formato de zonas, que es más aditivo de lo que parece. Se reusan enteros `matches`, `match_sets`, la carga de resultados con su validador de scores de pádel, y todo el patrón de tenancy. Lo genuinamente nuevo son tres cosas: la tabla de posiciones con sus desempates (que se resuelven **solo entre los empatados**, no contra todo el torneo), el algoritmo de cruce de clasificados —el primero de una zona no puede cruzarse con el segundo de la misma en la primera ronda—, y el sorteo de zonas con las cabezas repartidas una por grupo. Además se rompen dos invariantes de hoy: `in_progress ⟺ existe el bracket` (con zonas la llave se genera en el medio del torneo) y `(round, position)` como coordenadas de un árbol.

<a id="billing-fase-3"></a>

## 2026-09-09 — Mercado Pago desde el release inicial. Revisa el cobro manual y la fase diferida.

**Contexto**: el enfoque anterior dejaba los upgrades de los clubes para una fase posterior y suponía una activación manual mientras tanto. Ese circuito tiene dos problemas: el estado de una suscripción paga depende de una operación humana y el producto no valida su flujo comercial real desde el comienzo.

**Decisión**:

- **Todo upgrade de `free` a `basic` o `pro` se cobra con Mercado Pago desde el release inicial.** El panel del club inicia el checkout y el webhook, validado e idempotente, es la única autoridad que activa el plan.
- **No existe cobro ni activación manual.** El plan `free` sigue naciendo `active`; los planes pagos pasan de `pending` a activos solo después de la confirmación del proveedor.
- La idempotencia, la bitácora `payment_events`, la degradación hacia adelante y la cuota por llaves activas ya definidas siguen vigentes. Esta decisión adelanta la integración al release inicial; no cambia esas garantías.

**Consecuencias**: el release inicial requiere checkout, manejo seguro de credenciales, validación de firma del webhook, persistencia idempotente de eventos y transición atómica de `plan`, `max_tournaments` y `status`. La tabla `payment_events` ya está migrada, pero el código de integración aún no existe. Esta entrada reemplaza, para pagos de suscripciones de clubes, la decisión histórica de **cobro manual, pasarela diferida** del 2026-07-16 y cualquier texto que ubique Mercado Pago exclusivamente en una fase 3.

## 2026-09-03 — Fase 3: degradación hacia adelante, cuota simultánea con cobro mensual, y `payment_events` para la idempotencia del webhook

**Contexto**: con el plan `free` explícito (entrada de abajo), el upgrade a plan pago pasó de idea vaga a siguiente paso del modelo de negocio, y entró al alcance como fase 3 en `docs/product-brief.md`. Quedaban tres preguntas que había que cerrar **antes** de escribir el webhook, no después. Se cierran acá.

**Decisión**:

- **La degradación aplica solo hacia adelante.** Un club que deja de pagar vuelve a `free`, pero los torneos en curso siguen vivos hasta que terminen: bajar de plan **nunca** borra ni cierra un torneo. En la práctica el club queda temporalmente por encima de su cuota y la va liberando solo, lo que es correcto — la alternativa es romperle un torneo a jugadores que no tienen nada que ver con la factura. Implica que el chequeo de cuota se mantiene como está (mira el conteo al **crear**, no un estado global de cumplimiento), así que no hay código nuevo que escribir para sostener esto: es una consecuencia de dónde vive el gate, no una regla aparte.
- **Cobro mensual, cuota que sigue contando llaves activas simultáneas.** Son dos ejes distintos y solo cambia el primero. Se descarta la cuota por período que la entrada del 2026-08-25 dejaba como opción aditiva una vez que existiera la fecha ancla de facturación: que ahora se **pueda** no quiere decir que convenga. Un torneo de pádel termina, así que una cuota mensual castigaría al club que organiza todos los fines de semana — el mejor cliente sería el primero en frenarse. La cuota simultánea no limita cuánto se usa el producto, limita cuánta complejidad concurrente sostiene, que es lo que realmente cuesta en datos y en soporte. Cero migración: ya funciona así.
- **`payment_events` es la bitácora que hace idempotente al webhook.** Mercado Pago reintenta cada 15 minutos hasta recibir un `200`/`201`, y después del tercer intento espacia pero sigue (contrato publicado). Los duplicados están **garantizados**, no son un caso raro, y aplicar dos veces el mismo pago es regalar cuota.

**Cómo funciona la idempotencia**, que es la parte que importa:

- La garantía es un `UNIQUE (provider, external_id)` sobre el `id` de notificación, **índice de base y no un `SELECT` previo**: bajo concurrencia dos reintentos simultáneos leerían ambos "no existe" y aplicarían los dos. Es el mismo razonamiento que ya sostiene `subscriptions.user_id` (2026-08-25).
- **`processed_at` es nullable y eso es el diseño, no un descuido.** La fila se inserta **antes** de aplicar el efecto. Si el proceso muere en el medio, queda evidencia de que el pago llegó y todavía no se aplicó; sin esa columna el reintento chocaría contra el `UNIQUE` y se saltearía en silencio, dejando un pago cobrado sin servicio entregado — que es el peor de los dos modos de falla.
- Se guarda el **payload crudo** (`jsonb`). Es lo que permite reprocesar sin haber tenido que adivinar hoy las columnas de una integración que todavía no se escribió.
- Hay un índice por `(provider, type, resource_id)` además del unique, porque MP manda **varias notificaciones distintas sobre el mismo pago** (`payment.created`, `payment.updated`): cortar reintentos es por notificación, pero aplicar el efecto es por recurso.

**Consecuencias**: `payment_events` queda migrada **sin código que la use**, que es una excepción consciente a la regla de `data-model.md` de no adelantar tablas. Se acepta porque su forma no es una apuesta —sale del contrato publicado de MP— y porque la columna `payload` absorbe lo que no se sepa todavía. Las columnas que `subscriptions` necesite para atarse a la preaprobación **no** se adelantan: esas sí dependen de decisiones de integración y entran con el código que las escribe.

`PaymentProvider` nace como enum de un solo valor por la misma razón que `TournamentFormat`: sumar una pasarela después es aditivo y no un cambio de tipo sobre una columna publicada.

<a id="billing-vigente"></a>

## 2026-09-03 — Plan `free` de entrada, con una llave. Revisa "los dos son pagos" del 2026-08-25

**Contexto**: la entrada del 2026-08-25 ("Suscripción por usuario, planes `basic`/`pro`") decidió que **los dos planes son pagos** y que lo gratuito del producto es que el jugador no tenga suscripción en absoluto. Al revisar el slice 3 quedó a la vista que el código no hace eso.

Lo que pasaba de verdad: toda suscripción nacía en `basic` con `max_tournaments = 3` y `status: pending`, y **el chequeo de cuota nunca miró el estado** — lee `maxTournaments` y nada más. Como el cobro es manual y nadie pasa nada a `active`, cualquiera que se registrara y creara un club se llevaba 3 llaves activas, gratis, para siempre.

O sea: **ya había un free tier de tres torneos, sin diseñar**. Y `pending` era una mentira — se leía "esperando pago" y se comportaba como activa. El día que entrara Mercado Pago y se activara el gate por estado, todos los clubes existentes quedaban bloqueados de golpe: no una migración, una caída para toda la base, y justo sobre los que más habían usado el producto.

**Decisión**: hacerlo explícito.

- **Plan `free` nuevo, cupo de 1 llave activa.** Todo club nace ahí. `basic` (3) y `pro` (12) pasan a ser genuinamente pagos, y la afirmación "los dos son pagos" del 2026-08-25 queda revisada: son pagos **los dos de arriba**, y `free` es del club, no del jugador — un jugador sigue sin tener suscripción en absoluto.
- **El cupo gratis es 1 y no 3, y el número está elegido.** La cuota cuenta llaves activas simultáneas, y por la misma entrada del 2026-08-25 un fin de semana real con 4ta, 5ta y 6ta son **tres** llaves. Con tres gratis no existe el momento en que pagar tenga sentido: se regala el producto entero. Con una, el club corre una categoría completa de punta a punta —llave autogenerada, resultados cargados, vista pública andando— y el techo aparece recién cuando quiere su torneo de verdad. Es un trial acotado por alcance y no por tiempo: se siente muestra justa, no castigo.
- **La suscripción `free` nace `active`.** No hay pago que esperar. Eso le devuelve a `pending` su significado real: una suscripción **paga** esperando confirmación. `DEFAULT_SUBSCRIPTION_STATUS` (`apps/api/src/clubs/clubs.service.ts`) lo escribe explícito en el alta.
- **La cuota sigue siendo el único gate; no se agrega un chequeo por `status`.** Un club que pida `basic` y todavía no haya pagado no debe quedar peor que uno gratis. El paso a un plan pago mueve los tres campos juntos —`plan`, `max_tournaments`, `status`— cuando el pago se confirma, nunca la cuota sola. Mientras ese flujo no exista, `pending` no se produce en ningún camino.
- **Los defaults de columna quedan en el menor privilegio**: `plan @default(free)` (una fila sin plan cae en el gratuito, no en uno pago) y `status @default(pending)` (una fila sin estado nace inactiva). El service escribe los tres campos explícitamente, así que los defaults son la red y no el camino normal.

**Consecuencias**: agregar un valor a `subscription_plan` es aditivo y retrocompatible, el mismo argumento que ya se usó para `TournamentFormat`. **No hay backfill**: no existen clubes en producción, y convertir a `free` una hipotética suscripción `basic` real sería degradarla. Las filas viejas de entornos de desarrollo se quedan en `basic`/`pending` y son inocuas.

El momento es deliberado: esto es gratis de decidir hoy y caro cuando haya clubes reales. Queda pendiente para cuando entre Mercado Pago el flujo de upgrade (`free → basic`), que es también donde entra la verificación de que quien creó el club tiene relación con el club real — el hueco de squatting anotado el 2026-08-20 sigue abierto y un plan gratuito le sube el incentivo, lo que es otro argumento para que el cupo gratis sea 1.

## 2026-09-02 — Slice 3: ciclo de vida del torneo, la dupla como inscripción, y la FK compuesta que sostiene el tenancy

**Contexto**: el slice 3 trae `tournaments` y `teams`, las dos primeras tablas con `club_id`. Es donde el guard de tenancy del 2026-08-25 empieza a filtrar algo real, así que las decisiones de forma acá fijan el precedente para `matches` y `courts`.

**Decisión**:

- **Ciclo de vida `open → in_progress → finished`, más `canceled`.** Cada estado hace algo distinto hoy, no en teoría: `open` acepta inscripciones, `in_progress` las rechaza (la llave ya está generada), `finished` y `canceled` son solo lectura. Se descartó `draft` porque en el MVP no se comporta distinto de `open` — y si no consumiera cuota, sería la forma de evadirla. Este slice implementa **solo** `→ canceled` vía `PATCH /tournaments/:tournamentId`; las otras dos las escribe el slice 4. Cualquier otra transición es `409 invalid_status_transition` con `details: { from, to }`. Pedir el estado que el torneo ya tiene también es `409`: la tabla de transiciones válidas no lo incluye, y un no-op silencioso escondería un bug del cliente.
- **La cuota cuenta `open + in_progress`**, coherente con "llaves activas simultáneas" del 2026-08-25. Un torneo terminado o cancelado libera el cupo. La query corre **dentro** de la transacción `Serializable` junto con el `INSERT`, no antes: leer la cuota afuera la sacaría del snapshot y dos `POST` concurrentes podrían pasar los dos.
- **La dupla se expone como `teams`, no como `registrations`.** Un solo nombre de punta a punta —tabla, ruta, y el `matches.team_a_id` del slice 4—, así el frontend aprende un vocabulario en vez de dos. `teams` **es** la inscripción: no hay tabla aparte. Solo dobles en el MVP, y eso está codificado como dos columnas y no como una tabla puente que aceptaría 1 o 3 jugadores.
- **`format` nace como enum de un solo valor** (`single_elimination`). Agregar valores a un enum es aditivo y por lo tanto retrocompatible; la columna existe desde ahora porque ya está en el ERD.
- **`teams.club_id` es una copia denormalizada, y la consistencia la garantiza una FK compuesta.** El vínculo real es `Team → Tournament → Club`: la columna es derivable con un join y se guarda igual para que toda tabla de club responda "¿de quién es esta fila?" con la misma forma, que es lo que hace que el guard no dependa de que cada quien recuerde el join. Pero toda copia admite desfasaje, así que lo cierra la base: `teams(tournament_id, club_id)` referencia `tournaments(id, club_id)`, con un `@@unique([id, clubId])` en `tournaments` como blanco. Una fila cuyo club no sea el de su torneo no entra, venga de la API, de un backfill o de un `psql` a mano. Costo total: un índice único más y una FK.

**Qué va modelado en Prisma y qué va como SQL crudo** — la regla, verificada contra la base y no deducida:

- Una **FK está dentro** de lo que Prisma Migrate administra. Agregada a mano al archivo de migración aparecería como drift en `prisma migrate diff --from-config-datasource --to-schema` (el paso "Check schema drift" de `ci.yml`) y frenaría el PR. Por eso la FK compuesta se modela en `schema.prisma` y sale sola del `migrate dev`.
- Un **`CHECK` no está**: Prisma no lo modela, y el check de drift no lo ve. Comprobado agregando un `CHECK` a mano fuera del schema y corriendo el comando de CI, que devolvió `No difference detected` con exit `0`. Por eso `teams_canonical_order` (`player1_id < player2_id`) se agrega a mano al SQL generado con `migrate dev --create-only`. Ese constraint subsume la regla `player1_id != player2_id` —si son iguales, `<` es falso— y es lo que hace que el índice único `(tournament_id, player1_id, player2_id)` realmente impida que (A,B) y (B,A) entren como dos duplas.

**Consecuencias**: `@@index([tournamentId])` en `teams` **no** existe a propósito — el unique de `(tournament_id, player1_id, player2_id)` ya lo cubre como prefijo izquierdo, y un segundo índice sobre la misma columna solo cuesta escrituras.

Y una trampa que este diseño introduce y hay que conocer: **el orden canónico se calcula en Node comparando strings, pero el `CHECK` compara `uuid` nativo, y los dos órdenes solo coinciden en minúscula**. El orden de `uuid` en Postgres es el de sus 16 bytes; en JavaScript, `'F'` es 70 y `'a'` es 97, así que un id en mayúscula ordena al revés y el `INSERT` muere contra el constraint como `500`. `IsUUID` acepta las dos formas, así que la entrada se normaliza con `normalizeUuid` (`apps/api/src/common/transforms/normalize.ts`) antes de validar, y `canonicalPair` la reaplica para sostener el invariante desde cualquier entry point que no pase por el DTO. Hay tests de regresión unitarios y e2e; si alguien saca la normalización, se rompen.

## 2026-09-02 — Paginación por cursor: `{ items, nextCursor }` es el shape de la API

**Contexto**: `GET /tournaments` es el primer endpoint paginado del proyecto. `docs/api-conventions.md` exigía declarar una estrategia de paginación pero no fijaba ningún formato, así que este slice lo fija como precedente para todos los que vengan.

**Decisión**: **cursor y no offset**, y la respuesta es `{ items, nextCursor }` con `nextCursor: null` en la última página.

- Los ids son UUIDv7, o sea time-ordered: ordenar por `id desc` es ordenar por antigüedad, y el cursor es un `WHERE id < ?` que usa el índice de la PK. Un offset sobre miles de filas escanea y descarta, y además saltea o repite filas cuando se inserta algo entre dos páginas.
- `limit` es 1–100, default 20. Se piden `limit + 1` filas para saber si hay página siguiente sin contar la tabla; la de más se descarta y solo define `nextCursor`.
- La respuesta **no** trae `total`. Contar cuesta un `COUNT` completo en cada página y no lo necesita nadie todavía; agregarlo después es aditivo.

**Consecuencias**: envolver una colección en `{ items, nextCursor }` es un cambio **incompatible** para un endpoint ya publicado (el cliente esperaba un array). Por eso la decisión inversa —`GET /tournaments/:tournamentId/teams` devuelve un array pelado, sin paginar— es deliberada y está anotada: un torneo se juega con decenas de duplas y el frontend necesita la lista completa para dibujar el bracket. El día que un formato admita inscripción masiva, nace un endpoint nuevo en vez de romper ese.

## 2026-08-25 — Tenancy en código: `ClubScopeGuard` + `@ClubId()`, y el club sale del usuario autenticado

**Contexto**: el invariante de tenancy estaba documentado desde el 2026-07-16 pero nunca cableado — no había ninguna entidad con `club_id`. El slice 2 (`clubs`, `subscriptions`) es el que lo estrena, y es también el que fija cómo lo van a consumir los slices 3 y 4.

**Decisión**: el `club_id` se resuelve en tres pasos y ninguno de ellos lee el request.

- **`JwtStrategy.validate` resuelve el club** en el mismo `findUnique` que ya hacía por request para chequear `User.status`: un `select` anidado `clubs: { take: 1, orderBy: { createdAt: 'asc' } }`. Cero queries nuevas. El `orderBy` **no es decorativo**: la relación es 1:N, así que sin orden explícito el tenant de un request dependería del orden de filas que devuelva Postgres. Cuando llegue multi-club, esa es la línea exacta donde se decide cuál es el club activo — no los controllers. Hay un test unitario que lo fija para que nadie lo saque pensando que no hace nada.
- **`ClubScopeGuard`** (`apps/api/src/auth/guards/club-scope.guard.ts`) es síncrono y no toca la DB: lee `request.user.club`, tira `403 club_required` si es `null`, y deja `request.clubId`. Si no hay `request.user` —o sea, alguien lo puso sin `JwtAuthGuard` adelante— falla cerrado con `401`, no deja pasar un request sin scope. **Nunca se registra como `APP_GUARD`**: mataría `/health`, la vista pública y `/auth/*`.
- **`@ClubId()`** (`apps/api/src/auth/decorators/club-id.decorator.ts`) lee `request.clubId` y tira `500` si no está. Un controller que se olvidó el guard es un bug de programación, no un error del cliente, y tiene que romper ruidosamente en el primer request. Podría leer `request.user.club.id` directo, pero entonces cada controller repetiría el chequeo de `null` o pondría un `!`: que el guard estreche el tipo a `clubId: string` es lo que hace que el controller no pueda equivocarse.

Los dos viven en `auth/` y no en `common/` ni en `clubs/`: `common/` es la librería compartida sin dependencias de dominio, y el guard necesita el tipo `AuthenticatedUser`. `AuthModule` ya exportaba `PassportModule` con este caso escrito en su comentario.

Tres reglas derivadas, todas verificables en review: `clubId` es siempre el primer parámetro del método del service; ningún DTO de entrada declara `clubId` ni `ownerId` (con `forbidNonWhitelisted` global, mandarlo es `400 validation`, no un campo ignorado en silencio); y toda lectura de una entidad del club filtra por `club_id` en el `WHERE` aunque ya se tenga el `id` — olvidarse produce cero filas, que es el modo de falla seguro.

**Consecuencias**: `403 club_required` y no `404` para una cuenta autenticada sin club. La cuenta existe; lo que falta es la condición que el endpoint exige. Además deja al frontend con un solo caso a manejar: si `GET /clubs/me` devolviera `404` mientras los endpoints del slice 3 devuelven `403` por el mismo estado subyacente, serían dos ramas para la misma causa. El costo asumido es que un `403` en un `GET` de "mi recurso" se lee raro, y se compensa con que `/auth/me` ya dice `club: null`. `403 club_suspended` queda especificado pero **no emitido**: no hay ningún camino que ponga un club en `suspended`, y meter el chequeo de estado dentro de `ClubScopeGuard` dejaría al dueño sin poder leer su propio club para enterarse de por qué está bloqueado. Cuando exista, entra como un segundo guard componible (`ActiveClubGuard`), aplicado solo a escrituras.

## 2026-08-25 — Suscripción por usuario, planes `basic`/`pro`, y cuota de torneos simultáneos

> **Reemplazada parcialmente:** los planes y defaults de alta se revisaron en [Plan free de entrada](#billing-vigente). La entrada siguiente conserva el contexto original.

**Contexto**: `subscriptions` entra con el slice 2 y el contrato necesitaba tres cosas que el brief no fijaba: qué planes existen, cuánto vale `max_tournaments`, y —lo que faltaba de verdad— **qué cuenta ese número y en qué ventana**.

**Decisión**:

- **La suscripción es del `User` dueño, no del club.** Un dueño con varios clubes (post-MVP) va a tener una sola que los cubre a todos. El `UNIQUE` sobre `subscriptions.user_id` **es permanente**, no una muleta a remover: es la forma real del modelo de facturación, así que el diseño de hoy no genera deuda.
- **Dos planes, `basic` y `pro`, los dos pagos.** No existe plan gratis. Lo gratuito del producto es otra cosa: el jugador **no tiene suscripción en absoluto** — `User.subscription` es opcional y la fila nace recién con el primer club, así que una cuenta sin suscripción es un estado válido y normal, no una cuenta rota. Toda suscripción nace en `basic` y en `status: pending`; el cambio de plan y la activación son manuales (2026-07-16, cobro manual).
- **`basic` = 3, `pro` = 12, contando llaves activas simultáneas.** En el modelo, `tournaments` no tiene `category` y `matches.next_match_id` arma un solo árbol: **un torneo es una llave**, y un evento de fin de semana con 4ta, 5ta y 6ta son tres filas. Por eso el número original que se barajó (1 en `basic`) era inservible: capaba una sola categoría.
- Se descartaron las otras dos ventanas. **De por vida** convierte la cuenta en ladrillo después del primer torneo. **Por período** necesita una fecha ancla de facturación que con cobro manual se desincroniza. **Simultáneos** es un `COUNT` con `WHERE club_id = ? AND status IN (…)`: cero columnas nuevas, y migrar a por-período cuando entre Mercado Pago es aditivo.
- **`max_tournaments` se guarda por suscripción, no se deriva del plan en tiempo de lectura.** Mientras el cobro sea manual hace falta poder dar una excepción a una cuenta puntual sin inventar un plan nuevo. La tabla de cuotas por plan (`PLAN_MAX_TOURNAMENTS` en `apps/api/src/clubs/clubs.service.ts`) se usa solo al crear la suscripción.
- **`subscriptions` no tiene módulo propio ni rutas.** Vive dentro de `ClubsService`: se crea en la misma transacción de Prisma que el club, y separarla obligaría a pasar el handle `tx` a través del límite de módulo, que es peor que la duplicación que evita. Se expone embebida como objeto `subscription` dentro de `ClubResponseDto` — no tiene ciclo de vida propio que el cliente pueda manejar, y toda pantalla del panel que la necesita ya está pidiendo el club. Cuando entre Mercado Pago, `GET /subscriptions/me` y el checkout se agregan como recurso propio **sin sacar** el objeto embebido: aditivo.

**Consecuencias**: `ClubResponseDto.subscription` **no es nullable**, porque todo club nace con su suscripción en la misma transacción. Si el service lee un club sin suscripción (fila insertada a mano por afuera) tira `500`, no `subscription: null` — un `null` ahí obligaría a todo el frontend a manejar un estado que no existe y escondería una corrupción real. Ojo con no confundirlo con la relación en `User`, que sí es opcional. Queda pendiente para el slice 3: `tournaments.status` todavía no tiene sus valores enumerados, y de ese enum depende que la cuota cuente bien. Y queda anotada, sin consumidor todavía, la pregunta que aparece sola el día del segundo club: si una sola suscripción cubre varios clubes, ¿los 12 torneos de `pro` son el total entre todos o 12 por cada uno?

## 2026-08-25 — Un club por cuenta en el MVP, enforceado por el índice único de `subscriptions.user_id`

**Contexto**: el brief fija "una cuenta = un club" en el MVP. El schema, en cambio, soporta varios (`clubs.owner_id` está indexado pero **sin** `@unique`, ver 2026-07-23). Había que decidir dónde vive el cupo.

**Decisión**: el cap de un club es **universal, no depende del plan** — `basic` y `pro` tienen un club cada uno, y lo único que cambia entre planes es el cupo de torneos. No se enforcea con una regla de negocio explícita: lo enforcea de rebote el `UNIQUE` de `subscriptions.user_id`, porque club y suscripción se crean en la misma transacción y la segunda transacción viola ese índice.

Funciona y es robusto bajo concurrencia, pero hay que decirlo en voz alta: es una **regla de producto implementada por un artefacto de facturación**. Coinciden hoy; no siempre. Cuando llegue multi-club cambia el flujo, no la tabla — el primer club crea la suscripción, los siguientes solo crean el club — y ahí el cupo de clubes va a necesitar su propio mecanismo (`max_clubs` más un `COUNT` real, índice parcial, o `SELECT … FOR UPDATE` sobre la fila del usuario).

**No se agrega `max_clubs` ahora**: sería mentira. El `UNIQUE` capea en 1 sin importar qué diga la columna, y quedarían dos fuentes de verdad que se contradicen. Entra el día que se saque el índice, no antes.

**Consecuencias**: el `code` de error se llama **`club_limit_reached`** y no `club_already_exists`, justamente para sobrevivir ese cambio: la cuota MVP es 1 pero es una cuota, no una ley, y renombrar un `code` después cuesta tres PRs (2026-08-20). `POST /clubs` no es idempotente pero es autolimitante: la segunda llamada de la misma cuenta devuelve `409 club_limit_reached`. El `SELECT` de cuota previo **no** es la garantía —dos requests concurrentes lo pasan los dos bajo Read Committed—; existe solo para dar el mensaje correcto en el caso sin carrera, y la violación del índice se mapea al mismo `409` con el patrón `toKnownConflict` de `PlayersService`. Se descartó subir la transacción a `Serializable`: cambia el comportamiento de toda la app para resolver un caso que un índice único ya resuelve. Sin header `Idempotency-Key`: no hay ninguna operación cuyo reintento pueda duplicar algo.

## 2026-08-25 — El slug del club lo deriva el server; el cliente no lo elige

**Contexto**: el contrato original del slice 2 tenía `slug` como campo opcional de entrada en `POST /clubs`, con derivación desde `name` cuando no viniera. Al implementarlo apareció la pregunta de si eso no habilita que cualquier cuenta se quede con el slug de un club que no le pertenece.

**Decisión**: `CreateClubDto` **no declara `slug`**. El server lo deriva siempre desde `name`: `slugify()` (NFD, sin marcas de combinación, minúsculas, no alfanumérico → `-`, colapso, recorte a 50), y si el derivado está tomado prueba `-2`, `-3`… hasta 5 candidatos antes de tirar `409 slug_taken`. El loop es acotado a propósito: un `while` contra un índice único es una forma conocida de colgar un request. Los candidatos que pisan un segmento literal de ruta (`me`, `docs`, `auth`, …) se descartan — un club llamado "Me" derivaría `me`, que ambiguaría `GET /clubs/me` el día que exista `GET /clubs/:slug`.

La razón **no** es el squatting. Sacar el campo no lo arregla: quien quiera `padel-boca` llama a su club "Padel Boca" y lo consigue igual. La razón es que un slug elegido por el cliente sería hoy una decisión permanente sobre algo que no puede ver ni corregir — no hay vista pública que lo muestre (`GET /clubs/:slug` no existe) ni forma de editarlo después (`UpdateClubDto` solo tiene `name`, porque cambiarlo rompe URLs ya publicadas y no hay tabla de redirects). Y la asimetría de 2026-08-20 cierra el caso: **agregar** un campo opcional de entrada más adelante es aditivo y gratis; **sacarlo** una vez shippeado cuesta tres PRs. Se agrega cuando esas dos preguntas tengan respuesta.

**Hueco conocido, anotado a propósito**: `clubs.slug` es único global y `POST /clubs` solo pide `JwtAuthGuard`, así que nada verifica que quien crea un club tenga relación con el club real. Una cuenta puede quedarse con un slug ajeno, y no hay camino de reclamo — no existe `DELETE` ni transferencia de titularidad. Hoy el impacto es bajo: el slug no lo lee ningún endpoint, el club squatteado nace en `pending` y nadie lo activa, y cada slug acaparado cuesta una cuenta con su propio DNI contra un throttle de 5/min por IP. El arreglo real es verificación en el momento de activar la suscripción más un camino de reclamo, y va junto con la vista pública del club, no antes.

**Consecuencias**: `409 slug_taken` sigue existiendo en el contrato —hoy solo lo dispara la derivación al agotar sus intentos—, así que agregar el campo de entrada más adelante no necesita un `code` nuevo. `SLUG_REGEX` y el `@Transform` de normalización de entrada **no** se escribieron: entran el día que exista un campo de entrada que validar. Lo que sí vive ya en `apps/api/src/common/transforms/slug.ts` es `slugify` y la lista de reservados, que la derivación necesita.

<a id="registro-vigente"></a>

## 2026-08-25 — Una sola puerta de registro: todo `User` tiene `Player`

**Contexto**: al diseñar el alta de la cuenta de organizador apareció la pregunta de si un organizador debería registrarse por un camino distinto al del jugador. Hoy el único alta es `POST /auth/register`, que exige DNI y crea `User` + `Player` en la misma transacción (o reclama un `Player` huérfano que un club precargó).

**Decisión**: **una sola puerta de registro.** Todos se registran igual, y `POST /clubs` es simplemente el paso siguiente para quien además quiera administrar un club. No se diseña ni se va a diseñar un segundo camino de alta. Coincide con el modelo de identidad de 2026-07-23: el `User` no tiene rol — "organizador" se deriva de tener un `club`, "jugador" de tener un `player`.

**Esto es un invariante del que depende la corrección de un código de error ya en producción.** `PlayersService.register` responde `409 email_registered` apenas ve el email tomado, **sin mirar si ese `User` tiene `Player`**. Con una sola puerta, esa respuesta siempre es correcta. El bug no está arreglado: **está dormido**, y se despierta el día que alguien agregue un alta que cree un `User` sin `Player` — ahí el mensaje pasaría a mentir. Si eso llega a pasar, `PlayersService.register` tiene que chequear `existingUser.player` antes de tirar el `409`.

**Consecuencias**: todo dueño de club queda con perfil de jugador y DNI, juegue o no. Ese perfil es global y va a aparecer en `/jugadores` con cero torneos; se resuelve más adelante filtrando jugadores sin `teams`. El costo se acepta a cambio de no tener dos caminos de alta que mantener sincronizados, cada uno con su propia versión del dedup por DNI.

<a id="prs-vigente"></a>

## 2026-08-20 — Los PRs no cruzan el límite de paquete: API y frontend son dos PRs coordinados

**Contexto**: `docs/workflow.md` fijaba que los cambios de API y de frontend de una misma feature viajaran en un solo PR, apoyándose en que el monorepo permite revisar y mergear el endpoint junto con la pantalla que lo consume. Eso dejó de describir cómo trabaja el equipo: `apps/web` pasó a ser del equipo de frontend y `apps/api` del lane de backend. Un PR que toca los dos paquetes necesita review de los dos lados, avanza al ritmo del más lento y mezcla en un mismo diff dos revisiones con criterios distintos.

**Decisión**: **un PR toca `apps/api` o `apps/web`, nunca los dos.** Una feature con los dos lados son dos PRs coordinados: primero el de la API, después el del frontend que la consume. De ahí sale la parte que hace que la regla funcione — **el contrato de la API tiene que ser retrocompatible por sí solo**, porque ahora mergea sin su consumidor: campos aditivos, nada de renombrar ni borrar rutas, campos o `code` de error en el lugar, y nada de apoyarse en "el frontend se actualiza en el mismo PR". La superficie de coordinación entre los dos PRs es `/docs` (Swagger, `apps/api/src/swagger/swagger.setup.ts`, 2026-08-14): la API mergea documentada y el frontend consume lo que ese documento describe.

La ventana que el PR único evitaba —un endpoint en `main` que todavía no llama nadie, o un frontend escrito contra el contrato anterior— existe y se acepta: el precio de cerrarla era acoplar el ritmo de los dos equipos, y la retrocompatibilidad la vuelve inofensiva. Se descartó una rama de integración por feature donde converjan los dos PRs: reintroduce una rama de larga vida, que ya se descartó por su cuenta (2026-07-20).

Esta entrada **no revierte** la del 2026-07-16 ("Monorepo con Next.js para el frontend"): la delimita. El monorepo sigue vigente y por las razones que le quedan intactas —docs y agentes compartidos, un solo lockfile, tipos compartibles cuando exista `packages/shared`—; lo que cae es uno de los argumentos de su contexto, "el contrato API↔frontend en un solo PR". El contrato sigue siendo compartido; lo que cambia es que se comparte por `/docs` y no por el diff de un PR único.

**Consecuencias**: `docs/workflow.md` reescribe su regla de PRs y el paso 3 de "El ciclo de una feature con los agentes", que decía "API y UI en la misma rama". El `CLAUDE.md` raíz actualiza su línea de workflow. `docs/api-conventions.md` gana la sección "Evolución del contrato": la retrocompatibilidad pasa a ser propiedad del contrato y no solo del workflow, revisable en el PR de la API como cualquier otra regla. Ningún agente de `.claude/agents/` afirmaba la regla vieja, así que ninguno se toca — la instrucción de `code-reviewer` de revisar `apps/web` cuando el diff lo toca sigue siendo correcta, porque los PRs del equipo de frontend viven en este mismo repo. Un cambio de contrato que hoy sería un renombre se hace en tres pasos (agregar lo nuevo, migrar al consumidor en su propio PR, borrar lo viejo en un tercero), y eso encarece las decisiones de contrato tomadas a la ligera: el momento barato para cambiar un nombre sigue siendo antes de que exista el primer consumidor.

<a id="sesion-vigente"></a>

## 2026-08-17 — Login (API): JWT bearer puro, token único de 7 días, autorización resuelta contra la DB

**Contexto**: `POST /auth/register` (slice 1) crea la cuenta pero no loguea — el login (`POST /auth/login`, `GET /auth/me`) es la pieza que faltaba (`apps/api/AGENTS.md`). Esta entrada cubre el **lado de la API**; el consumo desde `apps/web` (capa `services/`, sesión, cableado del `LoginModal`) es una tarea aparte, todavía sin implementar — ver `apps/web/docs/API.md` para el contrato ya disponible. `apps/web/docs/API.md` dejaba tres huecos explícitos para cuando el login se implementara: dónde vive el token, refresh token y vencimiento de sesión, y protección de rutas privadas. Los primeros dos ya tienen decisión tomada acá (ver abajo); el tercero sigue completamente abierto.

**Decisión**:

- **La API devuelve el JWT bearer puro en el body** (`POST /auth/login` → `{ accessToken, tokenType, expiresIn }`), **sin `Set-Cookie` ni `cookie-parser`** — la API no sabe de cookies ni de CORS. La sesión del lado de `apps/web` va a guardar ese token en una cookie `httpOnly` de su propio origen (patrón BFF: una Server Action recibe el token del body y lo persiste server-side, el JS del browser nunca lo ve). Se elige este patrón sobre que la propia API setee la cookie porque eso exigiría `enableCors({ credentials: true })` + `cookie-parser` + `SameSite=None` entre dos orígenes (`:3000`/`:3001` en dev, dos dominios en un deploy real) solo para servir a un único cliente conocido — acoplamiento evitable. Implementación pendiente en `apps/web`.
- **Un solo access token, TTL de 7 días (`ACCESS_TOKEN_TTL_SECONDS` en `apps/api/src/auth/auth.service.ts`). Sin refresh token, sin tabla de sesiones.** Menos superficie para el MVP, a costa de no poder revocar un token activo antes de que venza — "cerrar sesión" va a poder borrar la cookie del lado de `apps/web`, pero el JWT en sí seguiría siendo válido si alguien lo tuviera. Aceptable a esta escala; revisar si en algún momento hace falta invalidar sesiones (compromiso de cuenta, cambio de contraseña).
- **El JWT lleva solo `sub` (el `userId`). Las relaciones se resuelven contra la DB en cada request**, en `JwtStrategy.validate` (`apps/api/src/auth/strategies/jwt.strategy.ts`) — la misma query que de todos modos hace falta para chequear `User.status`. Esto **matiza** la entrada de 2026-07-23 ("Modelo de identidad y suscripción"), que decía que las relaciones "se resuelven al loguearse y viajan en el JWT": con un token de 7 días sin refresh, viajar en el token las hubiera dejado potencialmente desactualizadas (un jugador que reclama un perfil, o un futuro organizador que crea su club, seguiría sin verlo reflejado hasta volver a loguearse). Con la DB como fuente de verdad, además, un usuario suspendido o borrado pierde el acceso al instante, no en 7 días. El costo es una query por request autenticado — aceptable a esta escala, y es el mismo lugar donde el guard de tenancy del slice de club va a leer el `clubId`.
- **`invalid_credentials` es idéntico (mismo `code`, mismo `message`) para email inexistente y para contraseña incorrecta**, y se corre `bcrypt.compare` contra un hash dummy aun cuando el email no existe (generado una vez en boot con el mismo costo que un hash real — no un literal hardcodeado). Sin esto, `POST /auth/login` sería un oráculo de enumeración de emails registrados, igual que el riesgo ya anotado para `POST /auth/register` (entrada de dedup, 2026-08-11). El chequeo de `status: suspended` corre **después** de validar la contraseña — antes, sería otro oráculo (revelaría que el email existe sin acertarla).
- **Rate limiting con `@nestjs/throttler`** (`5` intentos / `60s` por IP) sobre `POST /auth/login` **y** `POST /auth/register` — la entrada de dedup de jugadores (2026-08-11) lo dejaba asignado a "cuando entre `AuthModule`". Se aplica con `@UseGuards(ThrottlerGuard)` + `@Throttle(...)` por controller, **no** como `APP_GUARD` global: `GET /health` es un readiness probe y no debe throttlearse.
- `BCRYPT_ROUNDS` y el hashing se movieron de `players/players.service.ts` a `common/crypto/password.ts` (`hashPassword`/`verifyPassword`): el login necesita el mismo costo para el hash dummy del punto anterior, así que dejó de ser un detalle solo de `players/`.

**Consecuencias**: el contrato queda listo para consumirse (`accessToken` en el body de `/auth/login`, identidad en `/auth/me`), pero **el consumo desde `apps/web` no es parte de este cambio** — capa `services/`, sesión BFF y el cableado del `LoginModal` quedan para una tarea aparte. La protección de rutas privadas en Next (`proxy.ts` vs. layout guard) sigue sin resolver: no hay ninguna ruta privada real todavía (`/admin` es un placeholder estático sin datos), así que no hay nada concreto que proteger; se decide cuando exista el panel de club o el área de jugador logueado. El storage del throttler es **in-memory**: no sirve tal cual con más de una instancia de la API corriendo (necesitaría un storage compartido, p. ej. Redis) — no es un problema hoy porque no hay deploy multi-instancia, pero queda anotado para cuando lo haya. Igual de pendiente: detrás de un reverse proxy hace falta `app.set('trust proxy', ...)` para que el tracker del throttler vea la IP real del cliente y no la del proxy.

## 2026-08-17 — Datos de perfil del jugador: todos en `players`, país ISO 3166-1 alpha-2 y teléfonos en E.164

**Contexto**: el formulario de registro de `apps/web` (`/register`) se diseñó antes de que hubiera contrato de API para esos campos, y pide seis datos que el backend no tenía dónde guardar: brazo hábil, categoría, país, provincia, celular y teléfono de emergencia. `category` ya existía en `players` desde el slice 1; los otros cinco no, y la pregunta abierta era en qué tabla van — `users` o `players`.

**Decisión**: los cinco campos nuevos van en **`players`**, como columnas nullable, y sin tabla de contacto aparte.

- **No en `users`**, que es solo credencial de login (email + hash + status): quién es organizador o jugador se deriva de tener un `club` o un `player`, no de una columna de rol (2026-07-23, "Modelo de identidad y suscripción"). Además `players.user_id` es nullable a propósito — un jugador precargado por un club, sin cuenta todavía, también tiene teléfono y provincia; si el contacto viviera en `users`, ese perfil no podría tenerlo.
- **Tampoco una tabla `player_contacts` 1:1**: agrega un join en cada lectura de perfil y no compra nada. Sobre una tabla sin datos de producción, columnas nullable son una migración trivial (`ADD COLUMN`, sin reescritura ni default).
- **`country` es un código ISO 3166-1 alpha-2** (`AR`), no el nombre del país. Con texto libre terminan conviviendo "Argentina", "argentina" y "ARG" como tres valores, y después no hay filtro ni agrupación por país que funcione. `province` sí queda texto libre: normalizarla depende del país y no es problema de este slice, igual que `category` (ver "dedup por DNI", 2026-08-11, y el comentario del DTO).
- **Los teléfonos son un solo campo en E.164** (`+5492284123456`), con el código de país adentro. El form los parte en dos controles (select de código + número), pero eso es UI: guardados en dos columnas, cualquier búsqueda o dedup por teléfono tendría que rearmarlos.
- **`dominant_hand` es enum nativo** (`player_hand`: `right`/`left`), mismo criterio que `gender`: valores de wire iguales a los de Prisma, y el copy en español (derecho/izquierdo) se mapea en el cliente.
- **Ninguno de los cinco sale en la respuesta del registro.** `RegisterPlayerResponseDto` devuelve exactamente lo que la vista pública de jugadores va a mostrar sin auth; los datos de contacto no entran ahí, por la misma razón por la que ya se excluía `player.email` — si no, el endpoint se convierte en un lector de datos de contacto ajenos para cualquiera que conozca un DNI.

**Consecuencias**: migración `20260817215027_add_player_profile_fields` (cinco columnas + el enum `player_hand`). El merge del claim en `PlayersService.register` incluye los cinco: solo completan lo que el perfil precargado tenía vacío, y lo que ya cargó el club no se pisa — un campo que entre al `create` y no al claim se descarta en silencio en ese camino, así que la regla queda anotada en el código. La normalización vive en `common/transforms/normalize.ts` (`normalizePhone`, `normalizeCountry`), aplicada en el DTO vía `@Transform` y reaplicada en el service como el resto.

**El formulario todavía no manda nada de esto**: no tiene `action` ni `onSubmit`, y cuando se cablee tiene que emitir `country` como código (hoy es un `<input>` de texto libre) y el celular ya concatenado en E.164. La **posición habitual** que el form también pregunta queda sin persistir a propósito: no estaba en el pedido, y agregarla es una columna más con el mismo tratamiento que `dominant_hand`.

## 2026-08-16 — `GET /health`, y una cuarta clase de endpoint (`ops`)

**Contexto**: la API arranca perfecto con Postgres apagado. El `$connect()` de `PrismaService.onModuleInit` **parece** una verificación de arranque y no lo es: con driver adapter el pool de `pg` es lazy y no abre socket hasta la primera query, así que Nest loguea `successfully started`, `/docs` responde, y el primer síntoma real llega en el primer request que toca la base — un `500 internal_error` cuyo `ECONNREFUSED` queda solo en el log del server. `docs/database.md` además lo documentaba al revés ("`OnModuleInit`/`OnModuleDestroy` para conectar y desconectar el pool"), o sea que un arranque limpio se leía como garantía de que la base estaba.

**Decisión**: se agrega `GET /health` (`src/health/`), que corre un `SELECT 1` y devuelve `200 { status: 'ok', database: 'up' }` o **`503` con `code: 'database_unavailable'`** por el mismo `AppExceptionFilter` de siempre (no un shape propio). **No** se hace fail-fast en el arranque: con Docker de por medio, abortar porque Postgres todavía está booteando mete un race innecesario, y el `compose.yml` ya tiene su healthcheck. El endpoint estrena una cuarta clase, `ops`, para lo que consume la infraestructura y no un usuario ni el frontend — meterlo en `public` (definida como "la vista gratuita para jugadores") habría desdibujado esa clase.

Se descartó `@nestjs/terminus`: para un solo `SELECT 1` agrega una dependencia y, sobre todo, su propio formato de respuesta (`{ status, info, error, details }`), que compite con el shape de error uniforme que fija la entrada "Shape de error uniforme de la API". Si algún día hay varios indicadores (Redis, storage, disco), reconsiderarlo es barato: el contrato de `/health` no cambia.

**Consecuencias**: `API_TAGS` gana `ops` y `docs/api-conventions.md` pasa a listar cuatro clases, con `503` sumado a su tabla de códigos. `/health` es la única ruta que puede no ser un sustantivo plural. El pool sigue **sin** `connectionTimeoutMillis` (default de `pg`: sin límite), así que contra un host que no responde —a diferencia de uno que rechaza— el probe cuelga en vez de dar 503; el lugar para arreglarlo es la config del pool en `PrismaService`, no el controller, y queda pendiente para cuando exista un deploy real. Con la base caída, cada request de health deja un stack en el log (el filtro loguea todo 5xx): con un probe cada pocos segundos, eso es ruido a tener en cuenta.

## 2026-08-14 — Idioma: el código va en inglés, los comentarios y los docs en español

**Contexto**: el repo venía mezclando los dos idiomas sin una regla explícita. `docs/api-conventions.md` fijaba "rutas en español" con `/auth/*` como excepción; el registro de jugador (slice 1) sumó identificadores, códigos de error y mensajes en español (`RegistrarJugadorDto`, `dni_con_cuenta`, `'el DNI ya está asociado a una cuenta'`) conviviendo con los nombres de columna y de modelo, que ya eran inglés desde el schema de Prisma (`firstName`, `birthDate`, `players`). La mezcla obliga a decidir el idioma en cada símbolo nuevo, y produce cosas como un `PlayersService.registrar` o un `players.service.ts` con métodos mitad y mitad.

**Decisión**: **el código va en inglés; los comentarios y la documentación, en español.** En inglés: nombres de archivo, clases, funciones, variables, DTOs, rutas de la API, códigos de error, mensajes de error y descripciones de tests. En español: comentarios de código, `docs/`, `AGENTS.md`/`CLAUDE.md`, mensajes de commit y descripciones de PR. El razonamiento que explica _por qué_ el código hace lo que hace es lo que el equipo lee y discute, y se piensa en español; los identificadores son la parte que se lee junto a NestJS, Prisma y el resto del ecosistema, que es inglés.

Queda derogada la regla de "rutas en español" de `docs/api-conventions.md` — con ella, la excepción de `/auth/*` deja de tener sentido y desaparece. `POST /auth/registro` pasa a `POST /auth/register` antes de que exista un solo consumidor, que es el único momento barato para hacerlo. La entrada de abajo del mismo día ("Los endpoints de la API se nombran en inglés") ya había derogado esa misma regla para las rutas, en paralelo y en otra rama; esta la generaliza al resto del código y la subsume — no la revierte.

**Excepciones, ambas de cara al usuario y ninguna de código**: las URLs públicas de `apps/web` siguen en español (`/torneos`, `/jugadores`, decisión de 2026-08-06 "URLs públicas en español", que sigue vigente) y el copy de la UI también. La API no entra ahí: sus rutas y sus `code` de error son contrato entre programas, no texto que lea una persona.

**Consecuencias**: se renombró todo lo que entró en `feat/registro-jugador` (`RegisterPlayerDto`, `PlayersService.register`, `normalizeEmail`, `IsValidBirthDate`, `NoBcryptTruncation`, y los archivos correspondientes). Los `code` de error pasaron a inglés (`dni_has_account`, `email_registered`, `validation`, `invalid_json`, `internal_error`, …) y los `message` también — el frontend igual no los muestra: mapea el `code` a copy en español. Lo que ya estaba en `main` y es de cara al usuario (rutas y textos de `apps/web`) no se tocó.

## 2026-08-14 — Los endpoints de la API se nombran en inglés; las URLs públicas siguen en español

**Contexto**: `docs/api-conventions.md` daba sus ejemplos de rutas en español (`/torneos`, `/inscripciones`) mientras todo el resto del backend ya estaba en inglés: las tablas (`users`, `players`), los modelos de Prisma, y los tags de OpenAPI que introdujo la entrada de Swagger de hoy (`club`, `public`, `platform`). Además, "URLs públicas en español" (2026-08-06) se leía por proximidad como si también cubriera la API, cuando esa decisión es sobre la navegación de `apps/web`.

**Decisión**: los **endpoints de `apps/api` se nombran en inglés** (`/tournaments`, `/inscriptions`), y con ellos las carpetas de módulo (`src/tournaments/`), los controllers y los DTOs. Las **URLs públicas de `apps/web` siguen en español** (`/torneos`, `/jugadores`). Esta entrada **no revierte** la del 2026-08-06: la delimita — aquella decide navegación, esta decide contrato.

Son criterios distintos porque los lectores son distintos: la URL pública la lee un jugador, es parte del producto y del SEO en español; el endpoint lo lee código, y convive con Prisma, Nest y HTTP, que ya están en inglés. Lo que se descarta es traducir a mitad de camino —un `/torneos` sirviendo un `TournamentsController` sobre la tabla `tournaments`—, que obliga a saber en qué idioma está cada capa antes de escribir una línea.

**Consecuencias**: la traducción entre una superficie y la otra vive en la capa `services/` de `apps/web`, y queda anotada en `apps/web/docs/API.md`: una pantalla no asume que su URL y su endpoint se llamen igual. La prosa sigue en español en todos lados —los docs, los mensajes de commit, y el dominio hablado ("torneo", "inscripción")—; lo que cambia de idioma son los identificadores. **No hay nada que migrar**: todavía no existe ningún endpoint, y por eso se cierra ahora y no cuando haya diez. `docs/agents.md` corrige su ejemplo de path (`apps/api/src/tournaments/`) por la misma razón.

## 2026-08-14 — Documentación de la API con Swagger (`@nestjs/swagger`)

**Contexto**: el contrato de la API está escrito (`docs/api-conventions.md`, specs de `api-designer`) pero no hay nada ejecutable: `apps/web` va a consumir endpoints que solo existen en prosa, y no hay forma de probar una ruta sin escribir el `curl` a mano. Entra **antes** de la primera feature a propósito — retro-documentar diez endpoints cuesta mucho más que nacer documentados, y hoy la superficie es un controller de scaffold.

**Decisión**: `@nestjs/swagger` 11, con estas piezas:

- **El setup es una función, no un módulo de Nest** (`apps/api/src/swagger/swagger.setup.ts`), llamada desde `main.ts` antes de `listen()`. La regla "un módulo por dominio de negocio" no aplica: esto es configuración del bootstrap, y como módulo tendría que resolver el `INestApplication` desde adentro de la app que todavía se está construyendo.
- **UI en `/docs`**, documento en `/docs/json` y `/docs/yaml`.
- **Apagada en producción por default**, con `SWAGGER_ENABLED` como override en los dos sentidos. La doc es de solo lectura pero enumera **toda** la superficie de la API, incluidos los endpoints del club; publicarla es una decisión aparte que se toma cuando exista el hosting (2026-07-16), no un default heredado.
- **Los tags son las tres clases de endpoint** (`club`, `public`, `platform`), exportadas como `API_TAGS` y declaradas con su descripción en el setup. Un tag por clase y no uno por recurso: así la doc se lee como se lee el contrato, y el que escribe un controller tiene que decidir su clase para poder taguearlo.
- **El security scheme `jwt` ya está declarado** aunque no haya auth todavía (2026-07-16, Passport + JWT). Es una línea, y evita que la primera feature autenticada tenga que tocar el setup además de su módulo. El nombre `jwt` es el que van a repetir los `@ApiBearerAuth('jwt')`.
- **El plugin de `@nestjs/swagger` queda activo** en `nest-cli.json` con `introspectComments: true`: los DTOs se documentan solos desde los tipos de TypeScript y el JSDoc, sin un `@ApiProperty` por campo. Un doc que se escribe a mano campo por campo es un doc que se desactualiza.
- **`operationId` sin el sufijo `Controller`** (`Tournaments_findAll` y no `TournamentsController_findAll`), que es lo que termina siendo el nombre del método en un cliente generado. No se usa el `methodKey` pelado —el otro candidato obvio— porque colisiona en cuanto dos controllers tengan un `findAll`, y un `operationId` duplicado hace inválido el documento.
- **Tests**: unitario sobre el gate de habilitación y e2e (`test/swagger.e2e-spec.ts`) que monta el doc sobre el `AppModule` real y verifica versión, tags, security scheme, rutas y que la UI responda. Sin esto, que el documento se rompa no falla nada: en runtime nadie lo consume salvo un humano abriendo el navegador.

**Consecuencias**: `docs/api-conventions.md` gana la sección "Documentación (OpenAPI)" — qué decora cada endpoint pasa a ser regla de contrato, revisable en el PR como cualquier otra. El plugin corre en `nest build`/`nest start` pero **no en ts-jest**, así que un test que construya el documento ve los DTOs sin la metadata inferida (si alguna vez hace falta ahí: `metadataDestination` + `SwaggerModule.loadPluginMetadata()`); queda anotado en `apps/api/AGENTS.md`. Como la doc se monta en `main.ts` y no en `AppModule`, los e2e no la ven salvo que llamen `setupSwagger(app)` explícitamente. `@scarf/scarf` —telemetría que arrastra `swagger-ui-dist`— queda con `allowBuilds: false` en `pnpm-workspace.yaml`: no corre su postinstall. **No** se commitea un `openapi.json` generado ni se generan tipos para `apps/web` a partir del doc; si el frontend los quiere, es una decisión propia y posterior. La validación de DTOs sigue pendiente (`class-validator` + `ValidationPipe`, ver `apps/api/AGENTS.md`): Swagger describe el contrato, no lo hace cumplir — un body inválido lo sigue aceptando la API hasta que exista el pipe.

## 2026-08-11 — Shape de error uniforme de la API

**Contexto**: `docs/api-conventions.md` dejaba pendiente el shape de error ("la primera feature que llegue ahí lo define, y lo documenta acá"). El registro de jugador (slice 1 de `data-model.md`) es esa primera feature con un endpoint real de escritura.

**Decisión**: un filtro global de excepciones (`AppExceptionFilter`, `apps/api/src/common/filters/http-exception.filter.ts`) devuelve siempre las cuatro claves `{ statusCode, code, message, details }`, con `details: null` cuando no aplica — nunca una clave ausente, para que el cliente tipe un solo shape sin `?`. `code` es un identificador estable en inglés snake_case (`dni_has_account`, `email_registered`, `validation`) que el frontend mapea a copy en español; `message` es texto en inglés pensado para debug/logging, no como contrato (ver "Idioma", 2026-08-14). Las excepciones de Nest que no traen `code` propio (`NotFoundException`, guards, etc.) se mapean por status HTTP a través de una tabla fija. Un error de parseo de body (`entity.parse.failed`, JSON mal formado) se mapea a `400 invalid_json` en vez de caer al catch-all genérico. Cualquier excepción no reconocida sale como `500 internal_error` sin stack ni mensaje interno — eso se loguea del lado del servidor (`Logger.error`) y nunca cruza al cliente.

Se registra como provider `APP_FILTER` en `AppModule`, **no** con `app.useGlobalFilters()` en `main.ts`: los tests e2e levantan `AppModule` vía `@nestjs/testing` sin pasar por `bootstrap()` (`apps/api/AGENTS.md`), así que un wiring en `main.ts` dejaría los e2e corriendo sin el filtro — validando un contrato que no es el de producción. Mismo criterio para el `ValidationPipe` global (provider `APP_PIPE`), cuyo `exceptionFactory` (`common/pipes/validation-exception.factory.ts`) ya produce el mismo shape (`code: 'validation'`, `details` como lista de `{ field, messages }` por campo, aplanando los `children` anidados de class-validator).

**Consecuencias**: `apps/web/docs/API.md` tacha "Shape uniforme de error" de su tabla de pendientes. Una excepción nueva que necesite un `code` específico (no el genérico por status) lo pasa como objeto `{ code, message, details? }` al constructor de la `HttpException` de Nest que corresponda (`ConflictException`, `BadRequestException`, etc.) — el filtro lo detecta y lo respeta tal cual, sin reinterpretarlo.

## 2026-08-11 — Dedup de jugadores: clave de match = DNI, no `email` ni `email + DNI`

**Contexto**: "Los jugadores tienen cuenta desde fase 1" (2026-07-23) decidió que el dedup corre en dos puntos —auto-registro del jugador y alta del organizador— pero dejó sin cerrar la clave de match. El alta del organizador no tiene ninguna clave natural más allá de nombre/apellido (no es identificador), así que hacía falta sumar un campo de contacto. Se evaluaron dos alternativas: `email + DNI` con `AND`, y DNI solo.

**Decisión**: la clave de match es el **DNI solo**. `players.dni` es `NOT NULL` y `@unique` — no nullable ni siquiera para el alta del organizador: aunque hoy el registro es la única vía de escritura y su DTO ya lo exige, la columna lo garantiza para cualquier camino futuro que la esquive (import, script, Studio, el alta del organizador cuando exista). El email se sigue pidiendo en el formulario pero es **contacto, no clave de match**: un `AND` contra el DNI no reduce falsos positivos, los aumenta — un typo en cualquiera de los dos campos hace fallar el match completo, y cada match fallido crea un duplicado silencioso en vez de vincular. Un email compartido entre familiares o una pareja tampoco debería fusionar a dos personas distintas, que es lo que un `OR` habría arriesgado.

Reglas derivadas, ya implementadas en el registro (`PlayersService.register`, slice 1, PR `feat/registro-jugador`):

- **Auto-link solo a perfiles sin dueño.** Un DNI que coincide con un `Player` que ya tiene `userId` es `409 dni_has_account`, nunca una vinculación — sin revelar a quién pertenece la cuenta ni en el mensaje ni en ningún otro campo de la respuesta. Sin esta regla, conocer el DNI de otra persona (dato que circula ampliamente) alcanzaría para apropiarse de su historial de torneos.
- **El DNI no sale nunca de la API.** Es dato personal (Ley 25.326) y la vista pública es anónima. Regla dura y sin excepciones: ningún DTO de respuesta lo incluye, en ningún endpoint presente o futuro.
- **El índice único es la garantía real, no el `SELECT` previo.** Dos registros simultáneos con el mismo DNI pasan igual un chequeo con `findUnique`; el service además captura el `P2002` de Prisma sobre el constraint de `dni` (o de `email`) y lo mapea al mismo `409` — el `SELECT` solo existe para dar el mensaje correcto en el caso sin carrera.

**Pendiente, fuera del slice 1**: hoy el auto-link confía solo en la coincidencia de DNI, que es un dato que circula — pero todavía no es explotable, porque nada en el slice 1 crea perfiles sin dueño (esa vía es el alta del organizador, slice 2). Cuando exista, falta decidir cómo se verifica que quien reclama un perfil es realmente su dueño. Dirección evaluada: confirmación por email enviado a la dirección que **ya tenía** el perfil (nunca a la que tipea quien se registra) — es lo único que prueba control real sin generar una cola. Se descartó como _default_ una aprobación manual del organizador en todo claim: el organizador no tiene más información que el sistema para decidir (ve el mismo nombre y el mismo DNI de los dos lados), así que aprobaría siempre, y una cola sin nadie de guardia en un club chico se pudre — su modo de falla es el mismo duplicado que se buscaba evitar. Queda abierto si una aprobación manual tiene lugar como _excepción_ (perfil sin email, o email distinto al del registro). Se cierra junto con el alta del organizador.

Tres riesgos conocidos, anotados acá para no perderlos de vista mientras se define lo de arriba:

- **`players.user_id` tiene `onDelete: SetNull`**: borrar una cuenta deja su `Player` huérfano — una segunda vía hacia el mismo estado que el alta del organizador, alcanzable antes de que exista esa feature (basta con que exista borrado de cuenta). La verificación del claim tiene que cubrir esta vía también, no solo la del organizador.
- **`POST /auth/register` no tiene rate limiting** (no hay `@nestjs/throttler` en el repo todavía). Es un endpoint público de escritura que además funciona como oráculo de enumeración de DNIs (`outcome: 'claimed'` / `409 dni_has_account` / `created` distinguen tres estados) y quema ~100ms de CPU de bcrypt por request. Se resuelve junto con el rate limit de `/auth/login` cuando entre `AuthModule` — no antes.
- **Un `User` existente sin `Player` no puede registrarse como jugador**: `PlayersService.register` da `409 email_registered` apenas ve el email tomado, sin mirar si ese `User` ya tiene o no un `Player`. Inofensivo hoy (no hay otra forma de tener `User` sin `Player`), pero en el slice 2 el staff de un club sí va a ser un `User` sin `Player` — y ese caso choca con esta regla apenas alguien lo pruebe. `docs/data-model.md` ya documenta que "un mismo usuario puede ser ambos"; falta el código que lo permita.

## 2026-08-11 — `bcryptjs` para el hash de contraseñas

**Contexto**: el registro de jugador (slice 1) es el primer código del repo que persiste una contraseña.

**Decisión**: `bcryptjs` — implementación en JS puro, sin binding nativo — en vez de `bcrypt`/`argon2`. Evita depender de un build nativo distinto entre Windows (dev local, según `apps/api/AGENTS.md`) y Linux (CI/prod): con paquetes con binding nativo esa es una fuente típica de "funciona en mi máquina" o de instalaciones que fallan en CI por falta de toolchain de compilación. El costo es rendimiento (más lento que una implementación nativa), irrelevante a la escala del MVP.

**Consecuencias**: `password` en `RegisterPlayerDto` (`apps/api/src/players/dto/register-player.dto.ts`) tiene tope de 72 caracteres — bcrypt trunca en silencio cualquier contraseña más larga que 72 bytes, y se prefiere rechazar con `400` antes que truncar sin avisar. `BCRYPT_ROUNDS = 10` (el costo por default) vive como constante en `players.service.ts`, no en `.env`: no hay necesidad de variarlo por entorno todavía.

## 2026-08-06 — Verificación de Prisma antes de commitear: check de drift en CI + agente `db-verifier`

**Contexto**: con Prisma 7 ya instalado ("Prisma 7: setup real", misma fecha), la CI aplica las migraciones con `prisma migrate deploy` y nada más. Eso deja un hueco concreto: **`migrate deploy` no compara contra `schema.prisma`**, solo aplica el historial de migraciones y valida checksums de lo ya aplicado. En una base recién creada como la de CI no hay historial previo, así que si alguien edita `schema.prisma` sin generar la migración, el check `api` pasa entero — el cliente se genera desde el `.prisma`, no desde el SQL, así que compila y los tests pasan hasta que alguno toca la columna que no existe. El drift aparece recién en el deploy. Tampoco había forma de inspeccionar el estado de las migraciones a mano: no existían `db:status` ni `db:verify`.

**Decisión**: tres piezas, cada una en su nivel.

- **La CI corta el drift** — paso `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, justo después de `migrate deploy` y antes de los tests. Como la base de CI se construye desde cero aplicando las migraciones, compararla contra el `.prisma` **es** comparar migraciones contra schema. Se suma un segundo paso que falla si un PR modifica o borra una migración que ya está en `main` (requiere `fetch-depth: 0`): Prisma no detecta eso por su cuenta, el checksum solo se valida contra bases donde la migración ya corrió.
- **`pnpm run db:verify`** en local — `validate` + `migrate status` + el mismo check de drift, encadenados de lo más barato a lo más caro. Más `db:status` como atajo.
- **Agente `db-verifier`** para lo que un script no hace: interpretar la salida, leer el SQL generado contra el `.prisma`, y los checks de git que ningún comando de Prisma cubre. Read-only a propósito (`Read, Grep, Glob, Bash`, sin `Edit`/`Write`): un agente que "arregla" drift editando una migración ya aplicada produce exactamente el error que existe para prevenir. Diseña `db-architect`, verifica `db-verifier`.

**Consecuencias**: **no se agregan hooks** de git ni de Claude Code, aunque el pedido original era "verificar siempre antes de commitear". El equipo usa herramientas mixtas (Claude Code y Cursor), así que un hook cubriría solo a una parte y le daría a esa parte la falsa sensación de que el repo está protegido; además el check bueno necesita Postgres arriba, y un hook que rechaza el commit de un cambio de docs porque Docker está apagado se desactiva en tres días. La línea de corte queda en CI, consistente con el "nada de `--no-verify`" de `workflow.md`. Quien quiera el hook para sí mismo lo pone en su `.claude/settings.local.json`, que no se versiona (se agregó al `.gitignore`).

`prisma migrate diff --from-migrations` —el check que sería independiente del estado de la base local— queda **descartado**: en Prisma 7 exige `datasource.shadowDatabaseUrl` en `prisma.config.ts` y por lo tanto una segunda base, que el volumen `dupla-pgdata` ya inicializado no crea sola. El check de CI da la misma garantía donde importa. Como contrapartida, **`prisma db push` queda prohibido** en este repo: es el único comando que sincroniza la base sin generar migración, y es lo único que dejaría el check local en verde con drift real. Descartados también por redundantes o inexistentes: `prisma validate` en CI (`generate` ya valida el schema), `migrate status` en CI (la base es nueva en cada run), y `prisma format --check` (no existe en v7).

## 2026-08-06 — Prisma 7: setup real, complementa "PostgreSQL + Prisma" (2026-07-16)

**Contexto**: "PostgreSQL + Prisma" (2026-07-16) dejó la decisión tomada pero sin implementar. Al inicializarlo, la versión instalable ya es **Prisma 7**, que cambió el setup de punta a punta respecto de v6 (el motor de Rust desapareció, reemplazado por un query compiler en WASM). Esta entrada no reemplaza la de 2026-07-16, la completa con lo que exige la versión real.

**Decisión**: se instala Prisma 7.9.1 con estas piezas, no discrecionales — las impone el motor:

- **Driver adapter obligatorio.** `new PrismaClient()` sin adapter tira error en v7. Para Postgres: `@prisma/adapter-pg` + `pg`, instanciado dentro de `PrismaService` con la `connectionString` de `DATABASE_URL`.
- **Generator `prisma-client`** (no `prisma-client-js`), con `output` obligatorio → `apps/api/src/generated/prisma` (adentro de `src/` porque `nest build` solo compila esa carpeta). `moduleFormat = "cjs"` porque Nest es CommonJS y el default de v7 es ESM. `importFileExtension = ""` porque los imports internos del cliente generado con extensión `.js` explícita rompen la resolución de módulos de Jest (`jest-resolve` no aplica el mapeo `.js`→`.ts` que sí entiende `tsc`); vacío, Jest cae al `.ts` real vía `moduleFileExtensions`.
- **`.env` ya no se autocarga.** `apps/api/prisma.config.ts` importa `dotenv` a mano y apunta al `.env` de la **raíz** del monorepo (fuente única; `apps/web` lo va a necesitar también). `prisma generate` tampoco corre solo en `postinstall` de Prisma — se agregó `"postinstall": "prisma generate"` en `apps/api/package.json` como red para clone limpio, más un paso explícito en CI (`prisma generate` antes de Lint/Build) porque el postinstall de un paquete del workspace no se dispara de forma confiable cuando pnpm restaura desde su store cacheado, que es exactamente el escenario de cada run de CI.
- **`@nestjs/config` entra como consecuencia**, no por decisión propia: nada cargaba `.env` en la app (`main.ts` solo leía `process.env.PORT`), y ahora `PrismaService` necesita `DATABASE_URL` resuelto.
- **`timestamptz` en vez de `timestamp`** para las columnas de tiempo — el DDL de referencia en `data-model.md` usaba `TIMESTAMP` como bosquejo para draw.io, no como la migración real.
- **Jest necesita `NODE_OPTIONS=--experimental-vm-modules`** (vía `cross-env` en el script `test:e2e`) porque el query compiler WASM de v7 carga con `import()` dinámico, y Jest —a diferencia de Node en runtime normal— no lo soporta sin ese flag experimental.

**Consecuencias**: el cliente generado (`apps/api/src/generated/`) no se commitea — está en `.gitignore`, `.prettierignore` y en los `ignores` del `eslint.config.mjs` del paquete. La migración inicial (`prisma/migrations/20260806194610_init_users`) confirma la forma que fijó "IDs como UUIDv7" (2026-07-25): `id UUID` sin `DEFAULT`. El invariante de tenancy (2026-07-16) todavía no tiene guard: esta PR solo trae la tabla `users`, sin ninguna entidad con `club_id` todavía, así que el guard que lea el `club_id` del JWT se cablea recién cuando exista auth.

## 2026-08-06 — URLs públicas en español; los route groups no son URLs

**Contexto**: el `Header` de `apps/web` linkeaba `/players` mientras el resto de la navegación pública usaba español (`/torneos`, `/partidos`, `/sedes`, y `/jugadores/seguro` en el `Footer`). Además, la documentación del frontend listaba `/players` como ruta planeada al mismo tiempo que describía el route group `(players)` como área privada del jugador, lo que hacía leer una colisión donde no la hay: en App Router un directorio entre paréntesis **no genera segmento de URL**.

**Decisión**: las rutas públicas se nombran en **español** (`/torneos`, `/partidos`, `/jugadores`, `/sedes`, `/ranking`); el link "Jugadores" del header pasa de `/players` a `/jugadores`. Los **route groups** se siguen nombrando en inglés (`(public)`, `(auth)`, `(players)`, `(customers)`) porque organizan código, no navegación. `(customers)` es el panel del **club** —el tenant que paga—, y en producto y UI se lo llama club, nunca "customer".

**Consecuencias**: el nombre de una carpeta deja de sugerir una URL, así que documentar un route group no compromete el naming de las rutas que cuelguen de él. Queda **pendiente** una inconsistencia previa, sin cerrar acá: la home y el `Footer` enlazan `/clasificaciones` para ranking mientras el `Header` enlaza `/ranking`, que es la que existe — hay que decidir si son la misma pantalla o si una es el ranking histórico (`apps/web/docs/Requirements.md`).

## 2026-08-05 — La documentación viva del frontend vive en `apps/web/docs`

**Contexto**: el frontend mantiene documentación funcional y técnica propia, pero si no se la referencia desde el paquete y no se la indexa en los docs del repo, se vuelve invisible para quien usa agentes o entra por `apps/web/AGENTS.md`.

**Decisión**: la documentación viva del frontend se mantiene en `apps/web/docs/`. `apps/web/AGENTS.md` la referencia como fuente de consulta del paquete, y `apps/web/docs/README.md` actúa como índice principal de esa carpeta. Esos docs describen cómo está construido `apps/web`; cuando algo se contradice con `docs/product-brief.md`, `docs/decisions.md` o `docs/api-conventions.md`, mandan los docs de la raíz.

**Consecuencias**: los cambios funcionales del frontend actualizan esa carpeta en el mismo PR, y cualquier ajuste de alcance o arquitectura del frontend debe seguir reflejándose ahí aunque existan docs raíz del producto y de decisiones técnicas. En particular, `apps/web/docs/API.md` documenta **cómo consume** el frontend, y difiere las reglas del contrato a `docs/api-conventions.md` en vez de duplicarlas.

<a id="ids-vigentes"></a>

## 2026-07-25 — IDs como UUIDv7

**Contexto**: PostgreSQL + Prisma (2026-07-16) dejó abierta la estrategia de `id`. El ERD de referencia (`data-model.md`) los mostraba como `bigint`/`BIGSERIAL` a modo de placeholder, marcando "int vs uuid" como pendiente. Se cierra acá.

**Decisión**: las claves primarias y foráneas de todas las tablas son **UUID versión 7**, no enteros autoincrementales.

- **Por qué UUID**: no expone conteos ni el orden de alta en URLs/recursos (la vista pública es sin auth), los ids se pueden generar en la app sin round-trip a la DB, y no hay colisiones al mergear o importar datos entre entornos.
- **Por qué v7 y no v4**: UUIDv7 es _time-ordered_ (timestamp en los bits altos), así que los inserts caen casi secuenciales y no fragmentan el índice B-tree del PK como hace el v4 aleatorio. Mantiene las ventajas del UUID sin el costo de localidad.
- **Generación app-side**: los genera Prisma con `@default(uuid(7))`, no la base. El Postgres del compose es 17 y la función nativa `uuidv7()` recién llega en PG 18; generar en la app evita depender de la versión del motor o de la extensión `pg_uuidv7`.

**Consecuencias**: en el schema de Prisma los `id` quedan como `String @id @default(uuid(7)) @db.Uuid` (el `@db.Uuid` hace que la columna sea `uuid` nativa y no `text`). Las columnas UUID pesan 16 bytes vs. 8 de un `bigint` — irrelevante a la escala del MVP. El DDL de referencia en `data-model.md` queda en `UUID` y sin `DEFAULT` (el valor lo pone la app). Esto cierra el "int vs uuid" que la decisión de PostgreSQL + Prisma (2026-07-16) dejaba abierto.

## 2026-07-23 — Modelo de identidad y suscripción: `User`, `Player`, `Club`

> **Reemplazada parcialmente:** el registro único se define en [Una sola puerta de registro](#registro-vigente) y la sesión vigente en [Login API](#sesion-vigente). Las afirmaciones originales sobre selección de rol y relaciones en el JWT son históricas.

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

> **Reemplazada parcialmente:** la justificación de API y frontend en un único PR ya no es la política vigente; consultar [PRs por paquete](#prs-vigente). Se mantiene el monorepo.

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

> **Reemplazada parcialmente:** la identidad de jugadores ya no se difiere a fase 2; consultar [registro vigente](#registro-vigente) y [sesión vigente](#sesion-vigente). Se mantiene Passport + JWT.

**Contexto**: los usuarios de fase 1 son staff de clubes — pocos, sin necesidad de social login ni SSO.
**Decisión**: autenticación propia con Passport + JWT (el camino estándar de Nest). Sin proveedor externo.
**Consecuencias**: sin costo por usuario ni dependencia de terceros. La identidad de jugadores (fase 2, inscripción online) se diseñará sobre esta misma base.

## 2026-07-16 — Cobro manual, pasarela diferida

> **Reemplazada para suscripciones de clubes:** Mercado Pago es obligatorio desde el release inicial; ver [Mercado Pago desde el release inicial](#billing-fase-3).

**Decisión**: sin integración de pagos en el MVP. Clubes se activan a mano. Cuando se valide el producto, la pasarela es Mercado Pago (mercado inicial: Argentina).

## 2026-07-16 — Hosting: pendiente

**Estado**: decisión diferida a propósito hasta acercarse al primer deploy. No bloquea el desarrollo.
