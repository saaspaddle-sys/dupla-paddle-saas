"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { logoutAction } from "@/app/(auth)/login/logout-action";

export default function PlayerSidebar() {
  const pathname = usePathname();
  const router = useRouter(); //permite navegar despues del logout
  const [isLoggingOut, startLogout] = useTransition(); // permite ejecutar la operacion asuncrona sin bloquear la interface.Tambien proporciona isLoggingOut, que indica si el proceso esta en curso

  // Rutas de navegación del panel de jugador
  const menuItems = [
    {
      nombre: "Mi Panel",
      ruta: "/player-dashboard",
      icono: (
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
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      nombre: "Inscripciones",
      ruta: "/inscription",
      icono: (
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      nombre: "Parejas",
      ruta: "/couples",
      icono: (
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
            d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5zM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11zm0 2c-2.67 0-8 1.34-8 4v1h10m6-5c2.67 0 8 1.34 8 4v1H10"
          />
        </svg>
      ),
    },
    {
      nombre: "Mi perfil",
      ruta: "/perfil",
      icono: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 50 50"
        >
          <path d="M25,1A24,24,0,1,0,49,25,24,24,0,0,0,25,1Zm0,46A22,22,0,1,1,47,25,22,22,0,0,1,25,47Z" />
          <path d="M25,25.41a13,13,0,0,0-13,13,1,1,0,0,0,2,0,11,11,0,1,1,22,0,1,1,0,0,0,2,0A13,13,0,0,0,25,25.41Z" />
          <path d="M25,23.71a7,7,0,0,0,6.81-7.2A7,7,0,0,0,25,9.3a7,7,0,0,0-6.81,7.21A7,7,0,0,0,25,23.71ZM25,11.3a5,5,0,0,1,4.81,5.21A5,5,0,0,1,25,21.71a5,5,0,0,1-4.81-5.2A5,5,0,0,1,25,11.3Z" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-64 bg-deep-onyx text-white min-h-screen flex flex-col justify-between p-5 border-r border-gray-800">
      <div className="space-y-8">
        {/* Identificador / Logo de la App */}
        <div className="px-2 pt-2">
          <Link
            href="/"
            className="text-2xl font-black text-padel-green tracking-wider block"
          >
            Duppla
          </Link>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">
            Portal Jugadores
          </span>
        </div>

        {/* Links del Menú */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const estaActivo = pathname === item.ruta;

            return (
              <Link
                key={item.ruta}
                href={item.ruta}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-extrabold text-xs transition-all ${
                  estaActivo
                    ? "bg-padel-green text-deep-onyx shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                }`}
              >
                {item.icono}
                <span>{item.nombre}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer del Sidebar: Perfil rápido y Cerrar Sesión */}
      <div className="pt-6 border-t border-gray-800/80 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-padel-green/20 border border-padel-green/40 flex items-center justify-center text-padel-green font-black text-xs">
            JS
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-black text-white truncate leading-tight">
              Julieta Sak
            </h4>
            <p className="text-[10px] font-medium text-gray-400 truncate mt-0.5">
              4ta Damas
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isLoggingOut}
          onClick={() => {
            startLogout(async () => {
              await logoutAction(); //elimina la cookie session en el servidor
              router.replace("/"); //lleva al usuario al inicio
              router.refresh(); //fuerza a next a volver a leer los datos y cookies actuales
            });
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
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
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          {isLoggingOut ? "Cerrando Sesión…" : "Cerrar Sesión"}
        </button>
      </div>
    </aside>
  );
}
