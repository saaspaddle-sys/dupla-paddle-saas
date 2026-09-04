/*Este componente toma la lista de partidos (matches) y renderiza en columnas según la ronda (Cuartos de final, Semifinales, Final). Además, aprovechará los campos de la base de datos: next_match_id, next_slot y la relación con match_sets para cargar resultados. */
"use client";

import React, { useState } from "react";
import { Match } from "../utils/tournamentModel";
import {
  updateMatchScoreAndAdvance,
  SetScore,
} from "../utils/fixtureGenerator";

interface Props {
  matches: Match[];
  onMatchesUpdate?: (updatedMatches: Match[]) => void;
}

export default function TournamentFixtureSection({
  matches: initialMatches,
  onMatchesUpdate,
}: Props) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [scoresState, setScoresState] = useState<Record<number, SetScore>>({});

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-[#141619] border border-gray-800 rounded-2xl p-8 text-center space-y-2">
        <p className="text-gray-400 text-sm">
          Aún no se ha generado el fixture para este torneo.
        </p>
      </div>
    );
  }

  // Agrupar partidos por Ronda
  const roundsMap = matches.reduce(
    (acc, match) => {
      const roundName = match.round_name || "Ronda";
      if (!acc[roundName]) acc[roundName] = [];
      acc[roundName].push(match);
      return acc;
    },
    {} as Record<string, Match[]>,
  );

  const roundNames = Object.keys(roundsMap);

  const handleScoreChange = (
    matchId: number,
    field: keyof SetScore,
    value: string,
  ) => {
    const numValue = value === "" ? "" : Math.max(0, parseInt(value, 10) || 0);

    const currentScore = scoresState[matchId] || {
      set1_p1: "",
      set1_p2: "",
      set2_p1: "",
      set2_p2: "",
      set3_p1: "",
      set3_p2: "",
    };

    const newScore = { ...currentScore, [field]: numValue };

    setScoresState((prev) => ({ ...prev, [matchId]: newScore }));

    // Aplicar cambio y calcular si avanza de ronda
    const updated = updateMatchScoreAndAdvance(matches, matchId, newScore);
    setMatches(updated);
    if (onMatchesUpdate) onMatchesUpdate(updated);
  };

  return (
    <div className="bg-[#141619] border border-gray-800 rounded-2xl p-5 md:p-6 space-y-6 overflow-hidden">
      <div className="flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white">
            Cuadro de Eliminación Directa
          </h3>
          <p className="text-xs text-gray-400">
            Ingresá los puntos de los 3 sets para avanzar automáticamente al
            ganador
          </p>
        </div>
      </div>

      {/* ÁRBOL DE TORNEO */}
      <div className="overflow-x-auto pb-6 custom-scrollbar">
        <div className="flex items-stretch gap-8 min-w-max px-2">
          {roundNames.map((roundName) => {
            const roundMatches = roundsMap[roundName];

            return (
              <div key={roundName} className="flex flex-col w-72 min-w-[288px]">
                {/* Título de Ronda */}
                <div className="text-center mb-6">
                  <span className="text-xs font-black uppercase text-padel-green bg-[#1a1d21] border border-gray-800 px-3 py-1.5 rounded-lg shadow-sm">
                    {roundName}
                  </span>
                </div>

                {/* Lista de Partidos */}
                <div className="flex flex-col justify-around flex-1 gap-6">
                  {roundMatches.map((match) => {
                    const score = scoresState[match.id] || {
                      set1_p1: "",
                      set1_p2: "",
                      set2_p1: "",
                      set2_p2: "",
                      set3_p1: "",
                      set3_p2: "",
                    };

                    const isReady = Boolean(match.team1 && match.team2);

                    return (
                      <div
                        key={match.id}
                        className={`bg-[#1e2024] border rounded-xl p-3 shadow-lg space-y-2 transition-all ${
                          match.status === "completed"
                            ? "border-padel-green/50 bg-padel-green/5"
                            : "border-gray-700/80"
                        }`}
                      >
                        {/* Header del Partido */}
                        <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase">
                          <span>Partido #{match.id}</span>
                          <span
                            className={
                              match.status === "completed"
                                ? "text-padel-green"
                                : "text-amber-400"
                            }
                          >
                            {match.status === "completed"
                              ? "Finalizado"
                              : isReady
                                ? "En Juego"
                                : "Esperando RivaL"}
                          </span>
                        </div>

                        {/* PAREJA 1 */}
                        <div className="flex items-center justify-between bg-[#141619] p-2 rounded-lg border border-gray-800 gap-2">
                          <span className="text-xs font-bold text-white truncate flex-1">
                            {match.team1
                              ? `${match.team1?.player1?.last_name} / ${match.team1?.player2?.last_name}`
                              : "Por Clasificar"}
                          </span>

                          {/* Inputs de 3 Sets Pareja 1 */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              disabled={!isReady}
                              placeholder="S1"
                              value={score.set1_p1}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "set1_p1",
                                  e.target.value,
                                )
                              }
                              className="w-7 h-7 text-center bg-[#1e2024] border border-gray-700 text-xs text-white rounded font-bold focus:outline-none focus:border-padel-green disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <input
                              type="number"
                              disabled={!isReady}
                              placeholder="S2"
                              value={score.set2_p1}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "set2_p1",
                                  e.target.value,
                                )
                              }
                              className="w-7 h-7 text-center bg-[#1e2024] border border-gray-700 text-xs text-white rounded font-bold focus:outline-none focus:border-padel-green disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <input
                              type="number"
                              disabled={!isReady}
                              placeholder="S3"
                              value={score.set3_p1}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "set3_p1",
                                  e.target.value,
                                )
                              }
                              className="w-7 h-7 text-center bg-[#1e2024] border border-gray-700 text-xs text-white rounded font-bold focus:outline-none focus:border-padel-green disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>

                        {/* PAREJA 2 */}
                        <div className="flex items-center justify-between bg-[#141619] p-2 rounded-lg border border-gray-800 gap-2">
                          <span className="text-xs font-bold text-white truncate flex-1">
                            {match.team2
                              ? `${match.team2?.player1?.last_name} / ${match.team2?.player2?.last_name}`
                              : "Por Clasificar"}
                          </span>

                          {/* Inputs de 3 Sets Pareja 2 */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              disabled={!isReady}
                              placeholder="S1"
                              value={score.set1_p2}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "set1_p2",
                                  e.target.value,
                                )
                              }
                              className="w-7 h-7 text-center bg-[#1e2024] border border-gray-700 text-xs text-white rounded font-bold focus:outline-none focus:border-padel-green disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <input
                              type="number"
                              disabled={!isReady}
                              placeholder="S2"
                              value={score.set2_p2}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "set2_p2",
                                  e.target.value,
                                )
                              }
                              className="w-7 h-7 text-center bg-[#1e2024] border border-gray-700 text-xs text-white rounded font-bold focus:outline-none focus:border-padel-green disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <input
                              type="number"
                              disabled={!isReady}
                              placeholder="S3"
                              value={score.set3_p2}
                              onChange={(e) =>
                                handleScoreChange(
                                  match.id,
                                  "set3_p2",
                                  e.target.value,
                                )
                              }
                              className="w-7 h-7 text-center bg-[#1e2024] border border-gray-700 text-xs text-white rounded font-bold focus:outline-none focus:border-padel-green disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
