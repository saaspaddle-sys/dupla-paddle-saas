<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Next.js 16 — read the bundled docs first

This is not boilerplate: this is Next 16.2, and its APIs differ from most training data. The authoritative docs for the _installed_ version ship inside the package:

```
node_modules/next/dist/docs/01-app/01-getting-started/   # layouts, data fetching, caching, metadata
node_modules/next/dist/docs/01-app/02-guides/            # auth, forms, env vars, proxy, ISR
node_modules/next/dist/docs/01-app/03-api-reference/     # per-API reference
```

Read the relevant guide before writing routing, caching, data-fetching, or `proxy` code. Note `16-proxy.md` — what older versions called middleware.

<!-- END:nextjs-agent-rules -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Repo-wide context (product, tenancy invariant, team workflow, monorepo rules, CI shape) lives in the root `CLAUDE.md` — it applies here too and is not repeated. This file covers only `apps/web`.

The tenancy invariant matters here even though this package holds no queries: club screens read data already scoped to the authenticated user's club, so never send a `club_id` from the client to a club endpoint. The public view is unauthenticated and read-only.

## Commands

Run from the repo root (pnpm workspace, single lockfile):

```bash
pnpm run dev:web                 # dev server on port 3001 (API occupies 3000)
pnpm --filter web run build      # production build
pnpm --filter web run lint       # bare `eslint`, flat config
```

There is no test setup in this package yet — nothing to run, and no framework has been chosen.

## Stack specifics

- **App Router under `src/app/`.** `@/*` maps to `./src/*` — use it instead of deep relative paths.
- **Tailwind v4, CSS-first.** There is no `tailwind.config.*` by design. Theme tokens are declared in `src/app/globals.css` via `@import "tailwindcss"` + `@theme inline`; add colors/fonts there as CSS custom properties, not in a JS config.
- **TypeScript is fully `strict`** here, unlike `apps/api` (which relaxes `noImplicitAny`). `moduleResolution: bundler`.
- Fonts come from `next/font/google` (Geist) and are wired as CSS variables in `src/app/layout.tsx`.

## State of the code

`src/app/` is still the untouched create-next-app scaffold — placeholder `page.tsx`, default "Create Next App" metadata in `layout.tsx`, and unused Vercel/Next SVGs in `public/`. Delete scaffold remnants as you replace them rather than building around them.

Nothing talks to the API yet: no fetch wrapper, no auth handling, no shared types with `apps/api`. The first feature to need one should establish that layer deliberately and record the choice in `docs/decisions.md`, per the root workflow rules.

## Product constraints that shape this app

Two distinct surfaces, per `docs/product-brief.md`: an authenticated area for club staff, and a **public, no-login view** for players to see brackets and results. Keep the public surface free of auth-dependent code paths and cheap to render — it is the one most players will hit.
