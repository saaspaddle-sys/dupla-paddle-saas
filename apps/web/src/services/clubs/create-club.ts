import "server-only";
import { apiFetch } from "@/services/api/client";

export interface CreateClubInput {
  name: string;
}

export interface ClubSubscription {
  plan: string;
  status: string;
  maxTournaments: number;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  subscription: ClubSubscription;
}

// `POST /clubs`: requiere sesión, y el slug/ownerId los deriva el server —
// nunca se mandan desde acá (docs/decisions.md, 2026-08-25).
export function createClub(input: CreateClubInput, token: string): Promise<Club> {
  return apiFetch<Club>("/clubs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}
