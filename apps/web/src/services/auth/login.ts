import { apiFetch } from "@/services/api/client";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

// `POST /auth/login`: sin auth, con rate limit de la API (5 intentos/min por IP).
export function login(credentials: LoginCredentials): Promise<LoginResult> {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export interface CurrentUserPlayer {
  id: string;
  firstName: string;
  lastName: string;
  category: string | null;
  gender: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  player: CurrentUserPlayer | null;
}

// `GET /auth/me`: `player: null` significa que la cuenta no tiene un perfil
// de jugador vinculado (staff de club, por ejemplo).
export function getCurrentUser(token: string): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
