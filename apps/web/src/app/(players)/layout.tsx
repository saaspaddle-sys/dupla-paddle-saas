//Sidebar/Navbar exclusivo para jugadores
//compartido para las secciones del jugador

import type { ReactNode } from "react";
import PlayerSidebar from "./_components/playerSidebar";

export default function PlayersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen sticky top-0 w-full overflow-hidden bg-[#f7f9e8]/50">
      {/* Sidebar Fijo a la izquierda */}
      <PlayerSidebar />

      {/* Contenido dinámico (page.tsx) */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
