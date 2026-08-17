import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Ruta de la UI. El JSON crudo cuelga de `${SWAGGER_PATH}/json` y el YAML de `/yaml`. */
export const SWAGGER_PATH = 'docs';

/**
 * Nombre del security scheme del JWT. El mismo string va en `@ApiBearerAuth(JWT_SECURITY_SCHEME)`
 * en cada endpoint autenticado: si no coinciden, Swagger UI no manda el header.
 */
export const JWT_SECURITY_SCHEME = 'jwt';

/**
 * Las clases de endpoint de `docs/api-conventions.md`. Todo controller declara
 * la suya con `@ApiTags(API_TAGS.x)` — no strings sueltos, que es como el doc termina
 * con "tournaments", "Tournaments" y "tournament" como tres tags distintos.
 *
 * `ops` es la cuarta y no es de negocio: endpoints que consume la infraestructura
 * (`/health`), no un usuario ni el frontend.
 */
export const API_TAGS = {
  club: 'club',
  public: 'public',
  platform: 'platform',
  ops: 'ops',
} as const;

/**
 * Versión del **contrato**, no del paquete: sube cuando la API rompe compatibilidad,
 * no cuando cambia el `version` de `package.json`.
 */
const API_VERSION = '1.0';

const API_DESCRIPTION = [
  'API de dupla — SaaS de torneos de pádel para clubes.',
  '',
  'Los endpoints se agrupan por las tres clases de `docs/api-conventions.md`:',
  '`club` (JWT de staff, scoping por el club del usuario autenticado), `public`',
  '(vista gratuita para jugadores, solo lectura y sin auth) y `platform`',
  '(entidades globales como `Player`, sin `club_id`).',
].join('\n');

/**
 * La doc se sirve salvo en producción. `SWAGGER_ENABLED` fuerza cualquiera de los dos
 * lados: `true` la habilita en un deploy productivo, `false` la apaga en dev.
 */
export function isSwaggerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.SWAGGER_ENABLED !== undefined) {
    return env.SWAGGER_ENABLED === 'true';
  }
  return env.NODE_ENV !== 'production';
}

/** Construye el documento OpenAPI sin montarlo — separado para poder testearlo. */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('dupla API')
    .setDescription(API_DESCRIPTION)
    .setVersion(API_VERSION)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token emitido por la API (Passport + JWT).',
      },
      JWT_SECURITY_SCHEME,
    )
    .addTag(
      API_TAGS.club,
      'Panel del club. Requiere JWT de staff; el scoping sale del `club_id` del usuario autenticado, nunca del request.',
    )
    .addTag(
      API_TAGS.public,
      'Vista pública para jugadores. Solo lectura, sin auth.',
    )
    .addTag(
      API_TAGS.platform,
      'Entidades globales de plataforma (`Player`), sin `club_id`.',
    )
    .addTag(
      API_TAGS.ops,
      'Operacionales, para la infraestructura (health checks). Sin auth y sin datos de negocio.',
    )
    .build();

  return SwaggerModule.createDocument(app, config, {
    // El default es `TournamentsController_findAll`. Sacarle el sufijo deja nombres
    // usables en un cliente generado sin caer en el `findAll` pelado, que colisiona
    // en cuanto dos controllers tengan el mismo nombre de método.
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

/**
 * Monta la UI y el JSON. Se llama desde `main.ts` antes de `listen()`.
 * Devuelve la ruta montada, o `null` si la doc está deshabilitada.
 */
export function setupSwagger(app: INestApplication): string | null {
  if (!isSwaggerEnabled()) {
    return null;
  }

  SwaggerModule.setup(SWAGGER_PATH, app, buildSwaggerDocument(app), {
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
    yamlDocumentUrl: `${SWAGGER_PATH}/yaml`,
    customSiteTitle: 'dupla API',
    swaggerOptions: {
      // Mantiene el token entre reloads: sin esto hay que pegarlo de nuevo en cada F5.
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      displayRequestDuration: true,
    },
  });

  return SWAGGER_PATH;
}
