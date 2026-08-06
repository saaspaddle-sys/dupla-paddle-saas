"use client";

import { useState } from "react";
import Header from "../component/header";
import Footer from "../component/Footer";

//Interfaces usadas para la plantilla
interface TorneoHistorial {
  id: number;
  nombre: string;
  fecha: string;
  companero: string;
  instancia: string;
  puntos: number;
  esCampeon?: boolean;
}

interface Jugador {
  id: number;
  nombre: string;
  apellido: string;
  pais: string;
  provincia: string;
  localidad: string;
  categoria: string;
  genero: "Caballeros" | "Damas";
  fotoUrl?: string;
  fiscalizado: boolean;
  activo: boolean;
  puntos: number;
  ranking: number;
  eficiencia: number;
  torneosJugados: number;
  sanciones: string;
  historial: TorneoHistorial[];
}

export default function PlayerScreen() {
  //Creamos juagadores hardcodeados para mostrar en pantalla hasta poder utilizar la DB

  const jugadoresData: Jugador[] = [
    {
      id: 1,
      nombre: "JULIETA SOLEDAD",
      apellido: "SAK",
      pais: "Argentina",
      provincia: "Bs.As",
      localidad: "Olavarría",
      categoria: "4ta D",
      genero: "Damas",
      fotoUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      fiscalizado: true,
      activo: true,
      puntos: 1250,
      ranking: 12,
      eficiencia: 68,
      torneosJugados: 24,
      sanciones: "Sin Sanciones",
      historial: [
        {
          id: 101,
          nombre: "Copa Aniversario Lagartos",
          fecha: "Oct 2024",
          companero: "PEREZ, MIRIAN",
          instancia: "Campeón",
          puntos: 500,
          esCampeon: true,
        },
        {
          id: 102,
          nombre: "Torneo Padeltime",
          fecha: "Sep 2024",
          companero: "ALVARO, LUCIA",
          instancia: "Semifinal",
          puntos: 250,
        },
        {
          id: 103,
          nombre: "Abierto Chingoland",
          fecha: "Ago 2024",
          companero: "ECHAIDE, MARÍA",
          instancia: "Cuartos",
          puntos: 120,
        },
      ],
    },
    {
      id: 2,
      nombre: "JOAQUÍN",
      apellido: "DELFINO",
      pais: "Argentina",
      provincia: "Bs.As",
      localidad: "Olavarría",
      categoria: "Cab_SC",
      genero: "Caballeros",
      fiscalizado: true,
      activo: true,
      puntos: 980,
      ranking: 28,
      eficiencia: 55,
      torneosJugados: 16,
      sanciones: "Sin Sanciones",
      historial: [
        {
          id: 104,
          nombre: "Torneo Padeltime",
          fecha: "Sep 2024",
          companero: "GOMEZ, CARLOS",
          instancia: "Finalista",
          puntos: 300,
        },
      ],
    },
    {
      id: 3,
      nombre: "FELIPE",
      apellido: "TUFRO",
      pais: "Argentina",
      provincia: "Bs.As",
      localidad: "Saladillo",
      categoria: "3ra C",
      genero: "Caballeros",
      fotoUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
      fiscalizado: true,
      activo: true,
      puntos: 1850,
      ranking: 5,
      eficiencia: 74,
      torneosJugados: 30,
      sanciones: "Sin Sanciones",
      historial: [],
    },
    {
      id: 4,
      nombre: "JUAN",
      apellido: "DENTARO",
      pais: "Argentina",
      provincia: "Bs.As",
      localidad: "Olavarría",
      categoria: "6ta C",
      genero: "Caballeros",
      fiscalizado: true,
      activo: true,
      puntos: 450,
      ranking: 64,
      eficiencia: 48,
      torneosJugados: 8,
      sanciones: "Sin Sanciones",
      historial: [],
    },
  ];

  // Estados
  const [filtroGenero, setFiltroGenero] = useState<
    "Todos" | "Caballeros" | "Damas"
  >("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState<Jugador>(
    jugadoresData[0],
  );

  // Filtrado de la lista izquierda
  //Esta logica es momentanea, a futuro remplazaremos por un fetch a la DB trayendo toda la info de jugadores para renderizar en pantalla, solicitar endpoint a Tomy

  //filtro
  const jugadoresFiltrados = jugadoresData.filter((j) => {
    const coincideGenero =
      filtroGenero === "Todos" || j.genero === filtroGenero;
    const coincideBusqueda =
      j.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      j.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
      j.categoria.toLowerCase().includes(busqueda.toLowerCase());
    return coincideGenero && coincideBusqueda;
  });
  return (
    <div className="min-h-screen bg-[#f7f9e8]/50 text-gray-800 flex flex-col justify-between">
      <div>
        <Header />

        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ================= COLUMNA IZQUIERDA: BUSCADOR Y LISTA ================= */}
            <div className="lg:col-span-4 space-y-4">
              {/* Card de Buscador y Filtros */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  Jugadores
                </h1>

                {/* Input Buscador */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
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
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar jugador..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-base font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-padel-green focus:bg-white transition-all"
                  />
                </div>

                {/* Badges de Filtro por Género */}
                <div className="flex gap-2 pt-1">
                  {(["Todos", "Caballeros", "Damas"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFiltroGenero(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        filtroGenero === cat
                          ? "bg-padel-green text-gray-900 shadow-xs"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200/70"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de Jugadores */}
              <div className="space-y-3">
                {jugadoresFiltrados.map((jugador) => {
                  const estaSeleccionado =
                    jugadorSeleccionado.id === jugador.id;

                  return (
                    <div
                      key={jugador.id}
                      onClick={() => setJugadorSeleccionado(jugador)}
                      className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between border-2 ${
                        estaSeleccionado
                          ? "bg-deep-onyx text-white border-l-4 border-l-padel-green border-deep-onyx shadow-md"
                          : "bg-white text-gray-800 border-gray-100 hover:border-gray-200 hover:shadow-xs"
                      }`}
                    >
                      {/* Las etiquetas Img se cambiaran a futuro por <Imagen> para ser utilizadas por next. */}
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        {jugador.fotoUrl ? (
                          <img
                            src={jugador.fotoUrl}
                            alt={jugador.nombre}
                            className="w-11 h-11 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center ${
                              estaSeleccionado
                                ? "bg-gray-800 text-gray-300"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        )}

                        {/* Nombre y Info */}
                        <div>
                          <h4
                            className={`text-sm font-black tracking-tight leading-snug ${
                              estaSeleccionado ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {`${jugador.apellido}, ${jugador.nombre}`}
                          </h4>
                          <p
                            className={`text-[12px] font-medium mt-0.5 ${
                              estaSeleccionado
                                ? "text-gray-400"
                                : "text-gray-400"
                            }`}
                          >
                            {`${jugador.categoria} • ${jugador.localidad} •
                                                            ${jugador.provincia}
                                                            `}
                          </p>
                        </div>
                      </div>

                      {/* Flecha solo en el seleccionado */}
                      {estaSeleccionado && (
                        <span className="text-padel-green font-bold text-sm pr-1">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ================= COLUMNA DERECHA: FICHA Y MÉTRICAS ================= */}
            <div className="lg:col-span-8 space-y-5">
              {/* CARD PRINCIPAL: DATOS DEL JUGADOR */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                {/* Badges Estado Superior Derecho */}
                <div className="flex justify-end gap-2 mb-3">
                  {jugadorSeleccionado.fiscalizado && (
                    <span className="bg-padel-green text-gray-800 text-[12px] font-semibold px-3 py-1 rounded-full border border-[#e1eea0]">
                      Fiscalizado
                    </span>
                  )}
                  {jugadorSeleccionado.activo && (
                    <span className="bg-gray-100 text-gray-500 text-[12px] font-semibold px-3 py-1 rounded-full">
                      Activo
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  {/* Avatar Grande */}
                  {jugadorSeleccionado.fotoUrl ? (
                    <img
                      src={jugadorSeleccionado.fotoUrl}
                      alt={jugadorSeleccionado.nombre}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-gray-100 shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center border-2 border-gray-100">
                      <svg
                        className="w-10 h-10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Info Personal */}
                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                      {`${jugadorSeleccionado.apellido}, ${jugadorSeleccionado.nombre}`}
                    </h2>
                    <p className="text-xs text-gray-400 font-bold flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {`${jugadorSeleccionado.localidad} •
                                            ${jugadorSeleccionado.provincia}`}
                    </p>
                  </div>
                </div>

                {/* Bloque Estadísticas Principales */}
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <div className="bg-(--background) p-3.5 rounded-2xl border border-[#eef3cd]/80">
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">
                      Categoría
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 block">
                      {jugadorSeleccionado.categoria}
                    </span>
                  </div>
                  <div className="bg-(--background) p-3.5 rounded-2xl border border-[#eef3cd]/80">
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">
                      Puntos
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 block">
                      {jugadorSeleccionado.puntos.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-(--background) p-3.5 rounded-2xl border border-[#eef3cd]/80">
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">
                      Ranking
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 block">
                      #{jugadorSeleccionado.ranking}
                    </span>
                  </div>
                </div>
              </div>

              {/* GRILLA DE TRES CARDS SECUNDARIAS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Eficiencia */}
                <div className="bg-deep-onyx text-white p-5 rounded-3xl flex flex-col justify-between relative min-h-30">
                  <div className="flex justify-between items-start">
                    <svg
                      className="w-5 h-5 text-padel-green"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                    <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                      Eficiencia
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-4xl font-black text-padel-green tracking-tight">
                      {jugadorSeleccionado.eficiencia}%
                    </span>
                    <p className="text-[11px] text-gray-300 font-bold mt-1">
                      Partidos Ganados
                    </p>
                  </div>
                </div>

                {/* Torneos Jugados */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 flex flex-col justify-between min-h-30">
                  <div className="flex justify-between items-start">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                      Temporada
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-gray-900 tracking-tight">
                      {jugadorSeleccionado.torneosJugados}
                    </span>
                    <p className="text-[11px] text-gray-400 font-medium mt-1">
                      Torneos Jugados
                    </p>
                  </div>
                </div>

                {/* Sanciones */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 flex flex-col items-center justify-center text-center min-h-30">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 mb-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-sm font-black text-gray-900">
                    {jugadorSeleccionado.sanciones}
                  </h4>
                  <p className="text-[12px] text-gray-400 font-medium mt-0.5">
                    Historial limpio
                  </p>
                </div>
              </div>

              {/* HISTORIAL DE TORNEOS */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    Historial de Torneos
                  </h3>
                  <button className="text-xs font-bold text-gray-900 hover:underline cursor-pointer">
                    Ver Todos
                  </button>
                </div>

                {/* Tabla de Torneos */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-(--background) text-[12px] font-black text-gray-700 uppercase tracking-wider rounded-xl">
                        <th className="py-2.5 px-3 rounded-l-xl">Torneo</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Compañero/a</th>
                        <th className="py-2.5 px-3">Instancia</th>
                        <th className="py-2.5 px-3 text-right rounded-r-xl">
                          Pts
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs font-semibold">
                      {jugadorSeleccionado.historial.length > 0 ? (
                        jugadorSeleccionado.historial.map((torneo) => (
                          <tr
                            key={torneo.id}
                            className="hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-3.5 px-3 font-semibold text-gray-900">
                              {torneo.nombre}
                            </td>
                            <td className="py-3.5 px-3 text-gray-400 font-medium">
                              {torneo.fecha}
                            </td>
                            <td className="py-3.5 px-3 text-gray-700 font-bold">
                              {torneo.companero}
                            </td>
                            <td className="py-3.5 px-3">
                              {torneo.esCampeon ? (
                                <span className="bg-deep-onyx text-padel-green text-[10px] font-extrabold px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                                  <span>🏆</span> Campeón
                                </span>
                              ) : (
                                <span className="text-gray-600 font-bold">
                                  {torneo.instancia}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right font-black text-gray-900">
                              {torneo.puntos}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-6 text-center text-sm text-gray-400 font-medium"
                          >
                            No hay torneos registrados para este jugador.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
