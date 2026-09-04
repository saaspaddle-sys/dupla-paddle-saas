"use client";

import React, { useState } from "react";
import ActividadJugadoresDos from "../_components/actividadJuagadoresDos";
import UltimasInscripciones from "../_components/ultimasIncripciones";
import inscripcionesData from "../data/inscripcionesData.json";
import NextTournament from "../_components/nextTournament";
import planSubscriptionClub from "../data/planSubscriptionClub.json";
import InfoPlanSubscription from "../_components/infoPlanSuscription";
import type { UserSubscriptionData } from "../data/types/suscription";
import CreateTournamentModal from "../dashboard/torneos/component/createTournamentModal";

const subscriptionData: UserSubscriptionData = {
  ...planSubscriptionClub,
  subscription:
    planSubscriptionClub.subscription as UserSubscriptionData["subscription"],
};

export default function DashboardOverview() {
  const [isCreateTournamentModalOpen, setIsCreateTournamentModalOpen] =
    useState(false);

  return (
    <div className="w-full min-h-screen bg-admin-panel text-white p-6 md:p-8 space-y-6">
      {/* Top Navigation */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-800/80">
        <nav className="flex items-center gap-6 text-xs font-bold text-gray-400">
          <button className="text-padel-green border-b-2 border-padel-green pb-1 font-extrabold cursor-pointer">
            Métricas
          </button>
          <button className="hover:text-white transition-colors cursor-pointer">
            Llaves
          </button>
          <button className="hover:text-white transition-colors cursor-pointer">
            Disponibilidad
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div className="relative">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              className="bg-admin-panel-contraste text-xs text-white rounded-xl pl-9 pr-4 py-2 border border-gray-800 focus:outline-none focus:border-padel-green w-48 md:w-64"
            />
          </div>
        </div>
      </header>

      {/* Header Titulo + Botón */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Panel de Control - Mi Club
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            Martes, 24 de Octubre 2023 modificar para que actualize sola
          </p>
        </div>
        <button
          onClick={() => setIsCreateTournamentModalOpen(true)}
          className="flex items-center gap-2 bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          CREAR TORNEO
        </button>
      </div>

      <CreateTournamentModal
        isOpen={isCreateTournamentModalOpen}
        onClose={() => setIsCreateTournamentModalOpen(false)}
      />

      {/* KPIs Grid Top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5">
          <span className="text-[10px] font-black tracking-wider uppercase text-gray-400 block mb-2">
            Participantes
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-white">32</span>
            <span className="text-[10px] font-bold text-padel-green bg-padel-green/10 px-2 py-0.5 rounded-md">
              ↗+12%
            </span>
          </div>
        </div>

        <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5">
          <span className="text-[10px] font-black tracking-wider uppercase text-gray-400 block mb-2">
            Torneos en curso
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">3</span>
            <span className="text-xs font-semibold text-gray-400">
              eventos activos
            </span>
          </div>
        </div>

        <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5">
          <span className="text-[10px] font-black tracking-wider uppercase text-gray-400 block mb-2">
            Ingresos Mensuales
          </span>
          <div className="text-3xl font-black text-padel-green">$450k</div>
        </div>

        <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5">
          <span className="text-[10px] font-black tracking-wider uppercase text-gray-400 block mb-1">
            Canchas dedicadas
          </span>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-white">03/05</span>
            <span className="text-xs font-semibold text-gray-400">Canchas</span>
          </div>
          <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-padel-green h-full rounded-full"
              style={{ width: "85%" }}
            />
          </div>
        </div>
      </div>

      {/* Main Layout Grid: Columna Principal + Columna Sidebar Derecha */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* COLUMNA IZQUIERDA (Ocupa 2 columnas en pantallas anchas) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Actividad de Jugadores */}
          <ActividadJugadoresDos />

          {/* Últimas Inscripciones */}
          <UltimasInscripciones
            inscripciones={
              inscripcionesData as {
                id: string;
                jugador: string;
                torneo: string;
                categoria: string;
                estado: "Pagado" | "Pendiente";
              }[]
            }
          />
        </div>

        {/* COLUMNA DERECHA (Widgets alineados verticalmente) */}
        <div className="space-y-6">
          {/* Próximos Torneos */}
          <NextTournament />

          {/* Estado del Plan */}
          <InfoPlanSubscription data={subscriptionData} />
        </div>
      </div>
    </div>
  );
}
