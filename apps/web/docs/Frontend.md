# Documentacion Tecnica Frontend

## 1. Paginas actuales

- `/` -> home publica.
- `/register` -> formulario de registro de jugador.
- `/login` -> pantalla en construccion.
- `/admin` -> placeholder de panel administrativo.
- `/auth/register` -> alias que redirige a `/register`.

## 2. Layouts

- `src/app/layout.tsx`:
  - layout raiz de toda la app.
  - inyecta fuentes Geist y clases base del documento.

- `src/app/(auth)/layout.tsx`:
  - contenedor de rutas de auth, actualmente passthrough.

- `src/app/(players)/layout.tsx`:
  - base de futuras rutas privadas de jugador.

## 3. Componentes reutilizables

- `Header`:
  - navegacion principal superior.
  - links a torneos, jugadores, partidos, ranking y sedes.

- `Footer` y `FooterColumn`:
  - enlaces institucionales, de jugadores y redes.

- `Card`:
  - tarjeta reutilizable para bloques de home.

- `LoginModal`:
  - modal cliente con cierre por backdrop, `Esc`, y toggle de visibilidad de password.

## 4. Hooks y estado

- `useState` para formularios y toggles de UI.
- `useEffect` en modal para side effects de teclado y scroll del `body`.
- Sin contextos globales activos aun.

## 5. Servicios y datos

- No existe capa de servicios HTTP integrada.
- No hay fetch centralizado ni cliente API compartido.
- No hay cache de datos de servidor en frontend por el momento.

## 6. Convenciones de codigo

1. Alias de imports:

- usar `@/` para rutas bajo `src/` cuando aplique.

2. Styling:

- usar utilidades Tailwind.
- usar tokens declarados en `globals.css` para colores semanticos.

3. App Router:

- respetar route groups para separar dominios (public, auth, players).

4. Calidad:

- correr `pnpm --filter web run lint` antes de commit.

## 7. Pendientes tecnicos

- Integrar autenticacion real con backend.
- Definir estrategia de proteccion de rutas privadas.
- Crear capa de servicios/API y tipado de respuestas.
- Incorporar tests frontend (a definir framework).
