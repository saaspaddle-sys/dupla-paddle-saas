/*NOTA: este archivo guarda todo en localStorage, desde el navegador no se tiene acceso al archivo JSON por lo qeu no puede ser modificado.  */
/* Si llega a gustar hay qeu crear entidades y consumir la Api desde el endpoint eliminando el JSON */

"use client";

import React, { useState, useSyncExternalStore } from "react";
import datosIniciales from "../data/actividad-jugadores.json";

// Tipo para los datos de una semana
type Asistencia = {
  Lun: number;
  Mar: number;
  Mie: number;
  Jue: number;
  Vie: number;
  Sab: number;
  Dom: number;
};

// Tipo para todo el historial
type HistorialAsistencia = Record<string, Asistencia>;

const asistenciaVacia: Asistencia = {
  Lun: 0,
  Mar: 0,
  Mie: 0,
  Jue: 0,
  Vie: 0,
  Sab: 0,
  Dom: 0,
};

const CLAVE_ALMACENAMIENTO = "actividadJugadores";

// Store externo (localStorage) leído vía useSyncExternalStore: el snapshot
// del servidor y el primer snapshot del cliente coinciden (datosIniciales),
// evitando el error de hidratación al leer datos reales recién después.
let historialCache: HistorialAsistencia = datosIniciales;
let historialCargado = false;
let listeners: Array<() => void> = [];

const suscribirseAHistorial = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

const leerHistorialCliente = (): HistorialAsistencia => {
  if (!historialCargado) {
    const datosGuardados = localStorage.getItem(CLAVE_ALMACENAMIENTO);

    if (datosGuardados) {
      historialCache = JSON.parse(datosGuardados) as HistorialAsistencia;
    } else {
      localStorage.setItem(
        CLAVE_ALMACENAMIENTO,
        JSON.stringify(datosIniciales),
      );
    }

    historialCargado = true;
  }

  return historialCache;
};

const leerHistorialServidor = (): HistorialAsistencia => datosIniciales;

const guardarHistorialEnAlmacenamiento = (historial: HistorialAsistencia) => {
  localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(historial));
  historialCache = historial;
  historialCargado = true;
  listeners.forEach((listener) => listener());
};

const obtenerUltimaSemana = (historial: HistorialAsistencia): string => {
  const semanas = Object.keys(historial).sort();
  return semanas[semanas.length - 1] ?? "";
};

export default function ActividadJugadoresDos() {
  // --------------------------------------------------
  // ESTADOS
  // --------------------------------------------------

  // Guarda todas las semanas (sincronizado con localStorage)
  const historial = useSyncExternalStore(
    suscribirseAHistorial,
    leerHistorialCliente,
    leerHistorialServidor,
  );

  // Semana que estamos visualizando
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(() =>
    obtenerUltimaSemana(datosIniciales),
  );

  // Recuerda el último historial usado para elegir semana, para poder
  // ajustar la selección durante el render cuando cambie (sin useEffect).
  const [historialUsado, setHistorialUsado] = useState(historial);

  if (historial !== historialUsado) {
    setHistorialUsado(historial);
    setSemanaSeleccionada(obtenerUltimaSemana(historial));
  }

  // Controla si estamos editando
  const [editando, setEditando] = useState(false);

  // Datos temporales mientras editamos
  const [tempAsistencia, setTempAsistencia] =
    useState<Asistencia>(asistenciaVacia);

  // --------------------------------------------------
  // OBTENER LAS SEMANAS DISPONIBLES
  // --------------------------------------------------

  const semanas = Object.keys(historial).sort();

  // Datos de la semana seleccionada
  const asistencia: Asistencia =
    historial[semanaSeleccionada] ?? asistenciaVacia;

  // --------------------------------------------------
  // CALCULAR MÁXIMO
  // --------------------------------------------------

  const maxAsistencia = Math.max(...Object.values(asistencia), 1);

  // --------------------------------------------------
  // MODIFICAR UN DÍA
  // --------------------------------------------------

  const handleInputChange = (dia: string, valor: string) => {
    const num = parseInt(valor, 10) || 0;

    setTempAsistencia((prev) => ({
      ...prev,
      [dia]: num,
    }));
  };

  // --------------------------------------------------
  // GUARDAR CAMBIOS
  // --------------------------------------------------

  const guardarAsistencia = () => {
    const nuevoHistorial: HistorialAsistencia = {
      ...historial,
      [semanaSeleccionada]: {
        ...tempAsistencia,
      },
    };

    guardarHistorialEnAlmacenamiento(nuevoHistorial);
    setHistorialUsado(nuevoHistorial);
    setEditando(false);
  };

  // --------------------------------------------------
  // CAMBIAR DE SEMANA
  // --------------------------------------------------

  const cambiarSemana = (direccion: "anterior" | "siguiente") => {
    const indiceActual = semanas.indexOf(semanaSeleccionada);

    if (direccion === "anterior" && indiceActual > 0) {
      setSemanaSeleccionada(semanas[indiceActual - 1]);
    }

    if (direccion === "siguiente" && indiceActual < semanas.length - 1) {
      setSemanaSeleccionada(semanas[indiceActual + 1]);
    }
  };

  // --------------------------------------------------
  // FORMATEAR FECHA
  // --------------------------------------------------

  const formatearFecha = (fecha: string) => {
    const [anio, mes, dia] = fecha.split("-");

    return `${dia}/${mes}/${anio}`;
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5 md:p-6 space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">
            Actividad de Jugadores
          </h3>

          <p className="text-[11px] font-semibold text-gray-400">
            Carga el flujo diario de jugadores para ver los días pico.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* BOTÓN CARGAR DATOS */}
          <button
            onClick={() => {
              setTempAsistencia({ ...asistencia });
              setEditando(!editando);
            }}
            className="text-[10px] font-bold text-padel-green bg-padel-green/10 border border-padel-green/30 hover:bg-padel-green hover:text-deep-onyx px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            {editando ? "Cancelar" : "Cargar Datos"}
          </button>

          {/* SEMANA */}
          <span className="text-[10px] font-bold text-gray-400 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700/60">
            Esta Semana
          </span>
        </div>
      </div>

      {/* NAVEGACIÓN ENTRE SEMANAS */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => cambiarSemana("anterior")}
          disabled={semanas.indexOf(semanaSeleccionada) <= 0}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ←
        </button>

        <span className="text-xs font-bold text-gray-300">
          Semana del {formatearFecha(semanaSeleccionada)}
        </span>

        <button
          onClick={() => cambiarSemana("siguiente")}
          disabled={semanas.indexOf(semanaSeleccionada) >= semanas.length - 1}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          →
        </button>
      </div>

      {/* FORMULARIO DE EDICIÓN */}
      {editando && (
        <div className="bg-[#141619] border border-gray-800 p-4 rounded-xl transition-all">
          <p className="text-xs font-bold text-gray-300 mb-3">
            Ingresá la cantidad de asistencias del día:
          </p>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {Object.keys(tempAsistencia).map((dia) => (
              <div key={dia} className="flex flex-col items-center">
                <label className="text-[10px] font-bold text-gray-400 mb-1">
                  {dia}
                </label>

                <input
                  type="number"
                  min="0"
                  value={tempAsistencia[dia as keyof typeof tempAsistencia]}
                  onChange={(e) => handleInputChange(dia, e.target.value)}
                  className="w-full text-center bg-admin-panel-contraste border border-gray-700 focus:border-padel-green text-xs text-white rounded-lg py-1.5 focus:outline-none font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ))}
          </div>

          <button
            onClick={guardarAsistencia}
            className="w-full bg-padel-green hover:bg-[#b8e600] text-deep-onyx font-black text-lg py-2 rounded-lg transition-all cursor-pointer uppercase"
          >
            Actualizar Gráfico
          </button>
        </div>
      )}

      {/* GRÁFICO */}
      <div className="bg-[#141619] rounded-xl h-56 flex flex-col justify-end p-4 border border-gray-800/50">
        {/* BARRAS */}
        <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2 border-b border-gray-800 border-dashed">
          {Object.entries(asistencia).map(([dia, cantidad]) => {
            // Porcentaje de altura respecto
            // al día con mayor asistencia
            const porcentajeAltura = Math.round(
              (cantidad / maxAsistencia) * 100,
            );

            return (
              <div
                key={dia}
                className="flex-1 flex flex-col items-center h-full justify-end group"
              >
                {/* CANTIDAD */}
                <span className="text-[10px] font-extrabold text-padel-green opacity-80 group-hover:opacity-100 transition-opacity mb-1">
                  {cantidad}
                </span>

                {/* BARRA */}
                <div
                  style={{
                    height: `${porcentajeAltura}%`,
                  }}
                  className="w-full max-w-7 bg-padel-green/80 group-hover:bg-padel-green rounded-t-md transition-all duration-300"
                />
              </div>
            );
          })}
        </div>

        {/* DÍAS */}
        <div className="flex justify-between text-[11px] font-bold text-gray-500 pt-3 px-2">
          {Object.keys(asistencia).map((dia) => (
            <span key={dia} className="flex-1 text-center">
              {dia}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
