# Requisitos Frontend

## 1. Requisitos funcionales

1. Mostrar una home pública con acceso a torneos, partidos, ranking y sedes.
2. Permitir el registro de jugador mediante formulario de UI.
3. Exponer el acceso a login mediante un modal desde el `Header`; no existe ruta propia de login.
4. Exponer navegación pública consistente mediante `Header` y `Footer`.
5. Ofrecer la base de route groups para las áreas privadas del jugador (`(players)`) y del club (`(customers)`).
6. Mantener compatibilidad de rutas históricas cuando aplique (por ejemplo, el alias `/auth/register` hacia `/register`).

## 2. Convención de URLs

- Las rutas públicas se nombran **en español**, igual que los links del `Header` y del `Footer`: `/torneos`, `/partidos`, `/jugadores`, `/sedes`, `/ranking`.
- Los **route groups** (`(public)`, `(auth)`, `(players)`, `(customers)`) se nombran en inglés y **no generan segmento de URL**: organizan el código, no la navegación. Que exista `(players)/` no implica que exista `/players`.
- Registrado en `docs/decisions.md` (2026-08-06).

## 3. Estado de las rutas

### Implementadas

- `/` — home pública.
- `/register` — registro de jugador.
- `/ranking` — vista pública de ranking (datos hardcodeados).
- `/admin` — placeholder.
- `/auth/register` — alias de compatibilidad que redirige a `/register`.

### Enlazadas pero todavía inexistentes (404 hoy)

Desde el `Header`: `/torneos`, `/jugadores`, `/partidos`, `/sedes`.
Desde la home y el `Footer`: `/clasificaciones`, `/institucional/*`, `/jugadores/seguro`, `/privacidad`.

> Pendiente de definición: la home y el `Footer` enlazan `/clasificaciones` para ranking, mientras que el `Header` enlaza `/ranking`, que es la que existe. Hay que decidir si son la misma pantalla (unificar la URL) o si `/clasificaciones` es el ranking histórico y `/ranking` el vigente.

## 4. Requisitos no funcionales

### 4.1 Responsive

- El frontend debe funcionar correctamente en mobile, tablet y desktop.
- Breakpoints mínimos a cubrir: `sm`, `md`, `lg`.

### 4.2 Navegadores soportados

- Últimas 2 versiones estables de Chrome, Edge, Firefox y Safari.

### 4.3 Performance

- Primera carga optimizada para la vista pública (contenido principal legible sin interacciones complejas).
- Evitar JS innecesario en páginas estáticas cuando no haga falta estado de cliente.

### 4.4 Accesibilidad

- Controles interactivos con etiquetas descriptivas.
- Navegación por teclado en elementos clave.
- Contraste suficiente entre texto y fondo.
- Diálogos y modales con `aria-*` y cierre por `Esc` cuando aplique.

### 4.5 Mantenibilidad

- Estructura de rutas y componentes predecible.
- Convenciones de estilo centralizadas en `globals.css` y clases de utilidad.
- Documentación actualizada en `apps/web/docs`.

### 4.6 Calidad de código

- `eslint` debe pasar en cada cambio.
- TypeScript en modo estricto del paquete `web`.
- `prettier --check` debe pasar sobre todo el repo (check `format` de la CI).

## 5. Restricciones de seguridad

- El frontend **nunca** manda un `club_id` a un endpoint del club: el scoping sale del usuario autenticado en el backend. Ver `API.md` y `docs/decisions.md`.
- La superficie pública es de solo lectura y sin auth.

## 6. Restricciones actuales

- Sin contrato final de API en el frontend.
- Sin flujo de autenticación productivo conectado al backend.
- Sin suite de tests automatizados en `apps/web` por el momento (no hay framework elegido).
