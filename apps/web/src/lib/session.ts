import "server-only";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "session";

// Guarda el access token de la API como cookie httpOnly del origen de web:
// el JS del browser nunca llega a verlo.
export async function createSession(
  accessToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    // `true` fijo rompe en http://localhost, donde no hay TLS.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresInSeconds,
  });
}

// `null` si no hay sesión o si expiró (la cookie ya no está en el store).
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

// Elimina la cookie de sesión para invalidar la sesión en el navegador.
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
