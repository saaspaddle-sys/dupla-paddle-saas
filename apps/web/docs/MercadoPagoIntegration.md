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

## Variables de entorno: qué configurar y de dónde obtenerlo

La API carga el archivo **.env de la raíz del monorepo** (usar [.env.example](../../../.env.example) como plantilla). El frontend Next.js carga **apps/web/.env.local**. No colocar credenciales de Mercado Pago en el frontend ni usar variables NEXT_PUBLIC_ para este flujo.

En el .env de la raíz, completar estas variables para facturación:

~~~dotenv
MERCADO_PAGO_ACCESS_TOKEN=<access-token-del-entorno>
MERCADO_PAGO_BASIC_AMOUNT=<importe-mensual-basic>
MERCADO_PAGO_PRO_AMOUNT=<importe-mensual-pro>
MERCADO_PAGO_CURRENCY=ARS
MERCADO_PAGO_BACK_URL=https://web.example.com/dashboard/suscripcion/retorno
MERCADO_PAGO_WEBHOOK_URL=https://api.example.com/webhooks/mercado-pago
MERCADO_PAGO_WEBHOOK_SECRET=<clave-secreta-de-webhooks>
# Opcional: por defecto 60000 ms; mínimo 10000 ms.
# MERCADO_PAGO_RECONCILIATION_INTERVAL_MS=60000
~~~

Los dominios example.com y los valores entre ángulos son **marcadores de posición**; no funcionan sin reemplazarlos. Los importes deben ser positivos, expresados en unidades de la moneda y con hasta dos decimales (por ejemplo, 10000.00). La API los valida y es la fuente del precio: no se obtienen de Mercado Pago ni se envían desde el navegador.

| Variable | De dónde sale y qué comprobar |
| --- | --- |
| MERCADO_PAGO_ACCESS_TOKEN | En [Tus integraciones → aplicación → Credenciales de prueba](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/credentials), copiar el **Access Token de prueba** para desarrollo, o el de producción para cobros reales. Es privado y pertenece solo al backend; esta integración no necesita Public Key en el frontend. |
| MERCADO_PAGO_BASIC_AMOUNT / MERCADO_PAGO_PRO_AMOUNT | Precios mensuales definidos por el negocio; mantener Pro por encima de Basic si se ofrecerá la mejora proporcional. No copiar el importe de una cotización puntual. |
| MERCADO_PAGO_CURRENCY | Moneda de esos precios y de la cuenta utilizada; ARS es la configuración prevista en [.env.example](../../../.env.example). |
| MERCADO_PAGO_BACK_URL | URL HTTPS pública **del frontend** a la que vuelve el comprador. La ruta de retorno es propuesta en esta guía y todavía debe implementarse; localhost no sirve como URL pública. No es un valor generado por Mercado Pago. |
| MERCADO_PAGO_WEBHOOK_URL | URL HTTPS pública **de la API**, terminada en /webhooks/mercado-pago, como define el [controller](../../../apps/api/src/subscriptions/mercado-pago-webhook.controller.ts). Debe ser alcanzable por Mercado Pago; localhost o solo Docker interno no sirven. El backend la valida como requisito y la envía como `notification_url` al crear la preferencia de pago de Basic → Pro, **pero no** al crear la suscripción recurrente. |
| MERCADO_PAGO_WEBHOOK_SECRET | Clave de firma de la misma aplicación de Mercado Pago: [Tus integraciones → aplicación → Webhooks → Configurar notificación](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks), donde se revela la clave generada. No es el Access Token ni una cadena inventada localmente. |
| MERCADO_PAGO_RECONCILIATION_INTERVAL_MS | Opcional: intervalo del proceso de conciliación; la API usa 60000 ms por defecto y exige al menos 10000 ms. |

Para **Suscripciones**, la [documentación de Webhooks](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks) dice que configurar la URL desde el panel no aplica y remite a la configuración durante la creación del pago. Sin embargo, la [referencia de `POST /preapproval`](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/create-preapproval/post) no documenta `notification_url`, y el cliente actual no lo envía. Por eso **no se puede dar por probada la entrega de webhooks recurrentes** con solo completar estas variables o el panel. Consultar el [bloqueo de validación](#límite-actual-de-los-webhooks-recurrentes) antes de cerrar las pruebas de sandbox.

En **apps/web/.env.local**, el único valor necesario para que el servidor web llame a la API en este flujo es:

~~~dotenv
API_BASE_URL=http://localhost:3000
~~~

Ese valor corresponde al puerto local de la API; el script del frontend usa el 3001. En un despliegue, reemplazarlo por la URL alcanzable **desde el servidor web**. API_BASE_URL no lleva NEXT_PUBLIC_ y no contiene ninguna credencial de Mercado Pago. Si se prepara el proyecto desde cero, DATABASE_URL y JWT_SECRET también deben configurarse en el .env raíz según [.env.example](../../../.env.example), pero son requisitos generales de la API, no credenciales de facturación. Mantener los archivos .env y .env.local fuera de Git.

## Probar la integración en desarrollo

Este recorrido usa la API en `localhost:3000`, Next.js en `localhost:3001` y dos URL HTTPS públicas temporales. **Todavía no es una prueba completa desde la UI**: la [pantalla de suscripción](../src/app/(club)/dashboard/suscripcion/page.tsx) es provisional y la ruta de retorno descrita más abajo no está implementada. Primero se puede probar el contrato de la API y la recepción del webhook; el recorrido de navegador queda pendiente de la implementación frontend y del límite de notificaciones recurrentes indicado al final de esta sección.

### 1. Obtener credenciales y preparar las cuentas

1. Entrar con la cuenta vendedora en [Mercado Pago Developers → Tus integraciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/credentials). Crear o seleccionar la aplicación de esta integración y, en **Credenciales de prueba**, copiar su Access Token a `MERCADO_PAGO_ACCESS_TOKEN` en el `.env` raíz. Las credenciales de prueba se habilitan al crear la aplicación; no activar ni copiar las de producción. El token pertenece al vendedor, nunca al comprador ni al navegador.
2. En **Cuentas de prueba** de esa aplicación, identificar o crear un **comprador** y, si el panel o el flujo elegido lo requieren, un **vendedor** de prueba. Mantener ambos en el mismo país que la moneda configurada. Conservar usuario, contraseña y código de verificación de seis dígitos que muestra el panel; se puede regenerar la contraseña y cargar saldo ficticio desde allí. Mercado Pago limita la creación manual a 15 cuentas simultáneas y no permite eliminarlas, así que conviene reutilizarlas por escenario. Ver la [guía oficial de cuentas de prueba para Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/test/accounts).
3. Crear en Dupla un usuario administrador de club para la prueba. El backend usa **el email de ese usuario** como `payer_email`; comprobar que corresponde al comprador de prueba con el que se completará el checkout. No iniciar sesión en Mercado Pago con la cuenta vendedora para pagar: usar la compradora en una ventana privada o perfil separado, sin mezclar sesiones de la cuenta real. Nunca usar tarjetas o dinero reales.

### 2. Levantar la API, el frontend y los túneles

Desde la raíz del monorepo, preparar el `.env` a partir de [`.env.example`](../../../.env.example), configurar `DATABASE_URL`, `JWT_SECRET`, los precios y la moneda. En `apps/web/.env.local`, configurar `API_BASE_URL=http://localhost:3000`. Preparar dependencias y base de datos:

~~~powershell
pnpm install
pnpm db:up
pnpm db:migrate
~~~

Mantener la API y el frontend corriendo en **terminales separadas**:

~~~powershell
pnpm start:dev
# En otra terminal:
pnpm dev:web
~~~

Instalar [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) y abrir **dos terminales adicionales**, una por servicio:

~~~powershell
cloudflared tunnel --url http://localhost:3000
cloudflared tunnel --url http://localhost:3001
~~~

Cada [Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) entrega una URL `https://…trycloudflare.com` distinta. Usar la del puerto **3000** para `MERCADO_PAGO_WEBHOOK_URL=https://<túnel-api>/webhooks/mercado-pago`. Para probar solo la API hoy, usar la ruta existente `MERCADO_PAGO_BACK_URL=https://<túnel-web>/dashboard/suscripcion`; cuando se implemente el retorno, cambiarla a `https://<túnel-web>/dashboard/suscripcion/retorno`. La página existente es provisional y **no verifica pagos al regresar**. `API_BASE_URL` sigue apuntando a la API local desde el servidor Next.js. Reiniciar la API después de cambiar su `.env`. Los Quick Tunnels son temporales, no para producción: si cambian las URL al reiniciarlos, actualizar las variables y toda configuración de prueba en Mercado Pago antes de crear otro checkout. Si existe `config.yaml` en `.cloudflared`, Quick Tunnel puede no funcionar; revisar la [limitación oficial](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

### 3. Configurar y comprobar los webhooks de prueba

En **Tus integraciones → aplicación → Webhooks → Configurar notificación**, revelar la clave secreta de la aplicación y colocarla en `MERCADO_PAGO_WEBHOOK_SECRET`. Usar exclusivamente el entorno de prueba y mantener separado el endpoint productivo. Para el pago único de **Basic → Pro**, el backend crea una preferencia Checkout Pro con `notification_url` igual a `MERCADO_PAGO_WEBHOOK_URL`; el evento que procesa es `payment`. En el panel se puede configurar una URL de prueba y simular entregas para comprobar conectividad y firma, pero **eso no sustituye un cobro real de prueba** ni resuelve por sí solo el ruteo de Suscripciones. Los tópicos relevantes para estas son `subscription_preapproval` y, especialmente para la activación y renovación, `subscription_authorized_payment`. Ver [tópicos oficiales](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications) y [configuración y firma de Webhooks](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).

La URL pública debe llegar a **`POST /webhooks/mercado-pago`**, no a `/` ni a una ruta del frontend. El controlador exige `data.id` en la query, `x-signature` y `x-request-id`; un POST sin firma válida responde `401 invalid_webhook_signature`, lo cual confirma que la ruta existe, **no** que el proveedor ya esté configurado. Una entrega firmada puede responder `200` al aceptarse; revisar el panel de notificaciones y los logs de la API para distinguir errores de túnel/ruta (`404`), firma (`401`) y consulta al proveedor (`503`). La simulación del panel no garantiza que el recurso exista ni que el plan se haya activado. El único resultado funcional es el estado canónico en `GET /subscriptions/me`.

### 4. Usar tarjetas de prueba y verificar estados

En el checkout de Mercado Pago, iniciar sesión como **comprador de prueba** e introducir una tarjeta de la [tabla oficial para Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/test/cards). Por ejemplo, la Visa de prueba `4509 9535 6623 3704`, CVV `123`, vencimiento `11/30` y DNI `12345678`; usar como nombre del titular `APRO` para simular aprobación u `OTHE` para rechazo general. La tabla oficial contiene otras tarjetas y códigos (`CONT` para pendiente, entre otros); consultarla antes de cada prueba porque los datos pueden cambiar. Estos números son **solo de prueba** y se introducen en Mercado Pago, nunca en Dupla.

1. Con un club Free y credenciales de prueba, llamar a `POST /subscriptions/me/checkouts` con Basic o Pro, autenticado como su administrador. Registrar la `reference` de prueba y abrir el `checkoutUrl` devuelto; no inferir éxito de la redirección.
2. Completar un caso `APRO` y otro `OTHE`/`CONT` con cuentas o checkouts separados. Consultar `GET /subscriptions/me` después del retorno y nuevamente tras la notificación o conciliación. Un checkout pendiente, un regreso al sitio o `reused: true` no prueban aprobación.
3. Cuando haya una suscripción Basic realmente activa, probar `GET /subscriptions/me/upgrade-quote`, confirmar exactamente `amount` en `POST /subscriptions/me/upgrade` y completar el pago único de prueba. Verificar que el webhook `payment` o la conciliación aplique Pro; si aparece `409 upgrade_quote_changed`, solicitar nueva cotización y confirmación.
4. Probar luego la programación Pro → Basic, cancelación y reanudación usando los endpoints de esta guía. Comprobar el estado efectivo y los campos pendientes con `GET /subscriptions/me`; no esperar a que una renovación mensual ocurra durante una sesión manual. Las pruebas automatizadas del backend y los escenarios de sandbox son complementarios.

### Límite actual de los webhooks recurrentes

**No marcar la validación end-to-end de Suscripciones como terminada todavía.** El código de [`POST /preapproval`](../../../apps/api/src/subscriptions/mercado-pago-http-preapproval.client.ts) no envía `MERCADO_PAGO_WEBHOOK_URL` como `notification_url`: esa variable solo se valida como requisito en el checkout recurrente. A su vez, [Mercado Pago excluye Suscripciones de la configuración por panel](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks), pero su [referencia de creación de Preapproval](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/create-preapproval/post) no documenta ese campo. No asumir que agregarlo sin comprobar el contrato arregla el flujo. Antes de darlo por operativo, confirmar con Mercado Pago el mecanismo soportado, implementarlo en el backend si corresponde y verificar en sandbox una entrega **real y firmada** de `subscription_authorized_payment` más la lectura canónica posterior. El pago único Basic → Pro sí incluye `notification_url` en su preferencia actual; tampoco está validado en sandbox por esta guía.

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
- Sandbox real: comprador de prueba separado del vendedor, correo comprador coincidente con el usuario de Dupla, webhooks demorados/repetidos y comprobación final con GET /subscriptions/me. **Las pruebas unitarias no sustituyen esta validación; los webhooks recurrentes siguen sujetos al [límite actual](#límite-actual-de-los-webhooks-recurrentes).**

## Referencias

- [Flujo y archivos del backend](../../../docs/mercado-pago-integration.md)
- [Contrato OpenAPI](../../../apps/api/openapi.json)
- [Consumo de API desde el frontend](API.md)
- [Patrón de autenticación frontend](LoginIntegration.md)
- [Next.js: formularios y Server Actions](https://nextjs.org/docs/app/guides/forms)
- [Next.js: redirect](https://nextjs.org/docs/app/api-reference/functions/redirect)
