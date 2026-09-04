"use client";

import React, { useState } from "react";
import TournamentTeamsSection from "./component/tournamentTeamsSelection";
import { Tournament, Team, Match } from "./utils/tournamentModel";
import CreateTournamentModal from "./component/createTournamentModal";
import TournamentFixtureSection from "./component/TournamentFixtureSection";
import TournamentsTable from "./component/TournamentTable";
import { generateSingleEliminationMatches } from "./utils/fixtureGenerator";
//importo data para usarla de mock
import mockTournaments from "./data/mockTournaments";
import mockTeams from "./data/mockteams";
import mockMatches from "./data/mockmatches";

export default function TorneosPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>(mockTournaments);
  const [selectedTournament, setSelectedTournament] = useState<Tournament>(
    mockTournaments[0],
  );
  const [activeTab, setActiveTab] = useState<"teams" | "fixture">("teams");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tournamentToRegister, setTournamentToRegister] =
    useState<Tournament | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  //abre el modal de inscripcion de parejas
  const handleOpenRegisterModal = (tournament: Tournament) => {
    // Guardamos el torneo seleccionado para saber a cuál inscribir
    setTournamentToRegister(tournament);
    setSelectedTournament(tournament);
    setActiveTab("teams");
    setIsRegisterModalOpen(true);
  };

  const handleGenerateFixture = (tournamentId: number) => {
    //console.log("Generando fixture para torneo ID:", tournamentId);
    // 1. Buscar el torneo objetivo
    const targetTournament = tournaments.find((t) => t.id === tournamentId);
    if (!targetTournament) return;

    const teams = targetTournament.teams || [];

    // 2. Validar que haya al menos 2 parejas inscriptas
    if (teams.length < 2) {
      alert(
        "Se necesitan al menos 2 parejas inscriptas para generar el fixture.",
      );
      return;
    }

    // 3. Generar los cruces de partidos
    const generatedMatches = generateSingleEliminationMatches(
      tournamentId,
      teams,
    );

    // 4. Actualizar el estado del torneo (guardar partidos y cambiar estado a 'in_progress')
    const updatedTournaments = tournaments.map((t) => {
      if (t.id === tournamentId) {
        return {
          ...t,
          status: "in_progress" as const,
          matches: generatedMatches,
        };
      }
      return t;
    });
    setTournaments(updatedTournaments);

    // 5. Seleccionar este torneo y cambiar la solapa activa a "Fixture / Llave"
    const updatedTarget = updatedTournaments.find(
      (t) => t.id === tournamentId,
    )!;
    setSelectedTournament(updatedTarget);
    setActiveTab("fixture"); //activa automaticamente la pestaña inferior
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-admin-panel min-h-screen">
      {/* Header General */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <h1 className="text-xl font-bold text-white">Gestión de Torneos</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
        >
          + Nuevo Torneo
        </button>
      </div>

      {/* 1. TABLA DE TORNEOS CREADOS */}
      <TournamentsTable
        tournaments={tournaments}
        selectedTournamentId={selectedTournament.id}
        onSelectTournament={(t) => setSelectedTournament(t)}
        onGenerateFixture={handleGenerateFixture}
        onOpenRegisterModal={handleOpenRegisterModal}
      />

      {/* 2. PESTAÑAS DE DETALLE DEL TORNEO SELECCIONADO */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <h2 className="text-lg font-bold text-white">
            {selectedTournament.name}
          </h2>

          <div className="flex gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("teams")}
              className={`pb-2 transition-colors cursor-pointer ${
                activeTab === "teams"
                  ? "text-padel-green border-b-2 border-padel-green font-bold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Parejas Inscriptas ({selectedTournament.teams?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("fixture")}
              className={`pb-2 transition-colors cursor-pointer ${
                activeTab === "fixture"
                  ? "text-padel-green border-b-2 border-padel-green font-bold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Fixture / Llave
            </button>
          </div>
        </div>

        {/* CONTENIDO SEGÚN LA SOLAPA */}
        {activeTab === "teams" && (
          <TournamentTeamsSection
            key={selectedTournament.id}
            tournamentId={selectedTournament.id}
            clubId={selectedTournament.club_id}
            teams={selectedTournament.teams || []}
            isRegisterModalOpen={isRegisterModalOpen}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            onCloseRegisterModal={() => setIsRegisterModalOpen(false)}
          />
        )}

        {activeTab === "fixture" && (
          <TournamentFixtureSection
            //tournamentId={selectedTournament.id}
            matches={selectedTournament.matches || []}
          />
        )}
      </div>

      {/* Modal para crear nuevo torneo */}
      <CreateTournamentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
