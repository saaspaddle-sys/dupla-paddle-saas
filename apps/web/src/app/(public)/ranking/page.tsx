"use client";

import Footer from "../component/Footer";
import Header from "../component/header";
import { useState } from "react";

export default function RankingScreen() {
  //estados para controlar los filtros del ranking
  const [segmento, setSegmento] = useState("Libres");
  const [periodo, setPeriodo] = useState("Circuito 2026");
  const [categoria, setCategoria] = useState("Caballeros 1ra");
  return (
    <div className="min-h-screen bg-(--background) text-gray-800 flex flex-col justify-between">
      <div>
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full">
          {/* ================= SECCIÓN SUPERIOR: TÍTULOS Y DESCARGA ================= */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-8">
            {/* Lado Izquierdo: Textos */}
            <div className="space-y-3">
              {/* Etiqueta de Actualización */}
              <div className="inline-block bg-deep-onyx text-padel-green px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase">
                Actualizado 2026(Poner fecha automatica)
              </div>

              <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                  Ranking Nacional -{" "}
                  <span className="text-padel-green-title">
                    Caballeros 1ra(varia segun categoria)
                  </span>
                </h1>
                <p className="text-gray-500 font-medium text-sm md:text-base">
                  Circuito oficial Dupla - Benito Juarez
                </p>
              </div>
            </div>

            {/* Lado Derecho: Botón de Descarga PDF */}
            <button
              className="flex items-center justify-center gap-2 bg-deep-onyx text-white hover:bg-opacity-90 
            hover:text-padel-green text-sm font-semibold px-5 py-3 rounded-xl shadow-md transition-all self-start md:self-end cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Descargar Ranking (PDF)
            </button>
          </div>

          {/* ================= SECCIÓN INFERIOR: CONTENEDOR DE FILTROS ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
            {/* Tarjeta Blanca de Selects */}
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Select 1: Segmento */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Segmento
                </label>
                <select
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green cursor-pointer text-gray-700"
                >
                  <option value="Libres">Libres</option>
                  <option value="Menores">Menores</option>
                  <option value="Veteranos">Veteranos</option>
                </select>
              </div>

              {/* Select 2: Periodo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Periodo
                </label>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green cursor-pointer text-gray-700"
                >
                  <option value="Circuito 2026">Circuito 2026</option>
                  {/*Aca hay que traer los periodos desde la DB a medida que pasan los años*/}
                </select>
              </div>

              {/* Select 3: Categoría */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Categoría
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green cursor-pointer text-gray-700"
                >
                  <option value="Caballeros 1ra">Caballeros 1ra</option>
                  <option value="Caballeros 2da">Caballeros 2da</option>
                  <option value="Caballeros 2da-Prov">
                    Caballeros 2da- Prov
                  </option>
                  <option value="Caballeros 3ra">Caballeros 3ra</option>
                  <option value="Caballeros 3ra-Prov">Caballeros 3ra</option>
                  <option value="Caballeros 4ta">Caballeros 4ta</option>
                  <option value="Caballeros 4ta-Prov">
                    Caballeros 4ta- Prov
                  </option>
                  <option value="Caballeros 5ta">Caballeros 5ta</option>
                  <option value="Caballeros 5ta-Prov">
                    Caballeros 5ta- Prov
                  </option>
                  <option value="Caballeros 6ta">Caballeros 6ta</option>
                  <option value="Caballeros 6ta-Prov">
                    Caballeros 6ta- Prov
                  </option>
                  <option value="Caballeros 7ma">Caballeros 7ma</option>
                  <option value="Caballeros 7ma-prov">
                    Caballeros 7ma- Prov
                  </option>

                  <option value="Damas 1ra">Damas 1ra</option>
                  <option value="Damas 2da">Damas 2da</option>
                  <option value="Damas 3ra">Damas 3ra</option>
                  <option value="Damas 3ra-Prov">Damas 3ra- Prov</option>
                  <option value="Damas 4ta">Damas 4ta</option>
                  <option value="Damas 4ta-Prov">Damas 4ta- Prov</option>
                  <option value="Damas 5ta">Damas 5ta</option>
                  <option value="Damas 5ta-Prov">Damas 5ta- Prov</option>
                  <option value="Damas 6ta">Damas 6ta</option>
                  <option value="Damas 6ta-Prov">Damas 6ta- Prov</option>
                  <option value="Damas 7ma">Damas 7ma</option>
                  <option value="Damas 7ma-Prov">Damas 7ma- Prov</option>
                </select>
              </div>
            </div>

            {/* Botón Fluo de Aplicar Filtros */}
            <button className="bg-padel-green hover:bg-opacity-95 text-deep-onyx rounded-2xl p-4 flex flex-col justify-center items-center text-center transition-all cursor-pointer shadow-sm group active:scale-[0.99]">
              <svg
                className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className="text-lg font-bold block leading-tight">
                Aplicar Filtros
              </span>
              <span className="text-[10px] opacity-70 font-medium mt-0.5">
                Actualizar Grilla
              </span>
            </button>
          </div>

          {/* ================= SECCIÓN: TABLA DE RANKING ================= */}
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Encabezado Negro de la Tarjeta */}
            <div className="bg-deep-onyx px-6 py-4 flex justify-between items-center">
              <h3 className="text-padel-green text-xl font-bold tracking-tight">
                Top Jugadores
              </h3>
              <span className="text-[10px] bg-padel-green/10 text-padel-green px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                Puntos Acumulados
              </span>
            </div>

            {/* Contenedor de la Tabla Responsiva */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-4 px-6 text-center w-24">Posición</th>
                    <th className="py-4 px-6">Jugador</th>
                    <th className="py-4 px-6 text-center">Torneos Jugados</th>
                    <th className="py-4 px-6 text-right w-32">Puntos</th>
                  </tr>
                </thead>

                {/*Cuerpo de tabla, modificar cuando tengamos la db realizada
                vamos a tener que hacer el fetch y dinamizar todos los datos*/}
                <tbody className="divide-y divide-gray-100 text-gray-700 text-sm">
                  {/* Fila Ejemplo 1 (Primer Puesto Estilo Destacado) */}
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-8 h-8 rounded-full bg-padel-green text-deep-onyx font-extrabold flex items-center justify-center text-base shadow-sm">
                          1
                        </span>
                        <span className="text-yellow-500 text-xs">⭐</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-100 shrink-0">
                          {/* Reemplazar con <Image /> de Next cuando tengas las URL listas */}
                          <img
                            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"
                            alt="Federico Chingotto"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 leading-tight">
                            Federico Chingotto
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium">
                            Olavarría, Argentina
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center font-medium text-gray-600">
                      12
                    </td>
                    <td className="py-4 px-6 text-right font-black text-gray-900 text-base">
                      4,500
                    </td>
                  </tr>

                  {/* Fila Ejemplo 2 (Posiciones normales) */}
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-center">
                      <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-sm">
                        2
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-100 shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop"
                            alt="Matías González"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 leading-tight">
                            Matías González
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium">
                            Loma Negra, Argentina
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center font-medium text-gray-600">
                      11
                    </td>
                    <td className="py-4 px-6 text-right font-black text-gray-900 text-base">
                      3,850
                    </td>
                  </tr>

                  {/* Fila Ejemplo 3 */}
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-center">
                      <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-sm">
                        3
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-100 shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
                            alt="Lucas Rodríguez"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 leading-tight">
                            Lucas Rodríguez
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium">
                            Olavarría, Argentina
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center font-medium text-gray-600">
                      10
                    </td>
                    <td className="py-4 px-6 text-right font-black text-gray-900 text-base">
                      3,200
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ================= PIE DE TABLA Y PAGINACIÓN ================= */}
            <div className="bg-gray-50/50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              {/* Leyenda izquierda */}
              <span className="text-xs text-gray-400 font-medium text-center sm:text-left">
                Mostrando los mejores 5 jugadores de la categoría
              </span>

              {/* Botones de Paginación */}
              <div className="flex items-center gap-1.5">
                {/* Flecha Izquierda */}
                <button className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors cursor-pointer disabled:opacity-50">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Página Activa */}
                <button className="w-8 h-8 rounded-lg bg-deep-onyx text-padel-green text-xs font-bold flex items-center justify-center shadow-sm cursor-pointer">
                  1
                </button>

                {/* Página Inactiva */}
                <button className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  2
                </button>

                {/* Página Inactiva */}
                <button className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  3
                </button>

                {/* Flecha Derecha */}
                <button className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors cursor-pointer">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
