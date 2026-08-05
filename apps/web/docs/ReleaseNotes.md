# Release Notes Frontend

## v0.1.0 - 2026-07-24

### Agregado

- Estructura inicial de documentacion en `apps/web/docs`.
- Home publica con cards informativas y footer.
- Pantalla de registro de jugador con formulario extenso.
- Login modal abierto desde el header.
- Vista publica de ranking.
- Imagen principal de fondo en la home.
- Base de pantallas para admin.

### UI/UX

- Sistema visual inicial con tokens de color en `globals.css`.
- Componentes reutilizables `Header`, `Footer`, `FooterColumn`, `Card`.

### Estado tecnico

- Sin integracion de API todavia.
- Sin flujo de autenticacion productivo conectado a backend.
- Lint operativo con `eslint`.

### Pendiente de ajuste documental

- La convención de actualizar este archivo en cada cambio funcional ya aplica desde el primer release; esta entrada debe seguirse completando en cada PR relevante.

## v0.0.1 - 2026-07-16

### Inicial

- Scaffold de Next.js 16 en monorepo pnpm.
- Configuracion base de TypeScript, Tailwind v4 y App Router.
