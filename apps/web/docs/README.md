# Documentacion Frontend - dupla

Este directorio centraliza la documentacion funcional y tecnica del frontend ubicado en `apps/web`.

## Objetivo

Mantener una fuente unica de referencia para:

- onboarding de nuevos devs.
- decisiones de arquitectura frontend.
- alcance funcional de pantallas publicas y privadas.
- criterios de calidad (accesibilidad, performance, responsive).

## Indice

- `Vision.md`: vision de producto y alcance frontend.
- `Requirements.md`: requisitos funcionales y no funcionales.
- `Architecture.md`: estructura de carpetas, patrones y navegacion.
- `Frontend.md`: inventario tecnico de componentes, layouts y convenciones.
- `API.md`: contrato de consumo de API, pendiente de definicion backend.
- `UserManual.md`: guia de uso para usuario final.
- `DesignSystem.md`: sistema visual y lineamientos UI.
- `ReleaseNotes.md`: historial de cambios por version.
- `Deployment.md`: despliegue y variables de entorno.

## Estado actual

- Stack: Next.js 16.2.10 + React 19 + Tailwind CSS v4.
- App Router activo con route groups (`(public)`, `(auth)`, `(players)`, etc.).
- Integracion con backend: aun no implementada.
- Autenticacion real: aun no conectada a API; existen pantallas y flujos UI en construccion.

## Convenciones de mantenimiento

- Actualizar `ReleaseNotes.md` en cada cambio funcional relevante.
- Reflejar decisiones de estructura en `Architecture.md`.
- No documentar contratos inventados de API: usar `API.md` como placeholder hasta recibir contrato real.
