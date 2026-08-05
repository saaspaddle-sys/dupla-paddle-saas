# Deployment Frontend

## 1. Entorno local

Requisitos:

- Node 24
- pnpm (corepack habilitado)

Comandos desde la raiz del monorepo:

```bash
pnpm install
pnpm run dev:web
```

URL local esperada:

- `http://localhost:3001`

## 2. Build de produccion

```bash
pnpm --filter web run build
pnpm --filter web run start
```

## 3. Variables de entorno

Estado actual:

- el frontend no consume aun endpoints productivos.
- no hay archivo de variables especifico para API en uso activo.

Cuando se integre API, definir:

- `NEXT_PUBLIC_API_BASE_URL`
- otras variables de cliente necesarias para auth o feature flags.

## 4. Verificaciones previas a merge

```bash
pnpm --filter web run lint
pnpm --filter web run build
```

## 5. CI

En CI general del repo se ejecuta:

- lint web
- build web
- format check global

## 6. Riesgos conocidos

- rutas en construccion pueden existir como placeholder (`/admin`, `/torneos`, `/partidos`, `/players`, `/sedes`).
- sin API integrada no hay validacion end-to-end de flujos reales.
