import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 no autocarga .env. El .env vive en la raíz del monorepo;
// todos los comandos de Prisma corren vía `pnpm --filter api`, así que cwd == apps/api.
config({ path: resolve(process.cwd(), '../../.env') });

// Sin `env('DATABASE_URL')` a propósito: ese helper tira si la variable falta, y lo hace
// al *cargar* este archivo — o sea que rompe todo comando de Prisma, incluso los que no
// tocan la base. El caso concreto es el `prisma generate` del postinstall, que corre en
// cada `pnpm install`: en los jobs `web` y `format` de la CI (que no definen DATABASE_URL)
// y en un clone recién bajado (que todavía no tiene .env) el install entero se caía.
// Con el placeholder, generate funciona sin DATABASE_URL y los comandos que sí necesitan
// conexión siguen fallando, pero recién al conectarse y con el host diciendo qué falta.
const url = process.env.DATABASE_URL ?? 'postgresql://falta-DATABASE_URL';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: { url },
});
