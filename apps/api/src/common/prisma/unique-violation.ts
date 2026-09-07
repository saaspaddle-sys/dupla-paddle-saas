import { Prisma } from '../../generated/prisma/client';

/** El `code` de Prisma para una violación de índice único. */
const UNIQUE_VIOLATION_CODE = 'P2002';

/**
 * De qué índice se quejó Postgres, en minúscula, para que el service pueda
 * decidir a qué 409 mapear un P2002.
 *
 * **Existe porque `error.meta.target` no siempre está**, y eso ya nos costó un
 * 500. Prisma 7 no tiene motor de Rust: con el driver adapter de `@prisma/adapter-pg`
 * un P2002 llega así, sin `target` por ningún lado:
 *
 * ```
 * meta: {
 *   modelName: 'Team',
 *   driverAdapterError: {
 *     name: 'DriverAdapterError',
 *     cause: {
 *       originalCode: '23505',
 *       originalMessage: 'duplicate key value violates unique constraint "teams_tournament_id_seed_key"',
 *       kind: 'UniqueConstraintViolation',
 *       constraint: { fields: ['tournament_id', 'seed'] },
 *     },
 *   },
 * }
 * ```
 *
 * Un chequeo escrito solo contra `meta.target` compila, pasa el lint, y no
 * dispara nunca en producción: devuelve la lista vacía y el 409 se convierte
 * en 500. Por eso esta función mira **las tres** formas posibles y devuelve
 * todas las pistas juntas:
 *
 * 1. `meta.target` — array o string. Es la forma clásica del motor, y la que
 *    van a seguir usando los tests que mockean el error a mano.
 * 2. `constraint.fields` — las columnas, en snake_case (`tournament_id`).
 * 3. `constraint.index` — el nombre del índice, cuando el adapter no pudo
 *    resolver las columnas.
 *
 * El llamador compara con `includes` sobre un fragmento (`'seed'`,
 * `'player1'`), así que le sirve cualquiera de las tres: tanto
 * `teams_tournament_id_seed_key` como `seed` contienen `seed`.
 */
export function uniqueViolationTargets(error: unknown): string[] {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_VIOLATION_CODE
  ) {
    return [];
  }

  const meta = error.meta ?? {};
  const cause = ((meta.driverAdapterError as { cause?: unknown } | undefined)
    ?.cause ?? {}) as Record<string, unknown>;
  const constraint = (cause.constraint ?? {}) as Record<string, unknown>;

  return [
    ...toStrings(meta.target),
    ...toStrings(constraint.fields),
    ...toStrings(constraint.index),
  ].map((value) => value.toLowerCase());
}

/** Acepta indistintamente un string, un array de strings, o nada. */
function toStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

/**
 * `true` si el P2002 se queja de un índice que menciona alguno de los
 * fragmentos. Los fragmentos van en minúscula.
 */
export function uniqueViolationMentions(
  error: unknown,
  ...fragments: string[]
): boolean {
  const targets = uniqueViolationTargets(error);
  return targets.some((target) =>
    fragments.some((fragment) => target.includes(fragment)),
  );
}
