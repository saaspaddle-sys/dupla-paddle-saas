# Implementación de Endpoints de Upgrade y Downgrade - Frontend

## 📋 Resumen

Se han implementado los endpoints de cambio de plan (upgrade y downgrade) en el frontend (Next.js) para que los usuarios finales puedan actualizar sus planes de suscripción según sus preferencias.

## 🎯 Funcionalidades Implementadas

### 1. **Upgrade (Basic → Pro)**

- **Endpoint**: `POST /subscriptions/me/upgrade`
- **Flujo**:
  1. Usuario hace clic en "Mejorar a Pro"
  2. Se obtiene una cotización con `GET /subscriptions/me/upgrade-quote`
  3. Se muestra el importe prorratizado(saldo restante sin usar) y el nuevo monto mensual
  4. Usuario confirma y se crea el checkout de Mercado Pago
  5. Se redirige a Mercado Pago para completar el pago

### 2. **Downgrade (Pro → Basic)**

- **Endpoint**: `POST /subscriptions/me/downgrade`
- **Flujo**:
  1. Usuario hace clic en "Cambiar a Basic"
  2. Se obtiene una cotización con `GET /subscriptions/me/downgrade-quote`
  3. Se muestra el nuevo monto mensual y la fecha efectiva
  4. Usuario confirma el cambio
  5. Se programa la bajada de plan para la siguiente renovación

---

## 📁 Archivos Modificados/Creados

### 1. **services/subscriptions/subscriptions.ts** ✏️ Actualizado

Agregadas nuevas interfaces y funciones:

- `UpgradeQuote` - Interfaz para cotización de upgrade
- `UpgradeCheckout` - Interfaz para checkout de upgrade
- `DowngradeQuote` - Interfaz para cotización de downgrade
- `getUpgradeQuote(token)` - Obtiene cotización de upgrade
- `createUpgrade(token, expectedAmount)` - Crea upgrade checkout
- `getDowngradeQuote(token)` - Obtiene cotización de downgrade
- `createDowngrade(token)` - Programa downgrade

### 2. **services/subscriptions/subscription-actions.ts** ✏️ Actualizado

Agregadas nuevas server actions:

- `getUpgradeQuoteAction()` - Server action para cotización de upgrade
- `createUpgradeAction(expectedAmount)` - Server action para crear upgrade
- `getDowngradeQuoteAction()` - Server action para cotización de downgrade
- `createDowngradeAction()` - Server action para crear downgrade
- Manejo completo de errores y estados

### 3. **UpgradeModal.tsx** 🆕 Nuevo

Componente modal para el flujo de upgrade:

- Obtiene cotización de upgrade
- Muestra detalles del pago (importe prorratizado, nuevo monto mensual)
- Confirma y redirige a Mercado Pago
- Estados: quote → confirm → loading
- Manejo de errores

### 4. **DowngradeModal.tsx** 🆕 Nuevo

Componente modal para el flujo de downgrade:

- Obtiene cotización de downgrade
- Muestra detalles (nuevo monto, fecha efectiva)
- Confirma el cambio de plan
- Estados: quote → confirm → loading
- Manejo de errores

### 5. **SubscriptionManager.tsx** ✏️ Actualizado

Integración de nuevos modales:

- Agregados botones contextuales:
  - "Mejorar a Pro" - Visible para usuarios en plan Basic
  - "Cambiar a Basic" - Visible para usuarios en plan Pro
- Integración de `UpgradeModal` y `DowngradeModal`
- Estados para control de modales

---

## 🎨 Experiencia del Usuario

### Plan Basic → Pro

```
1. Usuario ve tarjeta de estado con botón "Mejorar a Pro"
   ↓
2. Hace clic y se abre modal con cotización
   ├─ Importe prorratizado: $X.XX
   ├─ Nuevo monto mensual: $10.000 ARS
   └─ Válido hasta: [fecha]
   ↓
3. Usuario confirma
   ↓
4. Se abre Mercado Pago para pagar
   ↓
5. Después del pago exitoso, el plan se actualiza automáticamente
```

### Plan Pro → Basic

```
1. Usuario ve tarjeta de estado con botón "Cambiar a Basic"
   ↓
2. Hace clic y se abre modal con cotización
   ├─ Nuevo monto mensual: $5.000 ARS
   ├─ Entra en vigor: [fecha siguiente]
   └─ Info: "Conservarás Pro hasta fin del período actual"
   ↓
3. Usuario confirma
   ↓
4. La bajada se programa para la siguiente renovación
   ↓
5. Página se recarga para mostrar estado actualizado
```

---

## 🔌 Integración con API

Los endpoints utilizan las siguientes rutas de la API (ya implementadas):

| Método | Ruta                                | Función                         |
| ------ | ----------------------------------- | ------------------------------- |
| GET    | `/subscriptions/me/upgrade-quote`   | Obtiene cotización de upgrade   |
| POST   | `/subscriptions/me/upgrade`         | Crea upgrade checkout           |
| GET    | `/subscriptions/me/downgrade-quote` | Obtiene cotización de downgrade |
| POST   | `/subscriptions/me/downgrade`       | Programa downgrade              |

---

## ✅ Testing

Todos los componentes han sido compilados exitosamente:

- TypeScript: ✅ Sin errores
- ESLint: ✅ Sin errores
- Build: ✅ Exitoso

---

## 🚀 Próximos Pasos (Opcional)

1. **Webhooks**: Asegurar que los webhooks de Mercado Pago están correctamente configurados
2. **Testing E2E**: Crear tests end-to-end para los flujos de upgrade/downgrade
3. **Confirmación en email**: Agregar confirmación por email después del cambio
4. **Analytics**: Trackear eventos de cambio de plan

---

## 📝 Notas Técnicas

- Se utilizan **Server Actions** de Next.js para manejar operaciones sensibles
- Los modales utilizan **useTransition** para manejo de estados asincronos
- Los errores de la API se mapean a mensajes en español para el usuario
- La validación de tokens se realiza en el servidor
- Los redirects se manejan con `window.location` cuando es necesario
