import { Tournament } from "@/app/(club)/dashboard/torneos/utils/tournamentModel";
import { apiFetch } from "../api/client";

//lo defino a partir del DTO que acepta el backend
export interface CreateTournamentPayload {
  name: string;
  // category: string;
  // format: "single_elimination" | "groups";
  // max_teams: number;
  // status: "draft" | "in_progress";
  // starts_at: string | null;
}

export function createTournament(
  token: string,
  payload: CreateTournamentPayload,
): Promise<Tournament> {
  return apiFetch<Tournament>("/tournaments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
