/**
 * Respuesta del caso sano, y solo de ese caso: si la base no responde el
 * endpoint tira 503 y la respuesta sale por `AppExceptionFilter` con el
 * shape de error de siempre (`{ statusCode, code, message, details }`,
 * con `code: 'database_unavailable'`). Es a propósito: un segundo formato
 * de "algo anda mal", exclusivo de este endpoint, obligaría a cada
 * consumidor a parsear dos cosas distintas según el status.
 */
export class HealthResponseDto {
  /** Siempre `ok` — un chequeo que falla no devuelve este DTO, devuelve 503. */
  status!: 'ok';

  /** Resultado del `SELECT 1` contra Postgres. */
  database!: 'up';
}
