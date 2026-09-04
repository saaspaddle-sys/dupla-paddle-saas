"use client";
import React from "react";
import { UserSubscriptionData } from "../data/types/suscription";
import { PLAN_CONFIGS } from "../data/config/plans";

interface Props {
  data: UserSubscriptionData; //suscripcion/torneos y canchas usadas
}

export default function infoPlanSubscription({ data }: Props) {
  //obtenemos las reglas del plan actual del usuario
  const currentPlan = PLAN_CONFIGS[data.subscription] ?? PLAN_CONFIGS.basic;

  //calculo de uso
  const tournamentlimitReached =
    data.createdTournaments >= currentPlan.maxTournaments;

  const fieldLimitReached = data.usedFields >= currentPlan.maxFields;

  return (
    <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5 md:p-6 space-y-4">
      <h3 className="text-base font-bold text-white mb-4">Estado del Plan</h3>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black tracking-wider uppercase text-gray-400 block mb-1 pb-0.5">
            PLAN ACTUAL
          </span>
          <span className="text-2xl font-black text-padel-green block mb-4">
            {currentPlan.name}
          </span>
          <h3 className="text-base font-bold text-white mt-2 pt-4">
            Resumen de Suscripción
          </h3>
        </div>
      </div>

      {/* Métricas de uso */}
      <div className="space-y-3 pt-2 pb-3">
        {/* Torneos */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-gray-400">Torneos Creados al Mes</span>
            <span className="text-white">
              {data.createdTournaments} /{" "}
              {currentPlan.maxTournaments === Infinity
                ? "∞"
                : currentPlan.maxTournaments}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                tournamentlimitReached ? "bg-rose-500" : "bg-padel-green"
              }`}
              style={{
                width: `${Math.min(
                  (data.createdTournaments /
                    (currentPlan.maxTournaments || 1)) *
                    100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Canchas */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-gray-400">Canchas En Uso</span>
            <span className="text-white">
              {data.usedFields} /{" "}
              {currentPlan.maxFields === Infinity ? "∞" : currentPlan.maxFields}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                fieldLimitReached ? "bg-rose-500" : "bg-padel-green"
              }`}
              style={{
                width: `${Math.min(
                  (data.usedFields / (currentPlan.maxFields || 1)) * 100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Botón Upgrade si no es Pro */}
      {data.subscription !== "pro" && (
        <button className="w-full bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-bold text-xs py-2 rounded-lg transition-all cursor-pointer">
          Mejorar a Plan Pro
        </button>
      )}
    </div>
  );
}
