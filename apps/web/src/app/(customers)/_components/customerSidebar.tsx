"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function MenuIcon({ children }: { children: ReactNode }) {
    return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-visible">
            <svg
                className="h-full w-full"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ overflow: "visible" }}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
            >
                {children}
            </svg>
        </span>
    );
}

export default function CustomerSidebar() {
    const pathname = usePathname();

    // Rutas de navegación del panel de jugador
    const menuItems = [
        {
            nombre: "Mi Club",
            ruta: "/dashboard-customer", // Cambiar RUTA -> mostrará resumen y métricas
            icono: (
                <MenuIcon>
                    <path d="M3 10.5 12 3l9 7.5" />
                    <path d="M5 9.5V19a1 1 0 0 0 1 1h3v-7h6v7h3a1 1 0 0 0 1-1V9.5" />
                </MenuIcon>
            ),
        },
        {
            nombre: "Mis torneos",
            ruta: "/dashboard/torneos",
            icono: (
                <MenuIcon>
                    <path d="M8 4h8l1 4H7l1-4Z" />
                    <path d="M7 8h10a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4V10a2 2 0 0 1 2-2Z" />
                    <path d="M8 21h8" />
                    <path d="M9 12h6" />
                </MenuIcon>
            ),
        },
        {
            nombre: "Mis canchas",
            ruta: "/dashboard/canchas",
            icono: (
                <MenuIcon>
                    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-11Z" />
                    <path d="M12 5v14" />
                    <path d="M4 12h16" />
                </MenuIcon>
            ),
        },
        {
            nombre: "Mis jugadores / Inscripciones",
            ruta: "/dashboard/jugadores",
            icono: (
                <MenuIcon>
                    <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path d="M3 19a5 5 0 0 1 10 0" />
                    <path d="M11 19a5 5 0 0 1 10 0" />
                </MenuIcon>
            ),
        },
        {
            nombre: "Publicidad & Sponsor",
            ruta: "/dashboard/publicidad",
            icono: (
                <MenuIcon>
                    <path d="M11 5.5v13.4a1.6 1.6 0 0 1-3.1.6l-2.1-6.2" />
                    <path d="M18 12a3 3 0 1 0 0-6" />
                    <path d="M5.9 12.8A4 4 0 0 1 8 6h1.9c3.8 0 7.1-1.1 8.6-3v14c-1.5-1.9-4.8-3-8.6-3H8a4 4 0 0 1-2.1-.2Z" />
                </MenuIcon>
            ),
        },
        {
            nombre: "Configuracion y Suscripcion",
            ruta: "/dashboard/suscripcion",
            icono: (
                <MenuIcon>
                    <path d="M12 3.5v2.2" />
                    <path d="M12 18.3v2.2" />
                    <path d="m4.93 4.93 1.56 1.56" />
                    <path d="m17.51 17.51 1.56 1.56" />
                    <path d="M3.5 12h2.2" />
                    <path d="M18.3 12h2.2" />
                    <path d="m4.93 19.07 1.56-1.56" />
                    <path d="m17.51 6.49 1.56-1.56" />
                    <path d="M12 8.3a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4Z" />
                </MenuIcon>
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
                        Portal Clubes
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
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-extrabold text-xs transition-all ${estaActivo
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
                            Club Juarense
                        </h4>
                        <p className="text-[10px] font-medium text-gray-400 truncate mt-0.5">
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        // Lógica para cerrar sesión
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-visible">
                        <svg
                            className="h-full w-full"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                            style={{ overflow: "visible" }}
                            preserveAspectRatio="xMidYMid meet"
                            aria-hidden="true"
                        >
                            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </span>
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
}
