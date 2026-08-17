# Consumo de API desde el frontend

Cómo `apps/web` va a consumir la API. **Las reglas del contrato no se definen acá**: viven en [`docs/api-conventions.md`](../../../docs/api-conventions.md) y son la fuente de verdad para ambos paquetes. Este documento cubre solo el lado del cliente.

## Estado actual

- No hay endpoints integrados en `apps/web`.
- No existe cliente HTTP centralizado en el frontend.
- El login y el registro son UI: todavía no están conectados al backend.

## Lo que ya está definido (no lo redefinas acá)

De `docs/api-conventions.md`, y aplica al frontend aunque lo implemente el backend:

- **Rutas REST con sustantivos en plural, en inglés y en kebab-case** (`/tournaments`, `/registrations`), con un nivel de anidamiento como máximo. Ojo con la asimetría, que acá es donde se siente: las **URLs públicas de Next siguen en español** (`/torneos`, `/jugadores`) y el endpoint que las alimenta va en inglés (`/tournaments`) — es el código el que va en inglés, no la navegación (`CLAUDE.md` raíz, sección "Idioma"). La capa `services/` es la que traduce; una pantalla no asume que su URL y su endpoint se llaman igual.
- **Tres clases de endpoint**, y el frontend consume cada una distinto:
  1. **Del club** — requiere JWT del staff. Son las pantallas del panel del club.
  2. **Público** — sin auth, solo lectura. Es la superficie que ve la mayoría de los jugadores.
  3. **De plataforma** — operaciones sobre `Player`, que es global.
- **Códigos de error HTTP**: `400` validación, `401` sin autenticar, `403` autenticado sin permiso, `404` no existe, `409` conflicto. El manejo de errores del cliente se construye sobre estos códigos y sobre el `code` del body (inglés, estable), **no** sobre el `message` — ese viene en inglés y es para debug/logging. El copy en español que ve el usuario lo pone el frontend, mapeando el `code`.

## Invariante de tenancy — la regla que no se rompe

**El frontend nunca manda un `club_id`.** En los endpoints del club, el scoping sale del `club_id` del usuario autenticado que el backend lee del JWT — nunca de un valor del body, params o query. Un club viendo datos de otro es el peor bug posible de este producto (`docs/decisions.md`, tenancy 2026-07-16).

En la práctica, para quien escriba la capa `services/`:

- No agregues `club_id` a un payload ni a un query string de un endpoint del club, aunque lo tengas a mano en el cliente.
- Las pantallas del club consumen datos que **ya vienen filtrados**. No filtres por club en el cliente ni asumas que podés pedir los de otro.
- Si un endpoint del club parece necesitar un `club_id` explícito, el problema está en el contrato: se discute con el backend antes de implementarlo.

`Player` es la excepción del modelo: es global y no tiene `club_id` (`docs/decisions.md`, jugadores globales 2026-07-16).

## Convenciones del lado del cliente

1. **Base URL por entorno**: `NEXT_PUBLIC_API_BASE_URL`.
2. **Capa `services/`**: las llamadas HTTP se centralizan ahí. Los componentes no llaman `fetch` directo.
3. **Tipos de respuesta**: tipados en el frontend, sin `any`. Cuando exista `packages/shared` los tipos se comparten con `apps/api` en vez de duplicarse (ver `docs/workflow.md`).
4. **Superficie pública sin auth**: las pantallas públicas no deben arrastrar code paths que dependan de sesión.

## Pendiente de definición

Lo que realmente falta, con dónde se va a registrar cuando se decida:

| Tema                                                             | Estado                                                                                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape uniforme de error                                          | **Resuelto** — `{ statusCode, code, message, details }`, siempre las cuatro claves. `docs/decisions.md`, "Shape de error uniforme de la API" |
| Almacenamiento del token (cookie `httpOnly` vs. storage cliente) | A decidir con el backend; va a `docs/decisions.md` cuando se implemente el login (`/auth/login`)                                             |
| Refresh token y vencimiento de sesión                            | A decidir con el backend                                                                                                                     |
| Protección de rutas privadas en Next (proxy vs. layout guard)    | A decidir; ver `node_modules/next/dist/docs/01-app/02-guides/` antes de elegir                                                               |
| Paginación de listas que crecen sin techo                        | La declara la spec de cada endpoint (`docs/api-conventions.md`)                                                                              |

## Endpoints

Ninguno integrado en `apps/web` todavía — este documento sigue describiendo solo el lado del cliente, ver "Estado actual" arriba. Un contrato ya existe del lado de la API y está listo para consumirse cuando se construya la pantalla:

- **`POST /auth/register`** — de plataforma, sin auth. Registra un jugador; según el DNI, crea un perfil nuevo o reclama uno que ya había cargado un club (dedup, `docs/decisions.md`). Devuelve `201` con `{ outcome: 'created' | 'claimed', user: { id, email }, player: { id, firstName, lastName, category, gender, createdAt } }`. **Con `outcome: 'claimed'`, `firstName`/`lastName`/`category` no son necesariamente un eco de lo que mandó el form** — pueden ser los datos que cargó el club al pre-inscribir al jugador; la UI puede usar esto para mostrar "ya teníamos tu perfil". Nunca incluye `dni` ni `passwordHash`, ni los datos de contacto del perfil. Errores relevantes: `409 email_registered`, `409 dni_has_account`, `400 validation`.

  Body: `email`, `password`, `dni`, `firstName` y `lastName` son obligatorios; `gender`, `birthDate`, `category`, `dominantHand`, `country`, `province`, `phone` y `emergencyPhone` son opcionales. Tres formatos que el form tiene que respetar, porque un valor mal formado es un `400 validation` y no un guardado silencioso (`docs/decisions.md`, 2026-08-17):
  - `country` es el **código ISO 3166-1 alpha-2** (`AR`), no el nombre del país. El `<input>` de texto libre que hay hoy en `/register` tiene que pasar a un `<select>` que emita el código.
  - `phone` y `emergencyPhone` van en **E.164**, un solo string con el código de país adentro (`+5492284123456`). El form muestra el código y el número por separado: los concatena antes de mandar. Espacios, guiones, puntos y paréntesis se limpian del lado de la API, así que `+54 9 2284 12-3456` también entra.
  - `gender` (`male`/`female`) y `dominantHand` (`right`/`left`) viajan en inglés; el copy en español del form se mapea acá, en la capa `services/`.

El resto de una feature nueva sigue el flujo habitual: el contrato lo produce el agente `api-designer` (ver `docs/agents.md`) siguiendo `docs/api-conventions.md`; acá se documenta cómo lo consume el frontend, no el contrato en sí.
