//pantalla principal de player que se muestra en el layout a traves de <main>{children}</main>
'use client'

import Link from 'next/link';

export default function PlayerDashboardPage() {
  // Mock de datos del jugador logueado
  const jugador = {
    nombre: "Julieta",
    apellido: "Sak",
    categoria: "4ta Damas",
    puntos: 1250,
    ranking: 12,
    proximaFecha: {
      torneo: "Apertura Anual 2026",
      fecha: "15 - 17 de Marzo",
      lugar: "Complejo El Triunfo",
      estado: "Inscripto",// este estado debe ser un quizas un Enum inscripto / No inscripto que debe traerse desde la DB. hablar con TOMY
    }
  };

  return (
    <div className="space-y-6">
      {/* Saludo y Resumen Rápido */}
      <div className="bg-deep-onyx text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-padel-green text-xs font-bold uppercase tracking-wider block">
            Panel de Jugador
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
            ¡Hola, {jugador.nombre}! 👋
          </h1>
          <p className="text-gray-400 text-xs md:text-sm mt-1">
            Categoría: <strong className="text-white">{jugador.categoria}</strong> • Puntos: <strong className="text-padel-green">{jugador.puntos} pts</strong>
          </p>
        </div>

        {/* Acceso directo a inscripción */}
        <Link
          href="/inscription"
          className="bg-padel-green text-deep-onyx font-bold text-xs px-5 py-3 rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-md active:scale-95"
        >
          Inscribirme a un Torneo
        </Link>
      </div>

      {/* Cards de Estado y Próximos Eventos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card: Próximo Torneo */}
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-lg text-gray-900">
              Próxima Competencia
            </h2>
            <span className="bg-[#f3f9c6] text-gray-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-[#e1eea0]">
              {jugador.proximaFecha.estado}
            </span>
          </div>

          <div className="bg-[#f7f9e8]/80 p-4 rounded-2xl border border-[#eef3cd]/80 space-y-1">
            <h3 className="font-black text-base text-gray-900">
              {jugador.proximaFecha.torneo}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              📅 {jugador.proximaFecha.fecha} • 📍 {jugador.proximaFecha.lugar}
            </p>
          </div>
        </div>

        {/* Card: Ranking / Estadísticas */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
            Posición Oficial
          </span>
          <div className="my-3">
            <span className="text-4xl font-black text-gray-900">#{jugador.ranking}</span>
            <p className="text-xs text-gray-400 font-medium mt-1">En el ranking de la categoría</p>
          </div>
          <Link 
            href="/ranking" 
            className="text-xs font-bold text-padel-green-title hover:underline flex items-center gap-1"
          >
            Ver tabla completa <span>→</span>
          </Link>
        </div>

      </div>
    </div>
  );
}