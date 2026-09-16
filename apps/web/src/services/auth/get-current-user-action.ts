"use server";

import { getSessionToken } from "@/lib/session";
import { getCurrentUser, type CurrentUser } from "./login";

// Server Action: es el único puente permitido entre un Client Component
// (AuthContext) y `apiFetch`, que es `server-only`. `null` sin token o si
// la sesión expiró/es inválida, nunca se propaga el error al cliente.
export async function getCurrentUserAction(): Promise<CurrentUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    return await getCurrentUser(token);
  } catch {
    return null;
  }
}
