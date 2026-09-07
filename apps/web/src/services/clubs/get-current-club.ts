import "server-only";
import { apiFetch } from "@/services/api/client";
import type { Club } from "./create-club";

// `GET /clubs/me`: requiere sesión, devuelve el club de la cuenta autenticada.
export function getCurrentClub(token: string): Promise<Club> {
  return apiFetch<Club>("/clubs/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
