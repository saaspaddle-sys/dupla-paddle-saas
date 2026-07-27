# API Frontend Contract (Placeholder)

Este documento describe como el frontend consumira la API cuando el backend comparta el contrato definitivo.

## Estado actual

- A la fecha, no hay endpoints integrados en `apps/web`.
- No existe aun cliente HTTP centralizado en frontend.
- El login/registro visual todavia no esta conectado al backend.

## Convenciones propuestas de consumo

1. Base URL por entorno:

- `NEXT_PUBLIC_API_BASE_URL`

2. Formato esperado de respuesta exitosa (propuesto):

```json
{
  "data": {},
  "meta": {
    "requestId": "string"
  }
}
```

3. Formato esperado de error (propuesto):

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

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
