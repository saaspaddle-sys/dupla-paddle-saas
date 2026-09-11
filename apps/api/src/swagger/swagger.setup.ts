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
 * Los dominios de negocio de `docs/api-conventions.md`. Todo controller declara
 * el suyo con `@ApiTags(SWAGGER_TAGS.x)` — no strings sueltos, que es como el doc termina
 * con "tournaments", "Tournaments" y "tournament" como tres tags distintos.
 *
 * La clase del endpoint (`club`, `public`, `platform` u `ops`) sigue siendo un
 * contrato separado: define auth y scoping, no el agrupamiento visual de Swagger.
 */
export const SWAGGER_TAGS = {
  auth: 'Auth',
  clubs: 'Clubs',
  players: 'Players',
  tournaments: 'Tournaments',
  matches: 'Matches',
  operations: 'Operations',
} as const;

/**
 * Versión del **contrato**, no del paquete: sube cuando la API rompe compatibilidad,
 * no cuando cambia el `version` de `package.json`.
 */
const API_VERSION = '1.0';

const API_DESCRIPTION = [
  'API de dupla — SaaS de torneos de pádel para clubes.',
  '',
  'Los endpoints se agrupan por dominio de negocio. Su clase de acceso es un',
  'contrato separado: `club` (JWT de staff y scoping por el club del usuario),',
  '`public` (solo lectura y sin auth), `platform` (entidades globales sin',
  '`club_id`) u `ops` (infraestructura).',
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
      SWAGGER_TAGS.auth,
      'Autenticación y sesión de usuarios de la plataforma.',
    )
    .addTag(SWAGGER_TAGS.clubs, 'Gestión del club y su suscripción.')
    .addTag(SWAGGER_TAGS.players, 'Registro y perfiles globales de jugadores.')
    .addTag(SWAGGER_TAGS.tournaments, 'Torneos, duplas inscriptas y cuadros.')
    .addTag(SWAGGER_TAGS.matches, 'Partidos y carga de resultados.')
    .addTag(
      SWAGGER_TAGS.operations,
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
      // Sin sorter: Swagger UI conserva el orden explícito de las tags del documento.
      operationsSorter: 'alpha',
      displayRequestDuration: true,
    },
  });

  return SWAGGER_PATH;
}
