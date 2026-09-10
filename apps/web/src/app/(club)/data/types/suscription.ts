// Tipos de suscripción disponibles
export type suscriptionType = "free" | "basic" | "pro";

// Estado actual del club (lo que viene del JSON / Backend)
export interface UserSubscriptionData {
  subscription: suscriptionType;
  // Cupo real de la suscripción (`GET /clubs/me`): no siempre coincide con
  // el default del plan, puede ser una excepción manual (docs/decisions.md,
  // 2026-08-25).
  maxTournaments: number;
  createdTournaments: number;
  usedFields: number;
}

// Configuración y límites de cada plan
export interface PlanConfig {
  name: string;
  maxTournaments: number; // Por ejemplo, number o Infinity
  maxFields: number;
  features: string[];
}
