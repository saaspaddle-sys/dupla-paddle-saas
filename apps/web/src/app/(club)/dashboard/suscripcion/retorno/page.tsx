import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { getCurrentSubscription } from "@/services/subscriptions/subscriptions";

export const dynamic = "force-dynamic";

export default async function ReturnPage() {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  let subscription = null;
  try {
    subscription = await getCurrentSubscription(token);
  } catch {
    // Si falla la consulta, permitimos reintentar desde la interfaz
  }

  const isPaid = subscription && subscription.plan !== "free";

  return (
    <div className="max-w-xl mx-auto py-12 px-4 text-center">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          {isPaid ? "✓" : "⏳"}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isPaid
            ? "¡Suscripción actualizada con éxito!"
            : "Procesando pago con Mercado Pago"}
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          {subscription && isPaid
            ? `Tu club ya tiene activo el plan ${subscription.plan.toUpperCase()} con cupo para ${subscription.maxTournaments} torneos.`
            : "Mercado Pago puede tardar unos momentos en confirmar la acreditación y notificar a nuestro servidor. La activación se realiza de forma automática."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/suscripcion"
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            Ver estado de mi suscripción
          </Link>
          <Link
            href="/dashboard/torneos"
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Ir a Torneos
          </Link>
        </div>
      </div>
    </div>
  );
}
