# Documentación Técnica Frontend

## 1. Páginas actuales

- `/` → home pública.
- `/register` → formulario de registro de jugador.
- `/ranking` → vista pública de ranking, con datos hardcodeados.
- `/admin` → placeholder de panel administrativo.
- `/auth/register` → alias que redirige a `/register`.
- `/login` → no existe como ruta; el acceso se abre desde el `LoginModal` del header.

## 2. Layouts

- `src/app/layout.tsx`:
  - layout raíz de toda la app.
  - inyecta las fuentes Geist y las clases base del documento.

- `src/app/(auth)/layout.tsx`:
  - contenedor de las rutas de auth, actualmente passthrough.

- `src/app/(players)/layout.tsx`:
  - base de las futuras rutas privadas del jugador (perfil global). Passthrough.

- `src/app/(customers)/layout.tsx`:
  - base del panel privado del club (staff del tenant). Passthrough.

- `src/app/admin/layout.tsx`:
  - contenedor del panel interno de plataforma.

## 3. Componentes reutilizables

- `Header` (`(public)/component/header.tsx`):
  - navegación principal superior.
  - links a torneos, jugadores, partidos en vivo, ranking y sedes.
  - contiene el estado que abre el `LoginModal`.

- `Footer` y `FooterColumn`:
  - enlaces institucionales, de jugadores y redes sociales.

- `Card`:
  - tarjeta reutilizable para los bloques de la home.

- `LoginModal` (`(auth)/login/component/loginModal.tsx`):
  - modal cliente con cierre por backdrop, botón `X` y `Esc`, bloqueo de scroll del `body` y toggle de visibilidad de password.

## 4. Hooks y estado

- `useState` para formularios y toggles de UI.
- `useEffect` en el modal para los side effects de teclado y del scroll del `body`.
- Sin contextos globales activos todavía.

## 5. Servicios y datos

- No existe capa de servicios HTTP integrada.
- No hay fetch centralizado ni cliente de API compartido.
- No hay cache de datos de servidor en el frontend.
- Los datos que se ven hoy (ranking, cards de la home) son estáticos en el código.

Cuando se cree la capa `services/`, arranca por `API.md` — sobre todo por el invariante de tenancy.

## 6. Convenciones de código

1. Alias de imports:

- usar `@/` para rutas bajo `src/` en vez de rutas relativas largas.

2. Styling:

- usar utilidades Tailwind.
- usar los tokens declarados en `globals.css` para colores semánticos.

3. App Router:

- respetar los route groups para separar dominios (`public`, `auth`, `players`, `customers`).
- recordar que un route group no genera segmento de URL.

4. Calidad:

- correr `pnpm --filter web run lint` y `pnpm --filter web run build` antes de commitear.
- el check `format` de la CI corre `prettier --check` sobre todo el repo.

## 7. Pendientes técnicos

- Integrar la autenticación real con el backend.
- Definir la estrategia de protección de rutas privadas.
- Crear la capa de servicios/API y el tipado de respuestas.
- Incorporar tests de frontend (falta elegir framework).
- Corregir el `body` de `globals.css` para que use Geist como fuente efectiva en lugar de Arial.
- Reemplazar los restos del scaffold de create-next-app: la metadata de `layout.tsx` sigue siendo "Create Next App" y el `<html lang="en">` debería ser `es`.
