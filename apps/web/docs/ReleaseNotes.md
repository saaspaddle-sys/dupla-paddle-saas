# Release Notes Frontend

Historial de cambios funcionales de `apps/web`. Se actualiza en el mismo PR que introduce el cambio.

## v0.1.0 — 2026-07-28

### Agregado

- Home pública con cards informativas, imagen de fondo y footer (#11, #13, #14, #20, #18).
- Pantalla de registro de jugador con formulario extenso y categorías según sexo (#15).
- Login como modal abierto desde el header; se eliminó la ruta `/login` (#19).
- Vista pública de ranking, como **plantilla con datos hardcodeados** (#21).
- Alias de compatibilidad `/auth/register` hacia `/register`.
- Base de pantallas para admin.

### UI/UX

- Sistema visual inicial con tokens de color en `globals.css`.
- Componentes reutilizables `Header`, `Footer`, `FooterColumn`, `Card`.

### Estado técnico

- Sin integración de API todavía: todos los datos que se ven están estáticos en el código.
- Sin flujo de autenticación productivo conectado al backend.
- Lint operativo con `eslint`.

## v0.0.1 — 2026-07-16

### Inicial

- Scaffold de Next.js 16 en el monorepo de pnpm (#2).
- Configuración base de TypeScript, Tailwind v4 y App Router.

## Sin publicar

- Documentación del frontend en `apps/web/docs` (esta carpeta).
- Corrección del tipeo en la carpeta del modal de login: `componenet/` → `component/`.
- Unificación del link "Jugadores" del header a `/jugadores`, siguiendo la convención de URLs públicas en español.
