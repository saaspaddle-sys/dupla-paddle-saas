"use server";

import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import {
  createSubscriptionCheckout,
  cancelSubscription,
  resumeSubscription,
  getUpgradeQuote,
  createUpgrade,
  getDowngradeQuote,
  createDowngrade,
} from "./subscriptions";
import { ApiError } from "@/services/api/client";

export type SubscriptionActionResult = {
  error?: string;
};

export type UpgradeQuoteResult =
  | { error: string }
  | {
      amount: string;
      recurringAmount: string;
      currency: string;
      periodEndsAt: string;
    };

export type UpgradeCheckoutResult =
  | { error: string }
  | {
      checkoutUrl: string;
      reference: string;
      amount: string;
      currency: string;
    };

export type DowngradeQuoteResult =
  | { error: string }
  | {
      amount: string;
      currency: string;
      effectiveAt: string;
    };

export async function startCheckoutAction(
  plan: "basic" | "pro",
): Promise<SubscriptionActionResult> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  let checkoutUrl: string;
  try {
    const res = await createSubscriptionCheckout(token, plan);
    checkoutUrl = res.checkoutUrl;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.body.code === "active_subscription_must_be_cancelled") {
        return {
          error:
            "Ya contás con una suscripcion activa. Debes esperar al termino del periodo o gestionar la mejora.",
        };
      }
      if (err.body.code === "checkout_pending_for_another_plan") {
        return {
          error:
            "Tenes un intento de pago pendiente para otro plan. Por favor completalo o aguarda unos minutos.",
        };
      }
      return { error: err.body.message || "Error al generar el checkout." };
    }
    return {
      error: "Ocurrio un error inesperado al contactar con Mercado Pago.",
    };
  }

  redirect(checkoutUrl);
}

export async function cancelSubscriptionAction(): Promise<SubscriptionActionResult> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  try {
    await cancelSubscription(token);
    return {};
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.body.message || "No se pudo pausar la renovacion." };
    }
    return { error: "Ocurrio un error al procesar la cancelacion." };
  }
}

export async function resumeSubscriptionAction(): Promise<SubscriptionActionResult> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  try {
    await resumeSubscription(token);
    return {};
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.body.message || "No se pudo reanudar la suscripcion.",
      };
    }
    return { error: "Ocurrio un error al reactivar la renovacion." };
  }
}

export async function getUpgradeQuoteAction(): Promise<UpgradeQuoteResult> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  try {
    const quote = await getUpgradeQuote(token);
    return {
      amount: quote.amount,
      recurringAmount: quote.recurringAmount,
      currency: quote.currency,
      periodEndsAt: quote.periodEndsAt,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error:
          err.body.message || "No se pudo obtener la cotizacion de mejora.",
      };
    }
    return { error: "Ocurrio un error al contactar con el servidor." };
  }
}

export async function createUpgradeAction(
  expectedAmount: string,
): Promise<UpgradeCheckoutResult> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  try {
    const upgrade = await createUpgrade(token, expectedAmount);
    return {
      checkoutUrl: upgrade.checkoutUrl,
      reference: upgrade.reference,
      amount: upgrade.amount,
      currency: upgrade.currency,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.body.code === "upgrade_quote_changed") {
        return {
          error:
            "El monto cambio entre la cotizacion y el pago. Por favor consulta nuevamente.",
        };
      }
      return {
        error: err.body.message || "No se pudo crear el pago de mejora.",
      };
    }
    return { error: "Ocurrio un error al procesar la mejora." };
  }
}

export async function getDowngradeQuoteAction(): Promise<DowngradeQuoteResult> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  try {
    const quote = await getDowngradeQuote(token);
    return {
      amount: quote.amount,
      currency: quote.currency,
      effectiveAt: quote.effectiveAt,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error:
          err.body.message || "No se pudo obtener la cotizacion de cambio.",
      };
    }
    return { error: "Ocurrio un error al contactar con el servidor." };
  }
}

export async function createDowngradeAction(): Promise<SubscriptionActionResult> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/auth/login");
  }

  try {
    await createDowngrade(token);
    return {};
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.body.message || "No se pudo programar la bajada de plan.",
      };
    }
    return { error: "Ocurrio un error al procesar la bajada de plan." };
  }
}
