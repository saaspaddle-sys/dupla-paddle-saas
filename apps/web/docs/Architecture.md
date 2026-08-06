# Arquitectura Frontend

## Stack base

- Next.js 16.2.10 (App Router)
- React 19
- Tailwind CSS v4 (CSS-first, con tokens en `globals.css`)
- TypeScript strict

Las APIs de Next 16 difieren de versiones anteriores: antes de escribir código de routing, caching, data fetching o `proxy`, leé las docs de la versión instalada en `node_modules/next/dist/docs/` (ver `apps/web/AGENTS.md`).

## Estructura de carpetas

```text
apps/web/src/app
	layout.tsx              # layout raíz: fuentes Geist y base del documento
	globals.css             # tokens de tema (@theme) y estilos base
	(public)/               # superficie pública sin login
		page.tsx              # home
		component/            # Header, Footer, FooterColumn, card
		ranking/page.tsx      # /ranking
	(auth)/                 # registro y login
		layout.tsx
		register/page.tsx     # /register
		login/component/      # LoginModal (sin ruta propia)
	(players)/layout.tsx    # área privada del jugador
	(customers)/layout.tsx  # área privada del club (panel del staff)
	admin/                  # /admin (placeholder)
	auth/register/page.tsx  # alias → /register
```

## Route groups y segmentos

- Un directorio entre paréntesis es un **route group**: organiza el código y **no aparece en la URL**. `(players)/` no crea `/players`.
- Un directorio sin paréntesis sí es un segmento real de URL: `admin/` es `/admin`, `auth/register/` es `/auth/register`.
- `(public)` contiene la experiencia abierta; `(auth)`, las pantallas de autenticación.
- `(customers)` es el panel del **club** (el tenant), y `(players)` el área del **jugador** (perfil global). Ver el mapeo completo en `Vision.md`.
- `/auth/*` se usa para alias y compatibilidad de rutas.
- El login no tiene ruta propia: se abre como modal desde el header.

## Patrones utilizados

1. Composición por layouts:

- `layout.tsx` raíz aplica fuentes y base visual global.
- los layouts por sección permiten escalar reglas por dominio; hoy `(auth)`, `(players)` y `(customers)` son passthrough.

2. Componentes reutilizables:

- `Header`, `Footer` y `Card` en `(public)/component`.

3. Estado local con hooks:

- se usa `useState` y `useEffect` en componentes cliente.
- ejemplos: toggle de password y control del modal de login.

4. Tokens de UI centralizados:

- colores y sombras en `src/app/globals.css` vía `@theme`.

## Flujo de navegación actual

1. Entrada principal: `/` (home pública).
2. Registro: `/register` (formulario de jugador).
3. Login: modal desde el header; no existe ruta propia.
4. Alias histórico: `/auth/register` redirige a `/register`.
5. Ranking: `/ranking`, vista pública con datos hardcodeados.
6. Panel admin: `/admin` (placeholder).

El resto de los links del `Header` y del `Footer` apuntan a rutas todavía inexistentes; el detalle está en `Requirements.md`.

## Manejo de estado

- Estado local por pantalla o componente.
- No hay store global todavía (Redux/Zustand/Context de dominio).
- No hay capa de servicios de API integrada.

## Estrategia de crecimiento

1. Separar público y privado por route groups y guards.
2. Agregar una capa `services/` para las llamadas HTTP, respetando `docs/api-conventions.md` y el invariante de tenancy (`API.md`).
3. Introducir contextos de auth/usuario al activar el login real; la superficie visible se deriva de tener `Player`, `Club` o ambos, no de un flag de rol (`docs/decisions.md`, 2026-07-23).
4. Agregar manejo consistente de errores y loading por ruta, sobre los códigos HTTP de `docs/api-conventions.md`.
5. Mantener la superficie pública sin code paths dependientes de auth.
