# Requisitos Frontend

## 1. Requisitos funcionales

1. Mostrar una home publica con acceso a torneos, partidos, ranking y sedes.
2. Permitir registro de jugador mediante formulario UI.
3. Exponer acceso a login mediante modal desde el `Header`; no existe ruta propia para login.
4. Exponer navegacion publica consistente mediante `Header` y `Footer`.
5. Ofrecer base de rutas para paneles privados (`players`, `admin`, `customers`).
6. Mantener compatibilidad de rutas historicas cuando aplique (ejemplo: alias `/auth/register` a `/register`).

## 2. Estado de las rutas del header

### Hecho

- `/`.
- `/register`.
- `/ranking`.
- `/auth/register` como alias de compatibilidad.

### Planeado

- `/torneos`.
- `/players`.
- `/partidos`.
- `/sedes`.
- `/admin` como panel completo.

## 3. Requisitos no funcionales

### 3.1 Responsive

- El frontend debe funcionar correctamente en mobile, tablet y desktop.
- Breakpoints minimos a cubrir: `sm`, `md`, `lg`.

### 3.2 Navegadores soportados

- Ultimas 2 versiones estables de Chrome, Edge, Firefox y Safari.

### 3.3 Performance

- Primera carga optimizada para vista publica (contenido principal legible sin interacciones complejas).
- Evitar JS innecesario en paginas estaticas cuando no haga falta estado cliente.

### 3.4 Accesibilidad

- Controles interactivos con etiquetas descriptivas.
- Navegacion por teclado en elementos clave.
- Contraste suficiente entre texto y fondo.
- Dialogos/modales con `aria-*` y cierre por `Esc` cuando aplique.

### 3.5 Mantenibilidad

- Estructura de rutas y componentes predecible.
- Convenciones de estilo centralizadas en `globals.css` y clases de utilidad.
- Documentacion actualizada en `apps/web/docs`.

### 3.6 Calidad de codigo

- `eslint` debe pasar en cada cambio.
- TypeScript en modo estricto del paquete `web`.

## 4. Restricciones actuales

- Sin contrato final de API en frontend.
- Sin flujo de autenticacion productivo conectado al backend.
- Sin suite de tests automatizados en `apps/web` por el momento.
