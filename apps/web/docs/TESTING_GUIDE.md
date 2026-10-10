# Guía de Pruebas - Upgrade y Downgrade

## 🚀 Cómo Probar los Nuevos Endpoints

### Pre-requisitos

- Acceso a la aplicación con usuario de club autenticado
- Plan vigente (Free, Basic o Pro)
- Token JWT válido
- Mercado Pago configurado en ambiente de prueba

---

## ✅ Pruebas Manuales

### Test 1: Upgrade (Free/Basic → Pro)

1. **Accede al panel de suscripciones**

   ```
   URL: http://localhost:3001/dashboard/suscripcion
   ```

2. **Verifica tu plan actual**
   - Deberías ver tu plan en la tarjeta de estado

3. **Si tienes Plan Basic:**
   - Haz clic en botón "Mejorar a Pro" en la tarjeta de estado
   - O ve al card de Plan Pro y haz clic en "Mejorar a Pro"

4. **Se abre el modal de cotización:**
   - ✅ Verifica que se muestre:
     - Importe prorratizado
     - Nuevo monto mensual ($10.000 ARS)
     - Fecha válido hasta
   - ✅ Los montos deben ser numéricos válidos
   - ✅ No debe haber errores en la consola

5. **Confirma la mejora:**
   - Haz clic en "Confirmar Mejora"
   - Deberías ser redirigido a Mercado Pago

6. **En Mercado Pago:**
   - Deberías ver el importe del paso 4
   - Puedes cancelar para volver a la app
   - O completar el pago (usar tarjeta de prueba de Mercado Pago)

7. **Después del pago:**
   - La aplicación debe reflejar el nuevo plan
   - El estado debe cambiar a Pro

---

### Test 2: Downgrade (Pro → Basic)

1. **Accede al panel con usuario en Plan Pro**

   ```
   URL: http://localhost:3001/dashboard/suscripcion
   ```

2. **Verifica que tienes Plan Pro**
   - Tarjeta de estado debe mostrar: "Pro"

3. **Haz clic en "Cambiar a Basic"**
   - Botón en tarjeta de estado (lado derecho)

4. **Se abre modal de cotización:**
   - ✅ Verifica que se muestre:
     - Nuevo monto mensual ($5.000 ARS)
     - Fecha de efectividad (próxima renovación)
     - Mensaje informativo sobre conservar acceso a Pro

5. **Confirma el cambio:**
   - Haz clic en "Confirmar Cambio"
   - El modal debe cerrarse
   - La página debe recargarse

6. **Verifica el estado:**
   - Deberías ver pendingDowngrade en el estado
   - Plan vigente sigue siendo Pro
   - Mensaje indicando cambio programado

---

### Test 3: Manejo de Errores

#### Error: Operación en progreso

```javascript
// Intenta hacer dos upgrades simultáneamente
1. Abre modal de upgrade
2. Click en "Confirmar Mejora"
3. Antes de completar, haz clic nuevamente
4. Deberías ver error: "Otra operación está en progreso"
```

#### Error: Monto cambió

```javascript
// Si la cotización y el pago tienen montos diferentes
1. Obtén cotización
2. Espera a que cambie el día calendario (si es justo a medianoche)
3. Intenta confirmar
4. Deberías ver error: "El monto cambió entre cotización y pago"
```

#### Error: Plan no elegible

```javascript
// Intenta downgrade sin Plan Pro activo
1. Con usuario en Plan Basic
2. Abre DevTools → Network
3. Intenta hacer downgrade (si el botón está disponible)
4. Deberías ver error: "Plan no elegible para downgrade"
```

---

## 🔍 Pruebas de Consola

### Verificar Logs del Navegador

Abre DevTools (F12) → Console y verifica:

```javascript
// ✅ Deberías VER (sin errores):
[INFO] Fetching upgrade quote...
[INFO] Quote received: { amount: "2500.00", ... }
[INFO] Creating upgrade checkout...
[INFO] Upgrade created successfully

// ❌ NO deberías VER:
[ERROR] Unexpected token
[ERROR] Network error
[TypeError] Cannot read property...
```

### Verificar Network Tab

1. Abre DevTools → Network
2. Realiza un upgrade
3. Deberías ver estas peticiones:

```
GET  /subscriptions/me/upgrade-quote?targetPlan=pro  [200]
POST /subscriptions/me/upgrade                        [201]
```

Verifica que todas regresen status 200/201.

---

## 📋 Checklist de Prueba

### Funcionalidad Upgrade

- [ ] Modal abre correctamente
- [ ] Cotización se obtiene sin errores
- [ ] Se muestra importe prorratizado
- [ ] Se muestra nuevo monto mensual
- [ ] Se muestra fecha válido hasta
- [ ] Botón "Confirmar Mejora" funciona
- [ ] Se redirige a Mercado Pago correctamente
- [ ] Plan se actualiza después del pago
- [ ] Manejo de errores funciona

### Funcionalidad Downgrade

- [ ] Botón "Cambiar a Basic" visible para Pro
- [ ] Modal abre correctamente
- [ ] Cotización se obtiene sin errores
- [ ] Se muestra nuevo monto mensual
- [ ] Se muestra fecha efectiva
- [ ] Mensaje informativo visible
- [ ] Botón "Confirmar Cambio" funciona
- [ ] Página se recarga después de confirmar
- [ ] Downgrade se programa correctamente
- [ ] Manejo de errores funciona

### Interfaz de Usuario

- [ ] Estilos se aplican correctamente
- [ ] Modales son responsive
- [ ] Botones están accesibles
- [ ] Mensajes de error son claros
- [ ] Estados de carga funcionan (spinner)
- [ ] Colores son consistentes

### Seguridad

- [ ] Token se envía correctamente
- [ ] No se filtra información sensible
- [ ] Validación en servidor funciona
- [ ] No permite operaciones no autorizadas

---

## 🐛 Debugging

### Si el modal no abre:

```javascript
// Verifica en consola:
console.log("Modal state:", showUpgradeModal);

// O en React DevTools
// Busca SubscriptionManager → Props
```

### Si la cotización no se obtiene:

```javascript
// Verifica que el token sea válido
const token = localStorage.getItem("token");
console.log("Token exists:", !!token);

// Verifica que el servidor responda
fetch("/subscriptions/me/upgrade-quote", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => console.log(r));
```

### Si Mercado Pago no se abre:

```javascript
// Verifica que checkoutUrl sea válido
console.log("Checkout URL:", result.checkoutUrl);

// Debe comenzar con https://checkout.mercadopago.com/
```

---

## 📱 Pruebas en Dispositivos Móviles

1. **Accede desde móvil:**

   ```
   URL: http://<tu-ip>:3001/dashboard/suscripcion
   ```

2. **Prueba responsividad:**
   - [ ] Modal se adapta a pantalla pequeña
   - [ ] Botones son clickeables
   - [ ] Texto es legible
   - [ ] No hay scroll horizontal

3. **Prueba touch:**
   - [ ] Los botones responden al tocar
   - [ ] El scroll dentro del modal funciona
   - [ ] Las animaciones no se congelen

---

## 🔗 URLs Útiles

### Rutas de la Aplicación

- Suscripciones: `http://localhost:3001/dashboard/suscripcion`
- Panel de Admin: `http://localhost:3001/admin`

### Documentación

- API: Consulta `docs/mercado-pago-integration.md` (línea 302+)
- Workflow: Consulta `docs/workflow.md`
- Decisiones: Consulta `docs/decisions.md`

---

## ✉️ Reportar Problemas

Si encuentras un problema:

1. **Anota el error exacto** de la consola
2. **Captura la petición** en Network tab
3. **Documento el paso a paso** para reproducir
4. **Crea un issue** en GitHub con esta información

Formato sugerido:

```markdown
## Descripción

[Describe qué sucedió]

## Pasos para Reproducir

1. ...
2. ...
3. ...

## Resultado Actual

[Qué pasó]

## Resultado Esperado

[Qué debería pasar]

## Logs

[Consola/Network tab]
```

---

## ✨ Éxito

Una vez que todos los tests de la lista de verificación están marcados con ✅,
la implementación está lista para producción.
