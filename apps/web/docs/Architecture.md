# Arquitectura Frontend

## Stack base

- Next.js 16.2.10 (App Router)
- React 19
- Tailwind CSS v4 (CSS-first con tokens en `globals.css`)
- TypeScript strict

## Estructura de carpetas

```text
apps/web
	src/app
		layout.tsx
		globals.css
		(public)/
		(auth)/
			login/
				component/
		(players)/
		(customers)/
		admin/
		auth/
		(public)/ranking/
```

## Route groups y segmentos

- `(...)` en Next organiza codigo pero no aparece en URL.
- `/(public)` contiene experiencia abierta.
- `/(auth)` contiene pantallas de autenticacion.
- `/auth/*` se usa para alias o compatibilidad de rutas.
- El login ya no tiene ruta propia: se abre como modal desde el header.

## Patrones utilizados

1. Composicion por layouts:

- `layout.tsx` raiz aplica fuentes y base visual global.
- layouts por seccion permiten escalar reglas por dominio.

2. Componentes reutilizables:

- Header, Footer y Card en `/(public)/component`.

3. Estado local con hooks:

- Se usa `useState` y `useEffect` en componentes cliente.
- Ejemplo: toggle de password y control de modal de login.

4. Tokens de UI centralizados:

- Colores y sombras en `src/app/globals.css` via `@theme`.

## Flujo de navegacion actual

1. Entrada principal: `/` (home publica).
2. Registro: `/register` (pantalla de formulario).
3. Login: modal abierto desde el header; no existe ruta propia.
4. Alias historico: `/auth/register` redirige a `/register`.
5. Ranking: `/ranking` ya existe y muestra la vista publica de posiciones.
6. Panel admin: `/admin` (placeholder).

## Manejo de estado

- Estado local por pantalla/componente.
- No hay store global aun (Redux/Zustand/Context de dominio).
- No hay capa de servicios API integrada en este momento.

## Estrategia de crecimiento

1. Separar publico y privado por route groups y guards.
2. Agregar capa `services/` para llamadas HTTP cuando se defina contrato API.
3. Introducir contextos de auth/usuario al activar login real.
4. Agregar manejo consistente de errores y loading por ruta.
