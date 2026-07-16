# dupla

SaaS de torneos de pádel para clubes: torneos, llaves automáticas, resultados y vista pública gratuita para jugadores.

Monorepo pnpm:

- `apps/api` — backend NestJS (puerto 3000)
- `apps/web` — frontend Next.js (puerto 3001 en dev)

Documentación: [`docs/product-brief.md`](docs/product-brief.md) (producto y alcance) · [`docs/decisions.md`](docs/decisions.md) (decisiones técnicas).

## Desarrollo

```bash
pnpm install
pnpm run start:dev   # API con hot-reload
pnpm run dev:web     # frontend
pnpm run test        # tests de todos los packages
pnpm run lint        # lint de todos los packages
```
