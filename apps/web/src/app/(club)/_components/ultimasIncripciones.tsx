"use client";

import React, { useState } from "react";

export interface Inscripcion {
  id: string;
  jugador: string;
  torneo: string;
  categoria: string;
  estado: "Pagado" | "Pendiente";
}

interface Props {
  inscripciones: Inscripcion[];
}

export default function UltimasInscripciones({ inscripciones }: Props) {
  const [listaInscripciones, setListaInscripciones] =
    useState<Inscripcion[]>(inscripciones);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<
    "Todos" | "Pagado" | "Pendiente"
  >("Todos");

  // Alternar entre Pagado y Pendiente
  const toggleEstado = (id: string | number) => {
    setListaInscripciones((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nuevoEstado = item.estado === "Pagado" ? "Pendiente" : "Pagado";

          // Acá tendriamos que hacer el fetch/patch a de la API de NestJS a futuro
          // await api.updateEstado(id, nuevoEstado);

          return { ...item, estado: nuevoEstado };
        }
        return item;
      }),
    );
  };

  const inscripcionesFiltradas = listaInscripciones.filter((row) => {
    const coincideNombre = row.jugador
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const coincideEstado =
      estadoFiltro === "Todos" || row.estado === estadoFiltro;
    return coincideNombre && coincideEstado;
  });

  return (
    <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5 md:p-6 space-y-4">
      {/* HEADER CON BUSCADOR Y FILTRO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base font-bold text-white">
          Últimas Inscripciones
        </h3>

        <div className="flex items-center gap-2">
          {/* Input Buscador */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#141619] border border-gray-700 focus:border-padel-green text-xs text-white rounded-lg pl-8 pr-3 py-1.5 focus:outline-none w-36 sm:w-48 font-medium transition-all placeholder:text-gray-500"
            />
            <svg
              className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"
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
          </div>

          {/* Select Filtro de Estado */}
          <select
            value={estadoFiltro}
            onChange={(e) =>
              setEstadoFiltro(
                e.target.value as "Todos" | "Pagado" | "Pendiente",
              )
            }
            className="bg-[#141619] border border-gray-700 focus:border-padel-green text-xs text-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer"
          >
            <option value="Todos">Todos</option>
            <option value="Pagado">Pagados</option>
            <option value="Pendiente">Pendientes</option>
          </select>
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-125">
          <thead>
            <tr className="border-b border-gray-800 text-[10px] font-black uppercase text-gray-500 tracking-wider">
              <th className="pb-3">Jugador</th>
              <th className="pb-3">Torneo</th>
              <th className="pb-3">Categoría</th>
              <th className="pb-3 text-right">Estado de Pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-xs font-semibold">
            {inscripcionesFiltradas.length > 0 ? (
              inscripcionesFiltradas.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-800/20 transition-colors"
                >
                  <td className="py-3 font-bold text-white">{row.jugador}</td>
                  <td className="py-3 text-gray-300">{row.torneo}</td>
                  <td className="py-3">
                    <span className="bg-gray-800/80 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-700/50">
                      {row.categoria}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {/* Botón interactivo para alternar estado */}
                    <button
                      onClick={() => toggleEstado(row.id)}
                      title="Haz clic para cambiar el estado"
                      className="cursor-pointer transition-transform active:scale-95 focus:outline-none"
                    >
                      {row.estado === "Pagado" ? (
                        <span className="text-padel-green bg-padel-green/10 border border-padel-green/30 hover:bg-padel-green/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 text-[11px] font-bold">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Pagado
                        </span>
                      ) : (
                        <span className="text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 text-[11px] font-bold">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Pendiente
                        </span>
                      )}
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
                  No se encontraron inscripciones con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
