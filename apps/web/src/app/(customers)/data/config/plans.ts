import { suscriptionType, PlanConfig } from "../types/suscription";

export const PLAN_CONFIGS: Record<suscriptionType, PlanConfig> = {
  basic: {
    name: "Plan Básico",
    maxTournaments: 5,
    maxFields: 8,
    features: ["Soporte por email", "Hasta 2 torneos simultaneous"],
  },
  pro: {
    name: "Plan Pro",
    maxTournaments: 12,
    maxFields: 12,
    features: ["Soporte 24/7", "Hasta 10 torneos", "Reportes avanzados"],
  },
};
