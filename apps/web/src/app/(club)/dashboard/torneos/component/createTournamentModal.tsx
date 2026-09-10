"use client";

import React, { useState } from "react";
import {
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from "../utils/tournamentModel";

type NewTournamentPayload = Pick<
  Tournament,
  "name" | "category" | "format" | "status" | "max_teams"
> & { starts_at: string | null };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Callback para cuando se envíe el formulario
  onSubmitSuccess?: (newTournament: NewTournamentPayload) => void;
}

export default function CreateTournamentModal({
  isOpen,
  onClose,
  onSubmitSuccess,
}: Props) {
  // Estados para los campos que corresponden a la tabla `tournaments`
  const [name, setName] = useState("");
  const [category, setCategory] = useState("6ta");
  const [format, setFormat] = useState<TournamentFormat>("single_elimination");
  const [maxTeams, setMaxTeams] = useState<number>(32);
  const [startsAt, setStartsAt] = useState("");
  const [status, setStatus] = useState<TournamentStatus>("draft");

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const tournamentPayload = {
      name,
      category,
      format,
      max_teams: Number(maxTeams),
      status,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    };

    try {
      // Acá a futuro harás el fetch/post a tu backend de NestJS:
      // const res = await api.post('/tournaments', tournamentPayload);

      console.log("Creando torneo con data:", tournamentPayload);

      if (onSubmitSuccess) {
        onSubmitSuccess(tournamentPayload);
      }

      // Limpiar y cerrar
      setName("");
      onClose();
    } catch (error) {
      console.error("Error al crear el torneo:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#141619] border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <h2 className="text-lg font-bold text-white">Crear Nuevo Torneo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre del torneo */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Nombre del Torneo
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Copa Aniversario Juarense"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1e2024] border border-gray-700 focus:border-padel-green text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-all placeholder:text-gray-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categoría */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1e2024] border border-gray-700 focus:border-padel-green text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-all cursor-pointer"
              >
                <option value="1ra">1ra Categoría</option>
                <option value="2da">2da Categoría</option>
                <option value="3ra">3ra Categoría</option>
                <option value="4ta">4ta Categoría</option>
                <option value="5ta">5ta Categoría</option>
                <option value="6ta">6ta Categoría</option>
                <option value="7ma">7ma Categoría</option>
                <option value="Suma 11">Suma 11</option>
                <option value="Suma 13">Suma 13</option>
              </select>
            </div>

            {/* Cantidad de Parejas (Cupo Máximo) */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Cant. Parejas (Cupo)
              </label>
              <select
                value={maxTeams}
                onChange={(e) => setMaxTeams(Number(e.target.value))}
                className="w-full bg-[#1e2024] border border-gray-700 focus:border-padel-green text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-all cursor-pointer"
              >
                <option value={8}>8 Parejas</option>
                <option value={12}>12 Parejas</option>
                <option value={16}>16 Parejas</option>
                <option value={24}>24 Parejas</option>
                <option value={32}>32 Parejas</option>
                <option value={64}>64 Parejas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Formato */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Formato
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="w-full bg-[#1e2024] border border-gray-700 focus:border-padel-green text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-all cursor-pointer"
              >
                <option value="single_elimination">Eliminación Directa</option>
                <option value="groups">Fase de Grupos + Llave</option>
              </select>
            </div>

            {/* Fecha de inicio */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Fecha de Inicio
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full bg-[#1e2024] border border-gray-700 focus:border-padel-green text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Estado inicial */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Estado Inicial
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TournamentStatus)}
              className="w-full bg-[#1e2024] border border-gray-700 focus:border-padel-green text-sm text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-all cursor-pointer"
            >
              <option value="draft">Borrador (Draft)</option>
              <option value="in_progress">
                Inscripciones Abiertas / En Progreso
              </option>
            </select>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Crear Torneo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
