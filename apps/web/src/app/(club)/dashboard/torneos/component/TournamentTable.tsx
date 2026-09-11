"use client";

import React from "react";
import { Tournament } from "../utils/tournamentModel";

interface Props {
  tournaments: Tournament[];
  selectedTournamentId?: number;
  onSelectTournament: (tournament: Tournament) => void;
  onGenerateFixture: (tournamentId: number) => void;
  onOpenRegisterModal: (tournament: Tournament) => void;
}

export default function TournamentsTable({
  tournaments,
  selectedTournamentId,
  onSelectTournament,
  onGenerateFixture,
  onOpenRegisterModal,
}: Props) {
  return (
    <div className="bg-admin-panel-contraste min border border-gray-800/80 rounded-2xl p-5 md:p-6 space-y-4">
      <h3 className="text-base font-bold text-white">Torneos Creados</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-162.5">
          <thead>
            <tr className="border-b border-gray-800 text-[10px] font-black uppercase text-gray-500 tracking-wider">
              <th className="pb-3">Nombre del Torneo</th>
              <th className="pb-3">Categoría</th>
              <th className="pb-3">Formato</th>
              <th className="pb-3">Inscriptos</th>
              <th className="pb-3">Estado</th>
              <th className="pb-3 text-center">Inscribir</th>
              <th className="pb-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-xs font-semibold">
            {tournaments.map((t) => {
              const isSelected = t.id === selectedTournamentId;
              const registeredCount = t.teams?.length || 0;
              const maxCount = t.max_teams || 32;

              return (
                <tr
                  key={t.id}
                  onClick={() => onSelectTournament(t)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-padel-green/5" : "hover:bg-gray-800/30"
                  }`}
                >
                  {/* Nombre */}
                  <td className="py-3.5 font-bold text-white flex items-center gap-2 pl-2">
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-padel-green " />
                    )}
                    {t.name}
                  </td>

                  {/* Categoría */}
                  <td className="py-3.5">
                    <span className="text-[10px] font-black text-padel-green bg-padel-green/10 border border-padel-green/30 px-2.5 py-0.5 rounded-full uppercase">
                      {t.category}
                    </span>
                  </td>

                  {/* Formato */}
                  <td className="py-3.5 text-gray-300">
                    {t.format === "single_elimination"
                      ? "Eliminación Directa"
                      : "Fase de Grupos"}
                  </td>

                  {/* Parejas Inscriptas (ej: 10/32) */}
                  <td className="py-3.5 font-bold text-white">
                    <span className="text-padel-green">{registeredCount}</span>{" "}
                    / {maxCount}
                  </td>

                  {/* Estado */}
                  <td className="py-3.5">
                    {t.status === "in_progress" ? (
                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md uppercase">
                        Iniciado
                      </span>
                    ) : t.status === "completed" ? (
                      <span className="text-[10px] font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-md uppercase">
                        Cerrado
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md uppercase">
                        Borrador
                      </span>
                    )}
                  </td>

                  {/*Inscribir */}
                  <td
                    className="py-3.5 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onOpenRegisterModal(t)}
                      className="bg-transparent hover:bg-padel-green/10 text-padel-green border border-padel-green/40 hover:border-padel-green font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95"
                    >
                      Inscribir
                    </button>
                  </td>

                  {/* Botón Generar Fixture */}
                  <td
                    className="py-3.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onGenerateFixture(t.id)}
                      className="bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95"
                    >
                      Generar Fixture
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
