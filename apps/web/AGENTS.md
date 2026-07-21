<!-- BEGIN:nextjs-agent-rules -->

# Este NO es el Next.js que conocés

Esta versión tiene breaking changes — las APIs, convenciones y estructura de archivos pueden diferir de tu training data. Leé la guía correspondiente en `node_modules/next/dist/docs/` antes de escribir código. Prestá atención a los avisos de deprecación.

## Next.js 16 — leé primero las docs incluidas

Esto no es boilerplate: es Next 16.2, y sus APIs difieren de la mayoría del training data. Las docs autoritativas de la versión _instalada_ vienen dentro del paquete:

```
node_modules/next/dist/docs/01-app/01-getting-started/   # layouts, data fetching, caching, metadata
node_modules/next/dist/docs/01-app/02-guides/            # auth, forms, env vars, proxy, ISR
node_modules/next/dist/docs/01-app/03-api-reference/     # referencia por API
```

Leé la guía correspondiente antes de escribir código de routing, caching, data-fetching, o `proxy`. Ojo con `16-proxy.md` — lo que en versiones anteriores se llamaba middleware.

<!-- END:nextjs-agent-rules -->

Este archivo le da contexto a Claude Code (claude.ai/code) para trabajar en este repositorio.

El contexto que aplica a todo el repo (producto, invariante de tenancy, workflow del equipo, reglas del monorepo, forma de la CI) vive en el `CLAUDE.md` raíz — también aplica acá y no se repite. Este archivo cubre solo `apps/web`.

La invariante de tenancy importa acá aunque este paquete no tenga queries propias: las pantallas de club leen datos que ya vienen filtrados por el club del usuario autenticado, así que nunca mandes un `club_id` desde el cliente a un endpoint de club. La vista pública no requiere autenticación y es de solo lectura.

## Comandos

Corré desde la raíz del repo (workspace de pnpm, un solo lockfile):

```bash
pnpm run dev:web                 # servidor de dev en el puerto 3001 (la API ocupa el 3000)
pnpm --filter web run build      # build de producción
pnpm --filter web run lint       # `eslint` a secas, flat config
```

Todavía no hay setup de tests en este paquete — no hay nada que correr, y no se eligió framework.

## Detalles del stack

- **App Router bajo `src/app/`.** `@/*` mapea a `./src/*` — usalo en vez de rutas relativas largas.
- **Tailwind v4, CSS-first.** No hay `tailwind.config.*` a propósito. Los theme tokens se declaran en `src/app/globals.css` vía `@import "tailwindcss"` + `@theme inline`; agregá colores/fuentes ahí como CSS custom properties, no en un config de JS.
- **TypeScript es totalmente `strict`** acá, a diferencia de `apps/api` (que relaja `noImplicitAny`). `moduleResolution: bundler`.
- Las fuentes vienen de `next/font/google` (Geist) y están conectadas como variables CSS en `src/app/layout.tsx`.

## Estado del código

`src/app/` todavía es el scaffold intacto de create-next-app — `page.tsx` de placeholder, metadata default de "Create Next App" en `layout.tsx`, y SVGs de Vercel/Next sin usar en `public/`. Borrá los restos del scaffold a medida que los reemplacés, en vez de construir alrededor de ellos.

Nada habla con la API todavía: no hay fetch wrapper, no hay manejo de auth, no hay tipos compartidos con `apps/api`. La primera feature que lo necesite debería establecer esa capa a propósito y registrar la decisión en `docs/decisions.md`, según las reglas de workflow de la raíz.

## Restricciones de producto que le dan forma a esta app

Dos superficies distintas, según `docs/product-brief.md`: un área autenticada para el staff del club, y una **vista pública, sin login** para que los jugadores vean brackets y resultados. Mantené la superficie pública libre de code paths que dependan de auth y barata de renderizar — es la que va a ver la mayoría de los jugadores.
