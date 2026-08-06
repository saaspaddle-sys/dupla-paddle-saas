# Deployment Frontend

## 1. Entorno local

Requisitos:

- Node 24
- pnpm (corepack habilitado); la versión está pineada en el `package.json` raíz

Comandos desde la raíz del monorepo:

```bash
pnpm install
pnpm run dev:web
```

URL local esperada:

- `http://localhost:3001` (la API usa el 3000)

## 2. Build de producción

```bash
pnpm --filter web run build
pnpm --filter web run start
```

> Si el build falla con un error de tipos en `.next/dev/types/validator.ts` que apunta a una página que ya no existe, es un artefacto rancio de una sesión previa de `dev`: borrá `apps/web/.next` y volvé a buildear. La CI arranca de un checkout limpio y no lo sufre.

## 3. Variables de entorno

Estado actual:

- el frontend todavía no consume endpoints productivos.
- no hay archivo de variables de API en uso activo.

Cuando se integre la API, definir:

- `NEXT_PUBLIC_API_BASE_URL`
- las demás variables de cliente necesarias para auth o feature flags.

Todo lo que lleve el prefijo `NEXT_PUBLIC_` queda expuesto en el bundle del navegador: nunca poner secretos ahí.

## 4. Verificaciones previas a merge

```bash
pnpm --filter web run lint
pnpm --filter web run build
pnpm run format:check      # el mismo check que corre la CI sobre todo el repo
```

## 5. CI

`.github/workflows/ci.yml` corre en cada PR, con Node 24 y `pnpm install --frozen-lockfile`. Del lado de web:

- job `web`: lint y build.
- job `format`: `prettier --check` sobre todo el repo.

## 6. Hosting

Sin decidir todavía, a propósito (`docs/decisions.md`, 2026-07-16). Los Dockerfiles de producción quedan para cuando se elija; en dev, las apps corren nativas y Docker solo levanta Postgres.

## 7. Riesgos conocidos

- Hay links de navegación hacia rutas que todavía no existen (`/torneos`, `/partidos`, `/jugadores`, `/sedes`, `/clasificaciones`): dan 404. Detalle en `Requirements.md`.
- Sin API integrada no hay validación end-to-end de flujos reales.
- La metadata del layout raíz sigue siendo la del scaffold ("Create Next App"): corregirla antes de cualquier deploy público, porque afecta el SEO de la vista pública.
