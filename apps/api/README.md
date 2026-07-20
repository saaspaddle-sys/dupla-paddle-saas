# dupla — api

Backend NestJS de [dupla](../../README.md). Corre en el puerto 3000.

```bash
pnpm install                    # desde la raíz del repo
pnpm run start:dev              # watch mode
pnpm --filter api run test      # tests unitarios
pnpm --filter api run test:e2e  # tests e2e
```

Las convenciones del paquete — estado del scaffold, los dos setups de Jest, lint local vs CI, detalles de TypeScript — están en [`AGENTS.md`](./AGENTS.md). El contrato de la API está en [`docs/api-conventions.md`](../../docs/api-conventions.md).
