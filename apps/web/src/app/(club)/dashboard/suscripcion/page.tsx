import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { getCurrentSubscription } from "@/services/subscriptions/subscriptions";
import { SubscriptionManager } from "./_components/SubscriptionManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  let subscription;
  try {
    subscription = await getCurrentSubscription(token);
  } catch {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-[#141619] border border-rose-500/30 rounded-3xl p-6 text-rose-400 space-y-2 shadow-xl">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              Error al cargar la suscripción
            </h2>
          </div>
          <p className="text-xs text-gray-400 pl-8">
            No pudimos conectar con el servidor para consultar tu estado actual
            de facturación. Intentá recargar la página en unos minutos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-admin-panel min-h-screen">
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <h1 className="text-xl font-bold text-white">
          Suscripción y Facturación
        </h1>
      </div>
      <p className="text-base text-gray-400 mt-1">
        Elegí el plan que mejor se adapte a las necesidades de tu club y
        gestioná tu cupo de torneos y canchas.
      </p>

      {/* Componente cliente encargado de renderizar planes, estado y pasarela */}
      <SubscriptionManager initialSubscription={subscription} />
    </div>
  );
}
