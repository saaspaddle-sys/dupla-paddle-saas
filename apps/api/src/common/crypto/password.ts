import bcrypt from 'bcryptjs';

// bcryptjs es puro JS (sin build nativo), a costa de ser más lento que
// bcrypt/argon2 nativos — elegido para no depender de builds nativos
// distintos entre Windows (dev local) y Linux (CI/prod).
// Movido acá desde `players/players.service.ts` (slice de login): el login
// necesita el mismo costo para el hash dummy anti-enumeración de emails
// (ver `auth/auth.service.ts`), así que dejó de ser un detalle solo de
// `players/`.
export const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
