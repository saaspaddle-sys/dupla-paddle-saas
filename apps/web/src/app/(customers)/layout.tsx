//Sidebar robusto de administración para el Club

import type { ReactNode } from "react";
import CustomerSidebar from "./_components/customerSidebar";

export default function CustomersLayout({ children }: { children: ReactNode }) {
  return (
      <div className="flex min-h-screen bg-[#f7f9e8]/50">
        {/* Sidebar Fijo a la izquierda */}
        <CustomerSidebar />
  
        {/* Contenido dinámico (page.tsx) */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl">{children}</main>
      </div>
    );;
}
