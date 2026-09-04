"use client";

import React, { useState } from "react";
import { Team, Player } from "../utils/tournamentModel";

interface Props {
  tournamentId: number;
  clubId: number;
  teams: Team[];
  isRegisterModalOpen: boolean;
  onOpenRegisterModal: () => void;
  onCloseRegisterModal: () => void;
  onAddTeam?: (newTeam: Partial<Team>) => void;
}

export default function TournamentTeamsSection({
  tournamentId,
  clubId,
  teams: datosIniciales,
  isRegisterModalOpen,
  onOpenRegisterModal,
  onCloseRegisterModal,
  onAddTeam,
}: Props) {
  const [listaParejas, setListaParejas] = useState<Team[]>(datosIniciales);

  // Estados simples para el formulario de inscripción rápida
  const [p1Nombre, setP1Nombre] = useState("");
  const [p1Apellido, setP1Apellido] = useState("");
  const [p2Nombre, setP2Nombre] = useState("");
  const [p2Apellido, setP2Apellido] = useState("");
  const [seed, setSeed] = useState<number | "">("");

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();

    // Simulamos la creación alineada con la DB (esto se eliminara cuando se haga un FETCH)
    const nuevaPareja: Team = {
      id: Date.now(), // ID temporal
      club_id: clubId,
      tournament_id: tournamentId,
      player1_id: Math.floor(Math.random() * 1000),
      player2_id: Math.floor(Math.random() * 1000),
      seed: seed ? Number(seed) : undefined,
      player1: {
        id: Math.floor(Math.random() * 1000),
        first_name: p1Nombre,
        last_name: p1Apellido,
        category: "6ta",
      },
      player2: {
        id: Math.floor(Math.random() * 1000),
        first_name: p2Nombre,
        last_name: p2Apellido,
        category: "6ta",
      },
    };

    setListaParejas((prev) => [...prev, nuevaPareja]);
    if (onAddTeam) onAddTeam(nuevaPareja);

    // Resetear form y cerrar modal
    setP1Nombre("");
    setP1Apellido("");
    setP2Nombre("");
    setP2Apellido("");
    setSeed("");
    onCloseRegisterModal();
  };

  return (
    <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5 md:p-6 space-y-5">
      {/* HEADER DE LA SECCIÓN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white">
            Jugadores e Inscriptos
          </h3>
          <p className="text-xs text-gray-400">
            Parejas confirmadas:{" "}
            <span className="text-white font-bold">{listaParejas.length}</span>
          </p>
        </div>

        {/* 
        <button
        onClick={onOpenRegisterModal}
        className="bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
        >
          Descargar PDF
        </button>
      */}
      </div>

      {/* TABLA DE PAREJAS */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-125">
          <thead>
            <tr className="border-b border-gray-800 text-[10px] font-black uppercase text-gray-500 tracking-wider">
              <th className="pb-3"># Seed</th>
              <th className="pb-3">Jugador 1</th>
              <th className="pb-3">Jugador 2</th>
              <th className="pb-3 text-right pr-12">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-xs font-semibold">
            {listaParejas.length > 0 ? (
              listaParejas.map((team, index) => (
                <tr
                  key={team.id}
                  className="hover:bg-gray-800/20 transition-colors"
                >
                  <td className="py-3">
                    {team.seed ? (
                      <span className="bg-padel-green/10 text-padel-green border border-padel-green/30 text-[10px] font-black px-2 py-0.5 rounded-md">
                        N° {team.seed}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-[11px]">-</span>
                    )}
                  </td>
                  <td className="py-3 font-bold text-white capitalize">
                    {team.player1
                      ? `${team.player1.first_name} ${team.player1.last_name}`
                      : `ID: ${team.player1_id}`}
                  </td>
                  <td className="py-3 font-bold text-white capitalize">
                    {team.player2
                      ? `${team.player2.first_name} ${team.player2.last_name}`
                      : `ID: ${team.player2_id}`}
                  </td>
                  <td className="py-3 text-right space-x-3">
                    <button className="text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors cursor-pointer">
                      Sancionar
                    </button>
                    <button className="text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors cursor-pointer">
                      Dar de baja
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 text-center text-gray-500 text-xs"
                >
                  Aún no hay parejas anotadas en este torneo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL PARA ANOTAR PAREJA */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#141619] border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h4 className="text-sm font-bold text-white">
                Inscribir Nueva Pareja
              </h4>
              <button
                onClick={onCloseRegisterModal}
                className="text-gray-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              {/* Jugador 1 */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-padel-green uppercase">
                  Jugador 1
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nombre"
                    value={p1Nombre}
                    onChange={(e) => setP1Nombre(e.target.value)}
                    className="bg-[#1e2024] border border-gray-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-padel-green"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Apellido"
                    value={p1Apellido}
                    onChange={(e) => setP1Apellido(e.target.value)}
                    className="bg-[#1e2024] border border-gray-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-padel-green"
                  />
                </div>
              </div>

              {/* Jugador 2 */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-padel-green uppercase">
                  Jugador 2
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nombre"
                    value={p2Nombre}
                    onChange={(e) => setP2Nombre(e.target.value)}
                    className="bg-[#1e2024] border border-gray-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-padel-green"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Apellido"
                    value={p2Apellido}
                    onChange={(e) => setP2Apellido(e.target.value)}
                    className="bg-[#1e2024] border border-gray-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-padel-green"
                  />
                </div>
              </div>

              {/* Seed (Sembrado) */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Sembrado / Cabeza de Serie (Opcional)
                </label>
                <input
                  type="number"
                  placeholder="Ej: 1 (para pareja n°1 del torneo)"
                  value={seed}
                  onChange={(e) =>
                    setSeed(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full bg-[#1e2024] border border-gray-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-padel-green [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={onCloseRegisterModal}
                  className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-bold text-xs px-4 py-1.5 rounded-lg"
                >
                  Guardar Inscripción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
