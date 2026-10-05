import "server-only";
import { apiFetch } from "@/services/api/client";

export type SubscriptionPlan = "free" | "basic" | "pro";
export type SubscriptionStatus =
  "active" | "past_due" | "canceled" | "incomplete";

export interface PendingUpgrade {
  id: string;
  targetPlan: SubscriptionPlan;
  amount: string;
  currency: string;
  status: "creating" | "pending" | "paid" | "review_required";
  checkoutUrl: string | null;
  expiresAt: string;
}

export interface PendingDowngrade {
  targetPlan: SubscriptionPlan;
  effectiveAt: string;
}

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  maxTournaments: number;
  currentPeriodEndsAt: string | null;
  renewsAutomatically: boolean;
  pendingUpgrade: PendingUpgrade | null;
  pendingDowngrade: PendingDowngrade | null;
}

export interface CheckoutResponse {
  plan: SubscriptionPlan;
  reference: string;
  checkoutUrl: string;
  reused: boolean;
}

export interface UpgradeQuote {
  targetPlan: "pro";
  amount: string;
  recurringAmount: string;
  currency: string;
  periodEndsAt: string;
}

export interface UpgradeCheckout {
  targetPlan: "pro";
  amount: string;
  currency: string;
  checkoutUrl: string;
  reference: string;
  periodEndsAt: string;
}

export interface DowngradeQuote {
  targetPlan: "basic";
  amount: string;
  currency: string;
  effectiveAt: string;
}

// GET /subscriptions/me: Consulta el estado actual de la suscripcion del club.
export function getCurrentSubscription(token: string): Promise<Subscription> {
  return apiFetch<Subscription>("/subscriptions/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

// GET /subscriptions/me/upgrade-quote: Cotiza una mejora inmediata de Basic a Pro.
export function getUpgradeQuote(token: string): Promise<UpgradeQuote> {
  return apiFetch<UpgradeQuote>(
    "/subscriptions/me/upgrade-quote?targetPlan=pro",
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
}

// POST /subscriptions/me/upgrade: Inicia el pago de la mejora de Basic a Pro.
export function createUpgrade(
  token: string,
  expectedAmount: string,
): Promise<UpgradeCheckout> {
  return apiFetch<UpgradeCheckout>("/subscriptions/me/upgrade", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetPlan: "pro", expectedAmount }),
  });
}

// GET /subscriptions/me/downgrade-quote: Cotiza una bajada de Pro a Basic.
export function getDowngradeQuote(token: string): Promise<DowngradeQuote> {
  return apiFetch<DowngradeQuote>(
    "/subscriptions/me/downgrade-quote?targetPlan=basic",
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
}

// POST /subscriptions/me/downgrade: Programa la bajada de Pro a Basic.
export function createDowngrade(token: string): Promise<DowngradeQuote> {
  return apiFetch<DowngradeQuote>("/subscriptions/me/downgrade", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetPlan: "basic" }),
  });
}

// POST /subscriptions/me/checkouts: Crea o reutiliza un checkout recurrente en Mercado Pago.
export function createSubscriptionCheckout(
  token: string,
  plan: "basic" | "pro",
): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>("/subscriptions/me/checkouts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  });
}

// POST /subscriptions/me/cancel: Pausa la renovacion automatica al fin del periodo.
export function cancelSubscription(token: string): Promise<void> {
  return apiFetch<void>("/subscriptions/me/cancel", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// POST /subscriptions/me/resume: Reanuda la renovacion antes del vencimiento.
export function resumeSubscription(token: string): Promise<void> {
  return apiFetch<void>("/subscriptions/me/resume", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
