# dupla — web

Frontend Next.js 16 (App Router, Tailwind v4) de [dupla](../../README.md). En dev corre en el puerto 3001 — la API está en el 3000.

```bash
pnpm install               # desde la raíz del repo
pnpm run dev:web           # servidor de dev (:3001)
pnpm --filter web run build
pnpm --filter web run lint
```

Las convenciones del paquete — docs de Next 16 que hay que leer primero, stack, estado del scaffold — están en [`AGENTS.md`](./AGENTS.md).
