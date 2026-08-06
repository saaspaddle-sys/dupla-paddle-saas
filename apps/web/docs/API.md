# Consumo de API desde el frontend

Cómo `apps/web` va a consumir la API. **Las reglas del contrato no se definen acá**: viven en [`docs/api-conventions.md`](../../../docs/api-conventions.md) y son la fuente de verdad para ambos paquetes. Este documento cubre solo el lado del cliente.

## Estado actual

- No hay endpoints integrados en `apps/web`.
- No existe cliente HTTP centralizado en el frontend.
- El login y el registro son UI: todavía no están conectados al backend.

## Lo que ya está definido (no lo redefinas acá)

De `docs/api-conventions.md`, y aplica al frontend aunque lo implemente el backend:

- **Rutas REST con sustantivos en plural y kebab-case** (`/torneos`, `/inscripciones`), con un nivel de anidamiento como máximo.
- **Tres clases de endpoint**, y el frontend consume cada una distinto:
  1. **Del club** — requiere JWT del staff. Son las pantallas del panel del club.
  2. **Público** — sin auth, solo lectura. Es la superficie que ve la mayoría de los jugadores.
  3. **De plataforma** — operaciones sobre `Player`, que es global.
- **Códigos de error HTTP**: `400` validación, `401` sin autenticar, `403` autenticado sin permiso, `404` no existe, `409` conflicto. El manejo de errores del cliente se construye sobre estos códigos, no sobre strings de mensaje.

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

| Tema                                                             | Estado                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Shape uniforme de error                                          | Lo define la primera feature que llegue ahí, y lo documenta en `docs/decisions.md` |
| Almacenamiento del token (cookie `httpOnly` vs. storage cliente) | A decidir con el backend; va a `docs/decisions.md`                                 |
| Refresh token y vencimiento de sesión                            | A decidir con el backend                                                           |
| Protección de rutas privadas en Next (proxy vs. layout guard)    | A decidir; ver `node_modules/next/dist/docs/01-app/02-guides/` antes de elegir     |
| Paginación de listas que crecen sin techo                        | La declara la spec de cada endpoint (`docs/api-conventions.md`)                    |

## Endpoints

Ninguno integrado todavía. Cuando se diseñe una feature, el contrato lo produce el agente `api-designer` (ver `docs/agents.md`) siguiendo `docs/api-conventions.md`; acá se documenta cómo lo consume el frontend, no el contrato en sí.
