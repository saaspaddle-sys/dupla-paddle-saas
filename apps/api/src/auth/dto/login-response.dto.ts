/**
 * Deliberadamente no lleva identidad (`user`, `player`): eso es lo que
 * expone `GET /auth/me`. Esta respuesta es solo lo que el BFF de `apps/web`
 * necesita para guardar la cookie de sesión — el token y su vencimiento.
 */
export class LoginResponseDto {
  accessToken!: string;
  tokenType!: 'Bearer';
  /** Segundos hasta que el token vence — el BFF lo usa como `maxAge` de la cookie. */
  expiresIn!: number;
}
