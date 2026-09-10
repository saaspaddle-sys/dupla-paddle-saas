import { redirect } from "next/navigation";
import DashboardOverviewClient from "../_components/dashboardOverviewClient";
import type { UserSubscriptionData } from "../data/types/suscription";
import { getSessionToken } from "@/lib/session";
import { getCurrentClub } from "@/services/clubs/get-current-club";
import { ApiError } from "@/services/api/client";

async function loadSubscriptionData(): Promise<UserSubscriptionData> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/");
  }

  try {
    const club = await getCurrentClub(token);
    return {
      subscription: club.subscription
        .plan as UserSubscriptionData["subscription"],
      maxTournaments: club.subscription.maxTournaments,
      // Pendiente: no hay endpoint de torneos/canchas conectado todavía.
      createdTournaments: 0,
      usedFields: 0,
    };
  } catch (error) {
    if (error instanceof ApiError && error.body.code === "club_required") {
      redirect("/crearClub-screen");
    }
    throw error;
  }
}

export default async function DashboardOverview() {
  const subscriptionData = await loadSubscriptionData();
  return <DashboardOverviewClient subscriptionData={subscriptionData} />;
}
