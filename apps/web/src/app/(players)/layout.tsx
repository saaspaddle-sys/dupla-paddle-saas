//Sidebar/Navbar exclusivo para jugadores
//compartido para las secciones del jugador

import type { ReactNode } from "react";
import PlayerSidebar from "./_components/playerSidebar";
import { getSessionToken } from "@/lib/session";
import { getCurrentClub } from "@/services/clubs/get-current-club";
import { ApiError } from "@/services/api/client";

// `GET /clubs/me`: `club_required` significa que la cuenta no tiene club
// todavía, no es un error a propagar.
async function loadHasClub(): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) return false;

  try {
    await getCurrentClub(token);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.body.code === "club_required") {
      return false;
    }
    throw error;
  }
}

export default async function PlayersLayout({
  children,
}: {
  children: ReactNode;
}) {
  const hasClub = await loadHasClub();

  return (
    <div className="flex h-screen sticky top-0 w-full overflow-hidden bg-[#f7f9e8]/50">
      {/* Sidebar Fijo a la izquierda */}
      <PlayerSidebar hasClub={hasClub} />

      {/* Contenido dinámico (page.tsx) */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
