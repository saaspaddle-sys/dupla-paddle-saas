# Documentación Frontend — dupla

Este directorio centraliza la documentación funcional y técnica del frontend ubicado en `apps/web`.

## Objetivo

Mantener una fuente única de referencia para:

- onboarding de nuevos devs.
- decisiones de arquitectura frontend.
- alcance funcional de pantallas públicas y privadas.
- criterios de calidad (accesibilidad, performance, responsive).

## Qué vive acá y qué vive en la raíz

Acá se documenta **cómo está construido el frontend**. Lo que aplica a todo el producto vive en la raíz del repo, manda sobre lo de esta carpeta, y no se duplica:

- `docs/product-brief.md` — alcance de producto y fases. Manda sobre `Vision.md`.
- `docs/decisions.md` — decisiones técnicas. Una decisión nueva se registra ahí, nunca solo acá.
- `docs/api-conventions.md` — reglas del contrato de API. Manda sobre `API.md`.
- `docs/workflow.md` — ramas, PRs y CI.
- `apps/web/AGENTS.md` — contexto del paquete (stack, comandos, Next 16).

## Índice

- `Vision.md`: visión de producto y alcance frontend.
- `Requirements.md`: requisitos funcionales y no funcionales.
- `Architecture.md`: estructura de carpetas, patrones y navegación.
- `Frontend.md`: inventario técnico de componentes, layouts y convenciones.
- `API.md`: cómo consume la API el frontend; el contrato sale de `docs/api-conventions.md`.
- `UserManual.md`: guía de uso para usuario final.
- `DesignSystem.md`: sistema visual y lineamientos de UI.
- `ReleaseNotes.md`: historial de cambios por versión.
- `Deployment.md`: despliegue y variables de entorno.

## Estado actual

- Stack: Next.js 16.2.10 + React 19 + Tailwind CSS v4.
- App Router con route groups (`(public)`, `(auth)`, `(players)`, `(customers)`) y segmentos reales (`admin`, `auth`).
- Rutas que existen hoy: `/`, `/register`, `/ranking`, `/admin`, `/auth/register`.
- Integración con backend: aún no implementada.
- Autenticación real: aún no conectada a la API; hay pantallas y flujos de UI en construcción.

## Convenciones de mantenimiento

- Actualizar `ReleaseNotes.md` en cada cambio funcional relevante.
- Reflejar decisiones de estructura en `Architecture.md`.
- No documentar contratos de API inventados: `API.md` describe el consumo del lado del cliente y difiere el contrato a `docs/api-conventions.md`.
- Una decisión técnica nueva va a `docs/decisions.md` en el mismo PR que la introduce (`docs/workflow.md`).
- Usar el vocabulario del dominio de `docs/product-brief.md`: **club** (el tenant que paga), **staff del club**, **jugador** (perfil global de la plataforma).
