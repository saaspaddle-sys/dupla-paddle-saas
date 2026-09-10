//Sidebar robusto de administración para el Club

import type { ReactNode } from "react";
import CustomerSidebar from "./_components/customerSidebar";

export default function CustomersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-admin-panel overflow-hidden">
      <CustomerSidebar />

      <main className="flex-1 w-full bg-admin-panel overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
