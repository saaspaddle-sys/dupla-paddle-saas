# UI/UX - Flujos de Upgrade y Downgrade

## 📱 Pantalla Principal de Suscripciones

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAN VIGENTE: Basic [Activo]                                   │
│  Cuota: 3 torneos simultáneos                                   │
│  Período: Hasta 21/10/2026                                      │
│                                      ┌──────────────────────────┤
│                                      │ [Mejorar a Pro]          │
│                                      │ [Cancelar Renovación]    │
│                                      └──────────────────────────┘
└─────────────────────────────────────────────────────────────────┘

PLANES DISPONIBLES

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  FREE        │  │ BASIC        │  │ PRO          │
│  $0/mes      │  │ $5.000/mes   │  │ $10.000/mes  │
│  (Plan Act)  │  │ (Plan Act)   │  │ (Recomendado)│
│              │  │              │  │              │
│ ✓ 1 torneo   │  │ ✓ 3 torneos  │  │ ✓ 12 torneos │
│              │  │ ✓ Email      │  │ ✓ Soporte 24/7
│              │  │              │  │              │
│   (Desabled) │  │  (Desabled)  │  │[Mejorar a Pro]
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🔄 Flujo de Upgrade (Basic → Pro)

### Paso 1: Modal se Abre

```
╔════════════════════════════════════════╗
║  Mejorar a Plan Pro                    ║
╟────────────────────────────────────────╢
║                                        ║
║  Conoce el costo proporcional para     ║
║  mejorar tu plan a Pro de forma        ║
║  inmediata.                            ║
║                                        ║
║  [  Ver Cotización  ]                  ║
║                                        ║
╚════════════════════════════════════════╝
```

### Paso 2: Cotización Obtenida

```
╔════════════════════════════════════════╗
║  Mejorar a Plan Pro                    ║
╟────────────────────────────────────────╢
║                                        ║
║  ┌──────────────────────────────────┐  ║
║  │ Importe prorratizado:            │  ║
║  │                    ARS 2.500,00  │  ║
║  │                                  │  ║
║  │ Nuevo monto mensual:             │  ║
║  │                   ARS 10.000,00  │  ║
║  │                                  │  ║
║  │ Válido hasta: 21/10/2026         │  ║
║  └──────────────────────────────────┘  ║
║                                        ║
║  Se abrirá Mercado Pago para          ║
║  completar el pago de forma segura.   ║
║                                        ║
║  [Cancelar]  [Confirmar Mejora]       ║
║                                        ║
╚════════════════════════════════════════╝
```

### Paso 3: Procesando

```
╔════════════════════════════════════════╗
║  Mejorar a Plan Pro                    ║
╟────────────────────────────────────────╢
║                                        ║
║           ⟲ (animación)                ║
║                                        ║
║      Preparando el pago...             ║
║                                        ║
╚════════════════════════════════════════╝
```

### Paso 4: Redirige a Mercado Pago

```
→ https://checkout.mercadopago.com/...
  (Usuario completa el pago en Mercado Pago)
```

### Resultado: Plan Actualizado

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAN VIGENTE: Pro [Activo] ✨                                  │
│  Cuota: 12 torneos simultáneos                                  │
│  Período: Hasta 21/10/2026                                      │
│                                      ┌──────────────────────────┤
│                                      │ [Cambiar a Basic]        │
│                                      │ [Cancelar Renovación]    │
│                                      └──────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Downgrade (Pro → Basic)

### Paso 1: Modal se Abre

```
╔════════════════════════════════════════╗
║  Cambiar a Plan Basic                  ║
╟────────────────────────────────────────╢
║                                        ║
║  Consulta el nuevo monto mensual       ║
║  y cuándo entrará en vigor el cambio.  ║
║                                        ║
║  [  Ver Cotización  ]                  ║
║                                        ║
╚════════════════════════════════════════╝
```

### Paso 2: Cotización Obtenida

```
╔════════════════════════════════════════╗
║  Cambiar a Plan Basic                  ║
╟────────────────────────────────────────╢
║                                        ║
║  ┌──────────────────────────────────┐  ║
║  │ Nuevo monto mensual:             │  ║
║  │                    ARS 5.000,00  │  ║
║  │                                  │  ║
║  │ Entra en vigor: 21/10/2026       │  ║
║  └──────────────────────────────────┘  ║
║                                        ║
║  ℹ️ Conservarás el acceso a Plan      ║
║  Pro hasta el fin de tu período       ║
║  pagado actual. El cambio se          ║
║  aplicará en la siguiente renovación. ║
║                                        ║
║  [Cancelar]  [Confirmar Cambio]       ║
║                                        ║
╚════════════════════════════════════════╝
```

### Paso 3: Procesando

```
╔════════════════════════════════════════╗
║  Cambiar a Plan Basic                  ║
╟────────────────────────────────────────╢
║                                        ║
║           ⟲ (animación)                ║
║                                        ║
║      Programando el cambio...          ║
║                                        ║
╚════════════════════════════════════════╝
```

### Resultado: Downgrade Programado

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAN VIGENTE: Pro [Activo]                                     │
│  Cuota: 12 torneos simultáneos                                  │
│  Período: Hasta 21/10/2026                                      │
│                                                                  │
│  ⚠️ CAMBIO PROGRAMADO:                                          │
│  • Plan: Pro → Basic                                           │
│  • Nuevo monto: $5.000 ARS/mes                                 │
│  • Efectivo a partir del: 21/10/2026                           │
│                                                                  │
│  Tendrás acceso a Pro hasta el fin del período actual.          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Estados y Mensajes de Error

### Error de Cotización Cambiada

```
╔════════════════════════════════════════╗
║  Mejorar a Plan Pro                    ║
╟────────────────────────────────────────╢
║                                        ║
║  [🔴] El monto cambió entre la         ║
║  cotización y el pago. Por favor       ║
║  consulta nuevamente.                  ║
║                                        ║
║  [  Ver Cotización  ]                  ║
║                                        ║
╚════════════════════════════════════════╝
```

### Error de Plan No Elegible

```
╔════════════════════════════════════════╗
║  Cambiar a Plan Basic                  ║
╟────────────────────────────────────────╢
║                                        ║
║  [🔴] No se puede realizar el cambio   ║
║  de plan en este momento. Requiere     ║
║  suscripción activa a Pro.             ║
║                                        ║
║  [  Cerrar  ]                          ║
║                                        ║
╚════════════════════════════════════════╝
```

---

## 🌐 Componentes Utilizados

| Componente              | Ubicación                             | Responsabilidad                     |
| ----------------------- | ------------------------------------- | ----------------------------------- |
| **SubscriptionManager** | `_components/SubscriptionManager.tsx` | Orquesta los flujos, maneja botones |
| **UpgradeModal**        | `_components/UpgradeModal.tsx`        | Modal de upgrade de Basic a Pro     |
| **DowngradeModal**      | `_components/DowngradeModal.tsx`      | Modal de downgrade de Pro a Basic   |

---

## 🔐 Seguridad

✅ **Validación en Server**

- Los tokens se validan en el servidor
- Las operaciones se realizan solo si el usuario está autenticado

✅ **Manejo de Errores**

- Los errores de la API se capturan y muestran en español
- Los modales se cierran si hay error permitiendo reintentar

✅ **Prevención de Race Conditions**

- Se usa `subscription-lifecycle-lock` en el backend
- Se valida que no haya operaciones simultáneas

---

## 📊 Flujo de Datos

```
SubscriptionManager (Estado)
       ↓
   [Click Button]
       ↓
   Modal Abre
       ↓
Server Action (getQuote)
       ↓
   API Backend
       ↓
   Modal Muestra Cotización
       ↓
   [Click Confirmar]
       ↓
Server Action (createUpgrade/Downgrade)
       ↓
   API Backend
       ↓
   ✅ Éxito → Redirige/Recarga
   ❌ Error → Muestra error
```

---

## 📝 Próximas Iteraciones

1. **Notificaciones en Tiempo Real**: Agregar toast notifications
2. **Historial de Cambios**: Mostrar histórico de cambios de plan
3. **Soporte en Chat**: Link a soporte si hay problemas
4. **Descuentos**: Mostrar posibles descuentos o promociones
5. **Comparativa**: Mostrar diferencias entre planes de forma clara
