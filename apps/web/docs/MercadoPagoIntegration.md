# Integración frontend de suscripciones con Mercado Pago

Esta guía describe **cómo debe integrarse** la facturación en apps/web con los endpoints actuales de apps/api. Es una especificación para implementar y validar el frontend; **no implica que la pantalla ya esté implementada ni que el flujo haya sido validado en sandbox**.

> Fuente de verdad: GET /subscriptions/me. El retorno del navegador, un checkoutUrl o reused: true **no prueban** que un pago fue aprobado. El backend aplica los cambios después de verificar los eventos y el estado canónico en Mercado Pago.

## Recorrido rápido

1. Leer GET /subscriptions/me con el JWT de la cookie httpOnly desde el servidor.
2. Mostrar solo las acciones compatibles con el estado efectivo y las operaciones pendientes.
3. Para cobrar, pedir al backend un checkout y navegar a su checkoutUrl validada.
4. Al volver de Mercado Pago, consultar otra vez GET /subscriptions/me. Si aún no cambió el estado, informar que se está verificando y permitir actualizar.
5. Para baja o reanudación, ejecutar el endpoint correspondiente y volver a leer el estado. No actualizar el plan de forma optimista.

Todos los endpoints de esta guía requieren JWT y que la cuenta administre un club. El contrato autoritativo es [OpenAPI](../../../apps/api/openapi.json).

## Contratos

Las fechas llegan como ISO 8601. Los importes son strings decimales con dos cifras; **no convertirlos a float para enviarlos de vuelta**.

~~~ts
type Plan = "free" | "basic" | "pro";
type Status = "pending" | "active" | "past_due" | "canceled";

type Subscription = {
  plan: Plan;
  status: Status;
  maxTournaments: number;
  currentPeriodEndsAt: string | null;
  renewsAutomatically: boolean;
  pendingUpgrade: null | {
    state: "creating" | "pending" | "paid" | "review_required";
    reference: string;
    amount: string;
    currency: string;
    checkoutUrl: string | null;
    periodEndsAt: string;
  };
  pendingDowngrade: null | DowngradeQuote;
};

type DowngradeQuote = {
  targetPlan: "basic";
  amount: string;
  currency: string;
  effectiveAt: string;
};

type UpgradeQuote = {
  targetPlan: "pro";
  amount: string;
  recurringAmount: string;
  currency: string;
  periodEndsAt: string;
};
~~~

| Endpoint | Entrada | Resultado y uso |
| --- | --- | --- |
| GET /subscriptions/me | — | Subscription efectivo. Leer sin caché después de cada operación y en el retorno. |
| POST /subscriptions/me/checkouts | { "plan": "basic" \| "pro" } | Checkout recurrente nuevo o reutilizado: plan, reference, checkoutUrl, reused. Para iniciar desde Free o retomar un checkout pendiente del mismo plan; **no** para Basic → Pro. |
| GET /subscriptions/me/upgrade-quote?targetPlan=pro | — | UpgradeQuote. amount es el pago único proporcional por el período actual; recurringAmount es el importe de futuras renovaciones Pro. No cobra ni activa Pro. |
| POST /subscriptions/me/upgrade | { "targetPlan": "pro", "expectedAmount": "7500.00" } | Devuelve UpgradeQuote más reference, checkoutUrl y reused. El pago único inicia la mejora inmediata; Pro se activa **después de confirmar ese pago**, no en la próxima renovación. |
| GET /subscriptions/me/downgrade-quote?targetPlan=basic | — | DowngradeQuote. Informa el importe Basic de la próxima renovación y effectiveAt; no modifica el plan. |
| POST /subscriptions/me/downgrade | { "targetPlan": "basic" } | Programa el cambio y devuelve DowngradeQuote. Pro permanece hasta el final del período pagado; no se abre checkout ni hay cobro inmediato. |
| POST /subscriptions/me/cancel | — | 200 sin cuerpo: detiene la renovación automática, **no** termina el período ya pagado. |
| POST /subscriptions/me/resume | — | 200 sin cuerpo: reanuda la renovación pausada si el período pagado sigue vigente. |

### Basic → Pro: precio confirmado por el usuario

1. Mostrar amount, currency, periodEndsAt y recurringAmount de la cotización.
2. Cuando la persona confirme, enviar **exactamente** quote.amount como expectedAmount, conservando sus dos decimales. No recalcularlo en el navegador.
3. Si POST responde 409 upgrade_quote_changed, obtener una nueva cotización y pedir **otra confirmación explícita** antes de reintentar. No cobrar automáticamente el nuevo valor.
4. Validar checkoutUrl y navegar a Mercado Pago. Mantener Basic visible mientras pendingUpgrade no se aplique.
5. En el retorno, volver a leer GET /subscriptions/me. Solo mostrar Pro cuando el backend lo devuelva como plan efectivo.

El prorrateo usa el inicio del día de facturación en America/Argentina/Buenos_Aires (sin retroceder antes del inicio del período). Por eso la cotización permanece estable dentro del día si no cambian los datos de facturación, pero puede cambiar al comenzar otro día. El backend compara expectedAmount con el importe vigente antes de crear o reutilizar el pago.

Interpretación de pendingUpgrade:

| state | Experiencia |
| --- | --- |
| creating | Checkout en preparación; esperar y actualizar, sin disparar pagos paralelos. |
| pending | Pago pendiente; permitir retomar el checkout si el backend lo devuelve como reutilizable. |
| paid | Pago recibido, activación en verificación; no ofrecer otro pago. |
| review_required | Excepción financiera: pedir contacto con soporte, sin prometer activación ni repetir el cobro. |

### Pro → Basic: cambio programado

Mostrar el importe y effectiveAt de GET downgrade-quote antes de confirmar. POST downgrade programa el importe Basic en el mandato y el cambio de plan para el final del período Pro. Después, leer pendingDowngrade en GET /subscriptions/me y mostrar la fecha programada. No presentar la operación como un cobro inmediato ni cambiar la UI a Basic antes de effectiveAt y de la confirmación del backend.

### Detener o reanudar la renovación

Antes de cancelar, explicar que la persona conserva el acceso pagado hasta currentPeriodEndsAt y que no recibe un reembolso por esta acción. Tras POST cancel, leer GET /subscriptions/me y mostrar renewsAutomatically: false; **no inventar un estado Free instantáneo**. Si sigue dentro del período, ofrecer POST resume. Si este responde 409 paused_subscription_period_ended, actualizar el estado y no presentar una reanudación exitosa.

## Arquitectura sugerida en apps/web

Mantener la integración en el servidor: [apiFetch](../src/services/api/client.ts) y [getSessionToken](../src/lib/session.ts) ya permiten llamar a la API sin exponer el JWT al navegador. Los servicios de suscripción deben ser server-only; las Server Actions validan las entradas y coordinan las mutaciones. La página de suscripción renderiza el estado efectivo y los formularios cliente solo gestionan pending, errores y confirmaciones.

- No llamar a Mercado Pago desde el frontend ni exponer MERCADO_PAGO_ACCESS_TOKEN, firmas de webhook o datos de tarjeta. El backend conserva precios, identidad, idempotencia y activación.
- Usar cache: "no-store" para GET /subscriptions/me y ambas cotizaciones.
- Validar el plan y expectedAmount también en la Server Action. El botón deshabilitado no es una frontera de seguridad.
- Antes de redirigir, exigir HTTPS y un host exacto permitido de Mercado Pago; rechazar URLs malformadas, credenciales incrustadas y puertos inesperados. No aceptar cualquier URL externa.
- Ejecutar redirect(checkoutUrl) **fuera** del try/catch que captura errores de API.
- Manejar respuestas 200 sin cuerpo de cancel y resume sin intentar parsear JSON obligatorio.
- Revalidar la vista y leer de nuevo GET /subscriptions/me después de cada mutación. No persistir JWT, reference ni checkoutUrl en localStorage.
- No registrar tokens ni URLs completas de checkout en logs o analytics. Un evento de retorno no debe llamarse «pago aprobado».
- Usar maxTournaments del backend como cuota efectiva; no derivar permisos del nombre del plan ni del JSON comercial.

La ruta actual de [suscripción](../src/app/(club)/dashboard/suscripcion/page.tsx) todavía es una pantalla provisional. La estructura de servicios, acciones y ruta de retorno de esta guía es una **propuesta**, no una descripción de archivos implementados.

## Retorno desde Mercado Pago

Configurar MERCADO_PAGO_BACK_URL con una URL HTTPS absoluta que apunte a una ruta de retorno del frontend. Es configuración del backend, no un valor que deba construir el navegador.

La ruta debe ignorar parámetros de éxito o fracaso como prueba de pago. Consultar GET /subscriptions/me y distinguir suscripción nueva, mejora pendiente y plan ya activo. Si la verificación sigue pendiente, mostrar un estado neutral con botón «Actualizar estado» y enlace a la suscripción. Puede hacerse polling acotado (por ejemplo, cada 3 segundos hasta 60 segundos), pausado al ocultar la pestaña y cancelado al desmontar el componente. Nunca dejar polling infinito. El webhook se procesa aunque el navegador se cierre.

## Errores que la UI debe distinguir

Usar ApiError.body.code; no mostrar message, detalles internos ni respuestas crudas del proveedor.

| Código | Tratamiento |
| --- | --- |
| validation | Corregir la entrada; expectedAmount debe conservar el formato decimal de dos posiciones. |
| unauthenticated / club_required | Reautenticar o llevar al flujo de club, respectivamente. |
| upgrade_quote_changed | Obtener nueva cotización y pedir nueva confirmación. |
| upgrade_unavailable / upgrade_proration_unavailable / upgrade_charge_history_unavailable / upgrade_period_changed | No abrir checkout; actualizar estado y explicar que la mejora no está disponible o requiere soporte. |
| downgrade_unavailable / plan_change_in_progress / subscription_changed_during_downgrade | No duplicar el cambio; actualizar estado. |
| checkout_pending_for_another_plan / checkout_in_progress | Explicar el checkout existente o en preparación; no iniciar otro en paralelo. |
| subscription_upgrade_required | Llevar al flujo de mejora Basic → Pro, no al checkout recurrente. |
| active_subscription_must_be_cancelled / paused_subscription_must_be_resumed / paused_subscription_period_ended | Mostrar el período vigente y la acción correcta; no crear otra suscripción sobre él. |
| billing_checkout_recovery_required / billing_upgrade_recovery_required | Operación en recuperación; actualizar más tarde, sin pagos repetidos. |
| billing_provider_rejected / billing_provider_unavailable / billing_not_configured | Error del proveedor o configuración; conservar el estado y ofrecer reintento o soporte según corresponda. |
| desconocido | Mensaje genérico y registro interno sin datos sensibles. |

Un 503 puede representar recuperación, indisponibilidad del proveedor o configuración faltante: decidir por code, no solo por statusCode.

## Validación antes de dar el frontend por terminado

- Sin sesión y sin club: navegación correcta y token nunca visible en cliente.
- Free: checkouts Basic y Pro, nuevo y reutilizado; retorno antes y después del webhook.
- Basic activo: cotización, pago proporcional, 409 por cambio de precio, pendingUpgrade en sus cuatro estados y activación Pro confirmada por GET.
- Pro activo: cotización y programación de Basic; mantener Pro hasta la fecha efectiva.
- Renovación: cancel conserva el período, resume dentro del período y error al vencer.
- Errores de proveedor, doble envío, URL de checkout inválida y estados past_due/canceled.
- Accesibilidad: formularios semánticos, foco visible y errores anunciados sin depender solo del color.
- Sandbox real: cuentas compradora y vendedora de prueba separadas, correo comprador coincidente con el usuario de Dupla, webhooks demorados/repetidos y comprobación final con GET /subscriptions/me. **Las pruebas unitarias no sustituyen esta validación.**

## Referencias

- [Flujo y archivos del backend](../../../docs/mercado-pago-integration.md)
- [Contrato OpenAPI](../../../apps/api/openapi.json)
- [Consumo de API desde el frontend](API.md)
- [Patrón de autenticación frontend](LoginIntegration.md)
- [Next.js: formularios y Server Actions](https://nextjs.org/docs/app/guides/forms)
- [Next.js: redirect](https://nextjs.org/docs/app/api-reference/functions/redirect)
