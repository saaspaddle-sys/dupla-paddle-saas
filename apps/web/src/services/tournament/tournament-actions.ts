"use server";

import { getSessionToken } from "@/lib/session";
import { createTournament } from "@/services/tournament/create-tournament";
import type { CreateTournamentPayload } from "@/services/tournament/create-tournament";
import type { Tournament } from "../../app/(club)/dashboard/torneos/utils/tournamentModel";

export async function createTournamentAction(
  payload: CreateTournamentPayload,
): Promise<Tournament> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("No authenticated session");
  }
  return createTournament(token, payload);
}
