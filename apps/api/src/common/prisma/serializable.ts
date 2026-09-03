import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Código de Prisma para el fallo de serialización de Postgres (SQLSTATE
 * 40001). Bajo `Serializable`, Postgres aborta una de las transacciones que
 * se pisan en vez de dejar pasar un resultado inconsistente: recibir este
 * error es el funcionamiento normal del nivel de aislamiento, no una falla
 * de la base.
 */
const SERIALIZATION_FAILURE_CODE = 'P2034';

/**
 * Intentos totales: el original más dos reintentos.
 *
 * Es un tope duro y **no** un `while (true)`, por la misma razón por la que
 * la derivación de slugs de `ClubsService` prueba cinco candidatos y se
 * rinde: reintentar sin techo contra un conflicto que no cede cuelga el
 * request, mantiene una conexión de Postgres tomada y convierte una ráfaga
 * de escrituras concurrentes en una tormenta de transacciones que se
 * abortan entre sí. Tres intentos alcanzan para el caso real —dos
 * escrituras del mismo tenant que se cruzan— y el caso patológico falla en
 * tiempo acotado con el error real de Postgres, que es información honesta
 * para el cliente y para el log.
 */
export const SERIALIZABLE_MAX_ATTEMPTS = 3;

/**
 * Lo único que `runSerializable` necesita del cliente. Se deriva de
 * `PrismaService` con `Pick` en vez de redeclarar la firma, para que no se
 * desincronice con la del cliente generado cuando Prisma cambie de versión.
 */
export type SerializableTransactionHost = Pick<PrismaService, '$transaction'>;

/** `true` solo para el 40001 de Postgres; cualquier otro error es otra cosa. */
export function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === SERIALIZATION_FAILURE_CODE
  );
}

/**
 * Corre `handler` dentro de una transacción `Serializable` y la reintenta
 * mientras Postgres la aborte por conflicto de serialización, hasta
 * `SERIALIZABLE_MAX_ATTEMPTS` intentos. Cualquier otro error sube en el
 * primer intento: un `ConflictException` de negocio (cuota, duplicado) es
 * una respuesta, no una carrera, y reintentarlo solo gastaría dos viajes
 * más a la base para devolver lo mismo.
 *
 * Agotados los intentos, el error del último sube tal cual. Por eso la
 * última pasada corre fuera del `for`: no hace falta una variable
 * `lastError` ni un `throw` inalcanzable al final para que TypeScript vea
 * que la función siempre termina.
 *
 * `handler` tiene que ser idempotente — puede ejecutarse más de una vez.
 */
export async function runSerializable<T>(
  prisma: SerializableTransactionHost,
  handler: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const attempt = (): Promise<T> =>
    prisma.$transaction(handler, { isolationLevel: 'Serializable' });

  for (let index = 1; index < SERIALIZABLE_MAX_ATTEMPTS; index += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!isSerializationFailure(error)) {
        throw error;
      }
    }
  }

  return attempt();
}
