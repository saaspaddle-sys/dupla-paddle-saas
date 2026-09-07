/**
 * Emite el documento OpenAPI a `apps/api/openapi.json` sin levantar el servidor
 * ni tocar la base.
 *
 * Por qué existe: `docs/api-conventions.md` define que lo que el frontend consume
 * es el documento OpenAPI, no la spec en prosa ni el código. Pero servirlo solo en
 * `/docs` obliga a quien trabaja en `apps/web` a clonar la API, levantar Postgres y
 * bootear Nest para leer un contrato. Commitear el artefacto lo vuelve legible desde
 * el repo, y el check de CI lo mantiene sincronizado igual que el drift de Prisma.
 *
 * Corre sobre el build (`dist/`), no sobre las fuentes: el plugin `@nestjs/swagger`
 * de `nest-cli.json` es un transformer de compilación — es el que deriva los
 * `@ApiProperty` de los tipos y los comentarios. Ejecutar esto con ts-node saltea el
 * plugin y emite un documento con los DTOs vacíos.
 *
 * Uso:
 *   pnpm run openapi          # regenera el archivo
 *   pnpm run openapi:check    # falla si quedó desincronizado (CI)
 */
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { buildSwaggerDocument } from './swagger.setup';

/**
 * `__dirname` es `dist/swagger` al correr el build y `src/swagger` con ts-node:
 * dos niveles para arriba es la raíz del paquete en ambos casos.
 */
const OUTPUT_PATH = resolve(__dirname, '../../openapi.json');

/** Ruta relativa a la raíz del monorepo, para los mensajes de error. */
const DISPLAY_PATH = 'apps/api/openapi.json';

/**
 * Este script es la única autoridad sobre el formato del archivo: por eso
 * `openapi.json` está en `.prettierignore`. Prettier colapsa los arrays cortos en una
 * línea y `JSON.stringify` no — con los dos formateando, cada `format --write` dejaría
 * el archivo en un estado que el `--check` de acá lee como drift.
 */
function serialize(document: object): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Construye el documento sin instanciar un solo provider.
 *
 * `preview: true` arma el grafo de módulos y registra los controllers, pero no crea
 * instancias ni corre hooks de ciclo de vida. Eso es justo lo que hace falta: Swagger
 * lee metadata de las clases vía Reflect, no de los objetos. Sin esto, `PrismaService`
 * exige `DATABASE_URL` en el constructor y abre conexión en `onModuleInit`, y generar
 * un contrato terminaría necesitando una base corriendo.
 */
async function buildDocument(): Promise<object> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });

  try {
    return buildSwaggerDocument(app);
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const generated = serialize(await buildDocument());

  if (!checkOnly) {
    await writeFile(OUTPUT_PATH, generated, 'utf8');
    console.log(`OpenAPI escrito en ${DISPLAY_PATH}`);
    return;
  }

  if (!existsSync(OUTPUT_PATH)) {
    console.error(
      `Falta ${DISPLAY_PATH}. Corré "pnpm --filter api run openapi" y commiteá el resultado.`,
    );
    process.exitCode = 1;
    return;
  }

  if (readFileSync(OUTPUT_PATH, 'utf8') !== generated) {
    console.error(
      `${DISPLAY_PATH} quedó desactualizado respecto de los controllers.\n` +
        'Corré "pnpm --filter api run openapi" y commiteá el resultado.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`${DISPLAY_PATH} está sincronizado.`);
}

void main();
