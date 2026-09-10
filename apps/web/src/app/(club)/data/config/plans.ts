import { suscriptionType, PlanConfig } from "../types/suscription";

export const PLAN_CONFIGS: Record<suscriptionType, PlanConfig> = {
  free: {
    name: "Plan Free",
    maxTournaments: 1,
    maxFields: 8,
    features: ["1 llave activa", "Vista pública del torneo"],
  },
  basic: {
    name: "Plan Básico",
    maxTournaments: 3,
    maxFields: 8,
    features: ["Soporte por email", "Hasta 3 llaves activas"],
  },
  pro: {
    name: "Plan Pro",
    maxTournaments: 12,
    maxFields: 12,
    features: ["Soporte 24/7", "Hasta 12 llaves activas", "Reportes avanzados"],
  },
};
