# Requisitos Frontend

## 1. Requisitos funcionales

1. Mostrar una home publica con acceso a torneos, partidos, ranking y sedes.
2. Permitir registro de jugador mediante formulario UI.
3. Permitir acceso a login (actualmente en construccion).
4. Exponer navegacion publica consistente mediante `Header` y `Footer`.
5. Ofrecer base de rutas para paneles privados (`players`, `admin`, `customers`).
6. Mantener compatibilidad de rutas historicas cuando aplique (ejemplo: alias `/auth/register` a `/register`).

## 2. Requisitos no funcionales

### 2.1 Responsive

- El frontend debe funcionar correctamente en mobile, tablet y desktop.
- Breakpoints minimos a cubrir: `sm`, `md`, `lg`.

### 2.2 Navegadores soportados

- Ultimas 2 versiones estables de Chrome, Edge, Firefox y Safari.

### 2.3 Performance

- Primera carga optimizada para vista publica (contenido principal legible sin interacciones complejas).
- Evitar JS innecesario en paginas estaticas cuando no haga falta estado cliente.

### 2.4 Accesibilidad

- Controles interactivos con etiquetas descriptivas.
- Navegacion por teclado en elementos clave.
- Contraste suficiente entre texto y fondo.
- Dialogos/modales con `aria-*` y cierre por `Esc` cuando aplique.

### 2.5 Mantenibilidad

- Estructura de rutas y componentes predecible.
- Convenciones de estilo centralizadas en `globals.css` y clases de utilidad.
- Documentacion actualizada en `apps/web/docs`.

### 2.6 Calidad de codigo

- `eslint` debe pasar en cada cambio.
- TypeScript en modo estricto del paquete `web`.

## 3. Restricciones actuales

- Sin contrato final de API en frontend.
- Sin flujo de autenticacion productivo conectado al backend.
- Sin suite de tests automatizados en `apps/web` por el momento.
