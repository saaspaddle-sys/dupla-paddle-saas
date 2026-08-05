# API Frontend Contract (Placeholder)

Este documento describe como el frontend consumira la API cuando el backend comparta el contrato definitivo.

## Estado actual

- A la fecha, no hay endpoints integrados en `apps/web`.
- No existe aun cliente HTTP centralizado en frontend.
- El login/registro visual todavia no esta conectado al backend.

## Convenciones de consumo

1. Base URL por entorno:

- `NEXT_PUBLIC_API_BASE_URL`

2. Formato de respuesta exitosa:

- pendiente de definicion por el backend y de registro en `docs/decisions.md`.

3. Formato de error:

- pendiente de definicion por el backend y de registro en `docs/decisions.md`.

4. Responsabilidad del frontend:

- documentar como consume la API, no imponer el shape final de respuestas.

## Autenticacion (pendiente)

Definir junto al backend:

- estrategia JWT para frontend.
- almacenamiento de token (cookie/httpOnly vs storage cliente).
- refresh token y vencimientos.
- rutas protegidas y comportamiento al expirar sesion.

## Endpoints

Pendiente de definicion oficial por backend.

Tabla a completar cuando se entregue contrato:

| Modulo    | Metodo | Ruta | Auth | Request | Response | Errores |
| --------- | ------ | ---- | ---- | ------- | -------- | ------- |
| Auth      | -      | -    | -    | -       | -        | -       |
| Torneos   | -      | -    | -    | -       | -        | -       |
| Partidos  | -      | -    | -    | -       | -        | -       |
| Jugadores | -      | -    | -    | -       | -        | -       |

## Ejemplos de uso en frontend

Pendiente de implementacion de capa `services/`.
