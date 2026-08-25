"use client";
import Header from "../../(public)/component/header";
import Footer from "../../(public)/component/Footer";
import Image from "next/image";
import { useState } from "react";

export default function TournamentScreen() {
  // Mock de datos de fechas (para conectar al backend después)
  const fechasCalendario = [
    {
      id: 1,
      rango: "15 - 17 MAR",
      etiqueta: "FECHA 1",
      titulo: "Apertura Anual",
      lugar: "Complejo El Triunfo",
      categorias: "Todas las categorías",
      activa: true, // Para el borde verde del diseño
    },
    {
      id: 2,
      rango: "05 - 07 ABR",
      etiqueta: "FECHA 2",
      titulo: "Torneo de Otoño",
      lugar: "Las Terrazas Padel",
      categorias: "",
      activa: false,
    },
    {
      id: 3,
      rango: "24 - 26 MAY",
      etiqueta: "PROVINCIAL",
      titulo: "Provincial de Menores",
      lugar: "Sede Central Olavarría",
      categorias: "",
      activa: false,
    },
    {
      id: 4,
      rango: "02 - 07 ABR",
      etiqueta: "PROVINCIAL",
      titulo: "Torneo Patitas",
      lugar: "Punto de Oro, Juarez",
      categorias: "Caballeros 5ta",
      activa: true,
    },
    {
      id: 5,
      rango: "1 - 08 SEP",
      etiqueta: "PROVINCIAL",
      titulo: "Torneo Juarense",
      lugar: "Club Atletico Juarense",
      categorias: "Damas 1ra",
      activa: true,
    },
  ];

  //Control de estado de tarjetas
  // Inicializamos el estado con el ID de la primera tarjeta (1) para que sea la de por defecto
  const [idTarjetaActiva, setIdTarjetaActiva] = useState<number | null>(1);

  return (
    <div className="min-h-screen bg-var(--background) text-gray-800 flex flex-col justify-between">
      <div>
        <Header />

        {/* ================= SECCIÓN 1: HERO (ENCABEZADO OSCURO) ================= */}
        <section className="bg-deep-onyx text-white py-12 md:py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            <h1 className="text-4xl md:text-5xl font-black text-padel-green tracking-tight">
              Torneos y Eventos
            </h1>
            <p className="text-gray-400 text-sm md:text-base max-w-2xl font-medium leading-relaxed">
              Explora el calendario oficial del circuito Juarense de Pádel. La
              competencia más prestigiosa de la región para todas las
              categorías.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button className="bg-padel-green hover:bg-opacity-95 text-deep-onyx font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer active:scale-[0.98]">
                Ver Próximas Fechas
              </button>
              <button className="flex flex-row items-center gap-2 border-2 border-padel-green  text-padel-green hover:bg-padel-green hover:text-deep-onyx font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer active:scale-[0.98]">
                Reglamento 2026
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className=" lucide lucide-download-icon lucide-download"
                >
                  <path d="M12 15V3" />
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ================= SECCIÓN 2: CALENDARIO E INSTITUCIONAL ================= */}
        <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 w-full">
          {/* Encabezado del Calendario */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <span className="text-[10px] font-bold text-padel-green-title uppercase tracking-wider block mb-1">
                Planificación 2026
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                Calendario Institucional{" "}
                <p>Convendra hacer carrusel en la seccion de imagenes??</p>
              </h2>
            </div>
            {/* Botones de Navegación del Slider */}
            <div className="flex gap-2">
              <button className="group w-8 h-8 rounded-lg border border-gray-200 bg-deep-onyx flex items-center justify-center text-text-dark-main hover:border-padel-green transition-all cursor-pointer shadow-sm active:scale-95">
                <svg
                  className="w-4 h-4 transition-colors group-hover:text-padel-green"
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
              <button className="w-8 h-8 rounded-lg border border-gray-200 bg-deep-onyx flex items-center justify-center text-text-dark-main transition-colors cursor-pointer shadow-sm">
                <svg
                  className="w-4 h-4 hover:text-padel-green"
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

          {/* Grilla Principal Asimétrica */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* COLUMNA IZQUIERDA: Lista de Fechas */}
            <div className="flex flex-col gap-4 h-91 overflow-y-auto pr-2 custom-scrollbar">
              {fechasCalendario.map((fecha) => {
                // Evaluamos dinámicamente si esta tarjeta es la que debe tener el borde verde
                const estaActiva = idTarjetaActiva === fecha.id;
                return (
                  <div
                    key={fecha.id}
                    // 1. Cuando el mouse entra a la tarjeta, se vuelve la activa
                    onMouseEnter={() => setIdTarjetaActiva(fecha.id)}
                    // 2. Cuando el mouse sale, vuelve a dejar como activa la primera (por defecto)
                    onMouseLeave={() => setIdTarjetaActiva(1)}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all duration-200 hover:shadow-md flex justify-between items-start gap-4 cursor-pointer ${
                      estaActiva
                        ? "border-gray-100 border-l-padel-green border-l-4"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="space-y-2">
                      <span className="text-xs font-black text-deep-onyx block">
                        {fecha.rango}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-lg text-gray-900 leading-tight">
                          {fecha.titulo}
                        </h4>
                        <p className="text-xs text-gray-400 font-medium mt-1">
                          {fecha.lugar}{" "}
                          {fecha.categorias && `- ${fecha.categorias}`}
                        </p>
                      </div>
                    </div>

                    {/* Badge de la derecha */}
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        fecha.etiqueta === "PROVINCIAL"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {fecha.etiqueta}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* TARJETA DESTACADA 1: Máster Series Oro */}
            <div className="relative group rounded-2xl overflow-hidden shadow-md aspect-4/3 lg:aspect-auto lg:h-92 flex flex-col justify-end p-6 cursor-pointer">
              {/* Overlay de Imagen */}
              <Image
                src="/assets/images/photo-CardTorneo01.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, 100vw"
                priority
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {/* Degradado para legibilidad del texto */}
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

              {/* Contenido */}
              <div className="relative z-10 space-y-2">
                <span className="inline-block bg-padel-green text-deep-onyx text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  Destacado
                </span>
                <h3 className="text-white text-2xl font-black tracking-tight leading-tight">
                  Máster Series Oro
                </h3>
                <p className="text-gray-300 text-xs font-medium max-w-xs line-clamp-2">
                  El evento más importante del año con premios récord y
                  transmisión en vivo.
                </p>
                <div className="text-padel-green font-bold text-xs flex items-center gap-1 pt-2 group-hover:translate-x-1 transition-transform">
                  Detalles del Torneo <span>→</span>
                </div>
              </div>
            </div>

            {/* TARJETA DESTACADA 2: Interclubes Regional */}
            <div className="relative group rounded-2xl overflow-hidden shadow-md aspect-4/3 lg:aspect-auto lg:h-92 flex flex-col justify-end p-6 cursor-pointer">
              {/* Overlay de Imagen */}
              <Image
                src="/assets/images/photo-card-torneo02.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

              {/* Contenido */}
              <div className="relative z-10 space-y-2">
                <span className="inline-block bg-deep-onyx border border-padel-green text-padel-green text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  Próximamente
                </span>
                <h3 className="text-white text-2xl font-black tracking-tight leading-tight">
                  Interclubes Regional
                </h3>
                <p className="text-gray-300 text-xs font-medium max-w-xs line-clamp-2">
                  Competencia por equipos representando a las mejores academias
                  de la provincia.
                </p>
                <div className="text-padel-green font-bold text-xs flex items-center gap-1 pt-2 group-hover:translate-x-1 transition-transform">
                  Ver Clubes <span>→</span>
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
