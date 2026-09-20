# Brechas de entrega de la Fase 1

La Fase 1 todavía no está lista para cerrarse. El backend autenticado permite administrar jugadores, clubes, torneos, duplas, llaves y resultados, y la integración de Mercado Pago cubre el ciclo de billing. La brecha principal restante es la experiencia pública anónima; además falta conectar el frontend con el flujo de suscripciones.

Este documento compara el alcance vigente de [product-brief.md](./product-brief.md) con el código, las migraciones y el contrato OpenAPI actuales. No reemplaza una verificación de runtime en un entorno desplegado.

## Resumen ejecutivo

| Área                                 | Estado                        | Falta para cerrar                                                |
| ------------------------------------ | ----------------------------- | ---------------------------------------------------------------- |
| Registro/login de jugadores          | Backend entregado             | Verificación final del recorrido web.                            |
| Gestión de jugadores por organizador | Backend entregado             | Verificación final del recorrido web.                            |
| Torneos, duplas y llaves             | Backend autenticado entregado | Verificación final de UI y regresión E2E.                        |
| Resultados y avance automático       | Backend entregado             | Verificación final de UI y regresión E2E.                        |
| Mercado Pago                         | Backend implementado          | Sincronizar OpenAPI, integrar UI y ejecutar evidencia E2E final. |
| Vista pública anónima                | No implementada               | API pública segura, UI y filtros de torneos, llaves y jugadores. |

## Capacidades implementadas

### Flujo autenticado del organizador

- Registro y login.
- Alta, consulta y edición del club propio.
- Alta y búsqueda de jugadores sin duplicar el perfil global por DNI.
- Creación y administración de torneos.
- Inscripción, edición, siembra y eliminación de duplas.
- Generación, consulta y eliminación segura de la llave.
- Registro de resultados y avance automático.
- Control de la cuota de llaves activas mediante `maxTournaments`.

### Billing con Mercado Pago

- `GET /subscriptions/me` para consultar el derecho efectivo.
- `POST /subscriptions/me/checkouts` para crear o reutilizar una Preapproval mensual.
- Reserva durable y recuperación por referencia ante resultados ambiguos.
- `POST /webhooks/mercado-pago` público con validación HMAC.
- Consulta canónica de `authorized_payments` antes de conceder derechos.
- Idempotencia por notificación y recurso cobrado.
- Activación transaccional de plan, cuota, estado y período pagado.
- Renovaciones, `past_due`, vencimiento, cancelación y tombstones.
- Reconciliación periódica con lease distribuido en PostgreSQL.

El diseño completo está en [mercado-pago-integration.md](./mercado-pago-integration.md).

## Brechas bloqueantes

### 1. Vista pública anónima

El brief exige que jugadores y espectadores puedan navegar sin login. Actualmente las rutas de torneos, duplas, llaves y partidos pertenecen al panel autenticado y exponen DTOs pensados para el organizador.

Falta entregar:

- listado público y filtrable de torneos;
- detalle público del torneo y su club;
- llave pública con resultados y avances;
- búsqueda pública y filtrable de jugadores;
- DTOs públicos que no filtren DNI, contacto, billing ni datos internos del tenant;
- páginas web públicas con estados vacío, carga, error y recurso inexistente.

#### Criterios de aceptación

- [ ] Un visitante sin JWT puede listar y filtrar torneos.
- [ ] Puede abrir un torneo y seguir su llave completa.
- [ ] Puede buscar jugadores sin acceder a datos privados.
- [ ] Los endpoints públicos tienen contratos y proyecciones propios.
- [ ] La UI pública funciona sin redirección al login.

### 2. Integración web de suscripciones

El backend de Mercado Pago existe, pero `apps/web` todavía no inicia checkout ni cancelación y sigue leyendo la suscripción embebida en el club.

Falta entregar:

- selección de `basic` o `pro` desde el panel;
- redirección al `checkoutUrl`;
- pantalla de retorno que trate el pago como pendiente;
- refresco de `GET /subscriptions/me` hasta obtener el derecho efectivo;
- manejo de errores recuperables y conflictos de checkout;
- confirmación explícita antes de cancelar.

#### Criterios de aceptación

- [ ] El cliente nunca envía precio, moneda, owner, club ni estado del pago.
- [ ] El retorno del navegador no activa ni confirma el plan.
- [ ] Un checkout ambiguo no ofrece crear un segundo mandato.
- [ ] La UI refleja la cuota solo después de la confirmación canónica.
- [ ] Cancelar vuelve la cuenta al derecho gratuito sin borrar torneos existentes.

## Gates técnicos antes de commitear billing

- [ ] `pnpm --filter api exec eslint "{src,test}/**/*.ts" --max-warnings 0`.
- [ ] `pnpm --filter api run typecheck`.
- [ ] `pnpm --filter api exec jest --runInBand`.
- [ ] `pnpm --filter api run test:e2e` con PostgreSQL real.
- [ ] `pnpm run db:verify` sin migraciones pendientes ni drift.
- [ ] `pnpm --filter api run openapi:check` con `apps/api/openapi.json` regenerado.
- [ ] `pnpm --filter web run lint` y `pnpm --filter web run build`.

## Orden de cierre recomendado

1. Dejar el bloque de Mercado Pago en verde y commitearlo por unidades de comportamiento.
2. Implementar la UI autenticada de suscripciones sobre el contrato versionado.
3. Diseñar y entregar la API pública con proyecciones seguras.
4. Construir la experiencia pública y sus filtros.
5. Ejecutar la evidencia E2E completa de organizador, jugador, espectador y upgrade pago.
6. Recién entonces marcar la Fase 1 como cerrada.

## Fuera de alcance de la Fase 1

- Autoinscripción online de un jugador a un torneo.
- Canchas, horarios y conflictos de programación.
- Rankings cross-club.
- Operación multi-país o multi-moneda.
