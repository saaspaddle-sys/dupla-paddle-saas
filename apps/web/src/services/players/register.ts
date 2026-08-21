import { apiFetch } from "@/services/api/client";

export type Gender = "male" | "female";
export type DominantHand = "right" | "left";

export interface RegisterPlayerPayload {
  email: string;
  password: string;
  dni: string;
  firstName: string;
  lastName: string;
  gender?: Gender;
  birthDate?: string;
  category?: string;
  dominantHand?: DominantHand;
  country?: string;
  province?: string;
  phone?: string;
  emergencyPhone?: string;
}

export interface RegisterPlayerResponse {
  outcome: "created" | "claimed";
  user: { id: string; email: string };
  player: {
    id: string;
    firstName: string;
    lastName: string;
    category: string | null;
    gender: Gender | null;
    createdAt: string;
  };
}

export function registerPlayer(
  payload: RegisterPlayerPayload,
): Promise<RegisterPlayerResponse> {
  return apiFetch<RegisterPlayerResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
