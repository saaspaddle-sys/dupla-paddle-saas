// Tipos de suscripción disponibles
export type suscriptionType = "basic" | "pro";

// Estado actual del club (lo que viene del JSON / Backend)
export interface UserSubscriptionData {
  subscription: suscriptionType;
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
