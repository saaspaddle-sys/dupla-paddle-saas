/**
 * Slugs de URL pública. Vive en `common/` y no en `clubs/` porque el mismo
 * formato lo va a necesitar cualquier recurso que exponga una URL elegida
 * por el cliente (un torneo público, en fase 2).
 *
 * Hoy solo hay derivación: el cliente no manda slug (ver `CreateClubDto`).
 * La mitad de validación de entrada —regex de formato y su `@Transform`—
 * entra el día que exista un campo de entrada que validar, no antes.
 */

export const SLUG_MAX_LENGTH = 50;

/**
 * Segmentos literales de ruta, presentes o previsibles, que un slug no
 * puede pisar. `me` es el caso concreto de hoy: `GET /clubs/me` es una ruta
 * literal, y un club con slug `me` la ambiguaría el día que exista
 * `GET /clubs/:slug`.
 */
export const RESERVED_SLUGS = [
  'me',
  'new',
  'admin',
  'api',
  'docs',
  'health',
  'auth',
  'clubs',
];

/**
 * Deriva un slug desde el nombre del club. Acá **sí** se transforma el
 * input, a diferencia de `normalizeDni` o `normalizePhone`: lo que entra no
 * es un slug que alguien eligió, es un nombre, y nadie eligió estos
 * caracteres.
 *
 * Devuelve `''` si el nombre no deja ningún carácter ASCII alfanumérico
 * (p. ej. uno íntegramente en un alfabeto que `NFD` no descompone). El
 * caller decide el fallback — acá no se inventa uno, para que el caso quede
 * visible en su sitio.
 */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      // Marcas de combinación: es lo que deja `NFD` al separar los acentos.
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, SLUG_MAX_LENGTH)
      .replace(/^-+|-+$/g, '')
  );
}
