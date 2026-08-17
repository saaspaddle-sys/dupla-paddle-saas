/**
 * Transforms de normalización para DTOs de entrada.
 *
 * El núcleo de cada regla es una función `string -> string`, sin
 * dependencia de class-validator/class-transformer. Los wrappers
 * `unknown -> unknown` (`normalizeEmailInput`, `normalizeDniInput`, ...)
 * son los que consume `@Transform` — ahí el valor todavía no está
 * garantizado como `string`. El service reaplica el núcleo tipado
 * directamente sobre campos ya validados como `string` por el DTO, sin
 * castear: son idempotentes, y sostener el invariante ahí importa para
 * cuando el service se llame desde otro entry point que no pase por este
 * DTO — p. ej. el alta por el organizador, en un slice futuro.
 */

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Saca puntos, espacios y guiones. A propósito no usa `\D` (todo lo que
 * no sea dígito): "12345678X" tiene que seguir siendo inválido, no
 * normalizarse en silencio a un DNI que nunca se tipeó.
 */
export function normalizeDni(value: string): string {
  return value.replace(/[.\s-]/g, '');
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeText(value: string): string {
  return value.trim();
}

/**
 * Saca los separadores con los que se escribe un teléfono a mano
 * (espacios, guiones, puntos y paréntesis) y deja el `+` inicial. Igual
 * que `normalizeDni`, a propósito no usa `\D`: "+54 whatsapp" tiene que
 * seguir siendo inválido en vez de normalizarse a un número que nadie
 * tipeó.
 */
export function normalizePhone(value: string): string {
  return value.replace(/[.\s()-]/g, '');
}

/**
 * Código de país en mayúsculas ("ar" -> "AR"). El valor válido es un
 * ISO 3166-1 alpha-2; el casing es lo único que se corrige acá, el
 * formato lo valida el DTO.
 */
export function normalizeCountry(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeEmailInput(value: unknown): unknown {
  return typeof value === 'string' ? normalizeEmail(value) : value;
}

export function normalizeDniInput(value: unknown): unknown {
  return typeof value === 'string' ? normalizeDni(value) : value;
}

export function normalizeNameInput(value: unknown): unknown {
  return typeof value === 'string' ? normalizeName(value) : value;
}

export function normalizeTextInput(value: unknown): unknown {
  return typeof value === 'string' ? normalizeText(value) : value;
}

export function normalizePhoneInput(value: unknown): unknown {
  return typeof value === 'string' ? normalizePhone(value) : value;
}

export function normalizeCountryInput(value: unknown): unknown {
  return typeof value === 'string' ? normalizeCountry(value) : value;
}
