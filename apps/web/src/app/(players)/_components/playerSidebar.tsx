'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SidebarCertificadosItem from './sidebarCertificadosItem';

export default function PlayerSidebar() {
    const pathname = usePathname();
    const isCertificadosRoute = pathname.startsWith('/certificados');
    const [isCertificadosOpen, setIsCertificadosOpen] = useState(isCertificadosRoute);

    useEffect(() => {
        setIsCertificadosOpen(isCertificadosRoute);
    }, [isCertificadosRoute]);

    // Rutas de navegación del panel de jugador
    const menuItems = [
        {
            nombre: 'Mi Panel',
            ruta: '/player-dashboard',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
        },
        {
            nombre: 'Inscripciones',
            ruta: '/inscription',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            nombre: 'Parejas',
            ruta: '/couples',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9.16006 10.87C9.06006 10.86 8.94006 10.86 8.83006 10.87C6.45006 10.79 4.56006 8.84 4.56006 6.44C4.56006 3.99 6.54006 2 9.00006 2C11.4501 2 13.4401 3.99 13.4401 6.44C13.4301 8.84 11.5401 10.79 9.16006 10.87Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M16.41 4C18.35 4 19.91 5.57 19.91 7.5C19.91 9.39 18.41 10.93 16.54 11C16.46 10.99 16.37 10.99 16.28 11" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M4.15997 14.56C1.73997 16.18 1.73997 18.82 4.15997 20.43C6.90997 22.27 11.42 22.27 14.17 20.43C16.59 18.81 16.59 16.17 14.17 14.56C11.43 12.73 6.91997 12.73 4.15997 14.56Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M18.3401 20C19.0601 19.85 19.7401 19.56 20.3001 19.13C21.8601 17.96 21.8601 16.03 20.3001 14.86C19.7501 14.44 19.0801 14.16 18.3701 14" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>

            ),
        },
        {
            nombre: 'Certificados',
            ruta: '/certificados',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 25 24">
                    <path id="Health" d="M24.400,14.900 C22.006,14.894 19.611,14.901 17.217,14.891 C16.991,14.890 16.882,14.959 16.786,15.157 C16.353,16.048 15.900,16.930 15.459,17.818 C15.353,18.031 15.225,18.222 14.959,18.195 C14.693,18.167 14.606,17.951 14.546,17.724 C14.002,15.660 13.457,13.595 12.912,11.531 C12.891,11.452 12.863,11.375 12.818,11.230 C12.745,11.389 12.699,11.487 12.656,11.586 C12.068,12.946 11.481,14.306 10.893,15.667 C10.876,15.706 10.869,15.756 10.840,15.783 C10.716,15.903 10.602,16.072 10.453,16.116 C10.254,16.175 10.105,16.013 9.998,15.842 C9.618,15.235 9.235,14.629 8.854,14.023 C8.675,13.739 8.495,13.454 8.297,13.140 C8.227,13.220 8.165,13.285 8.109,13.355 C7.761,13.786 7.411,14.213 7.070,14.649 C6.936,14.822 6.769,14.897 6.556,14.897 C4.535,14.896 2.513,14.895 0.491,14.900 C0.249,14.900 0.114,14.768 -0.000,14.586 C-0.000,14.517 -0.000,14.448 -0.000,14.379 C0.133,14.124 0.354,14.063 0.627,14.064 C2.493,14.071 4.359,14.066 6.225,14.073 C6.398,14.073 6.511,14.024 6.618,13.888 C7.044,13.343 7.481,12.807 7.916,12.269 C8.211,11.904 8.512,11.919 8.762,12.314 C9.229,13.051 9.691,13.790 10.156,14.528 C10.211,14.614 10.268,14.699 10.347,14.820 C10.417,14.665 10.472,14.543 10.526,14.419 C11.165,12.940 11.804,11.460 12.442,9.980 C12.453,9.957 12.463,9.933 12.472,9.909 C12.551,9.689 12.686,9.516 12.938,9.528 C13.207,9.541 13.304,9.749 13.364,9.980 C13.489,10.464 13.621,10.946 13.748,11.429 C14.188,13.094 14.627,14.760 15.067,16.426 C15.079,16.473 15.101,16.517 15.133,16.603 C15.451,15.970 15.753,15.372 16.054,14.772 C16.105,14.672 16.162,14.575 16.204,14.471 C16.324,14.180 16.533,14.064 16.853,14.065 C19.387,14.072 21.922,14.072 24.457,14.065 C24.717,14.064 24.879,14.172 25.000,14.379 C25.000,14.448 25.000,14.517 25.000,14.586 C24.873,14.829 24.667,14.901 24.400,14.900 zM23.665,10.204 C23.347,10.929 22.978,11.633 22.623,12.343 C22.502,12.585 22.275,12.677 22.069,12.588 C21.841,12.489 21.764,12.265 21.871,12.000 C21.896,11.935 21.932,11.876 21.962,11.814 C22.280,11.163 22.612,10.519 22.912,9.860 C23.363,8.870 23.380,7.824 23.284,6.764 C23.169,5.489 22.894,4.260 22.228,3.148 C21.460,1.865 20.375,1.011 18.840,0.848 C17.535,0.710 16.391,1.134 15.394,1.950 C13.994,3.097 13.300,4.638 12.970,6.371 C12.951,6.472 12.939,6.576 12.911,6.675 C12.854,6.875 12.728,7.010 12.507,7.015 C12.283,7.021 12.151,6.887 12.096,6.689 C12.043,6.499 12.021,6.300 11.979,6.106 C11.621,4.472 10.924,3.026 9.598,1.942 C7.945,0.589 5.677,0.376 3.951,1.762 C3.175,2.385 2.636,3.187 2.306,4.110 C1.634,5.985 1.410,7.900 1.988,9.843 C2.196,10.543 2.500,11.213 2.743,11.904 C2.797,12.056 2.823,12.252 2.771,12.395 C2.734,12.498 2.534,12.621 2.428,12.604 C2.283,12.579 2.100,12.460 2.037,12.331 C1.840,11.930 1.695,11.504 1.524,11.090 C0.862,9.486 0.695,7.826 0.941,6.118 C1.177,4.477 1.668,2.937 2.822,1.689 C3.986,0.431 5.433,-0.163 7.162,0.033 C8.987,0.241 10.345,1.219 11.400,2.660 C11.841,3.262 12.172,3.924 12.422,4.627 C12.438,4.672 12.460,4.714 12.480,4.759 C12.736,4.238 12.954,3.715 13.238,3.230 C14.064,1.819 15.209,0.766 16.796,0.252 C18.965,-0.450 21.247,0.318 22.578,2.163 C23.368,3.261 23.806,4.490 24.006,5.810 C24.162,6.844 24.268,7.886 24.057,8.923 C23.968,9.359 23.844,9.797 23.665,10.204 zM4.692,16.033 C4.893,15.934 5.072,15.998 5.269,16.240 C5.658,16.714 6.032,17.202 6.438,17.662 C8.184,19.640 10.143,21.388 12.285,22.933 C12.341,22.973 12.400,23.010 12.490,23.070 C12.891,22.731 13.305,22.395 13.703,22.042 C15.703,20.272 17.559,18.366 19.200,16.258 C19.276,16.161 19.385,16.050 19.495,16.029 C19.619,16.006 19.800,16.038 19.885,16.118 C19.971,16.200 20.001,16.374 19.996,16.505 C19.992,16.603 19.904,16.705 19.836,16.792 C17.788,19.400 15.456,21.731 12.876,23.819 C12.791,23.887 12.695,23.943 12.604,24.005 C12.535,24.005 12.466,24.005 12.396,24.005 C11.282,23.146 10.139,22.321 9.063,21.417 C7.409,20.028 5.924,18.469 4.613,16.752 C4.385,16.454 4.416,16.170 4.692,16.033 z" />
                </svg>
            ),
        },
        {
            nombre: 'Mi perfil',
            ruta: '/perfil',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 50 50"><path d="M25,1A24,24,0,1,0,49,25,24,24,0,0,0,25,1Zm0,46A22,22,0,1,1,47,25,22,22,0,0,1,25,47Z" /><path d="M25,25.41a13,13,0,0,0-13,13,1,1,0,0,0,2,0,11,11,0,1,1,22,0,1,1,0,0,0,2,0A13,13,0,0,0,25,25.41Z" /><path d="M25,23.71a7,7,0,0,0,6.81-7.2A7,7,0,0,0,25,9.3a7,7,0,0,0-6.81,7.21A7,7,0,0,0,25,23.71ZM25,11.3a5,5,0,0,1,4.81,5.21A5,5,0,0,1,25,21.71a5,5,0,0,1-4.81-5.2A5,5,0,0,1,25,11.3Z" /></svg>
            ),
        },
    ];

    return (
        <aside className="w-64 bg-deep-onyx text-white min-h-screen flex flex-col justify-between p-5 border-r border-gray-800">
            <div className="space-y-8">

                {/* Identificador / Logo de la App */}
                <div className="px-2 pt-2">
                    <Link href="/" className="text-2xl font-black text-padel-green tracking-wider block">
                        Duppla
                    </Link>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">
                        Portal Jugadores
                    </span>
                </div>

                {/* Links del Menú */}
                <nav className="space-y-1.5">
                    {menuItems.map((item) => {
                        if (item.ruta === '/certificados') {
                            return (
                                <SidebarCertificadosItem
                                    key={item.ruta}
                                    isOpen={isCertificadosOpen}
                                    onSelect={() => setIsCertificadosOpen(true)}
                                    onToggle={() => setIsCertificadosOpen((prev) => !prev)}
                                />
                            );
                        }

                        const estaActivo = !isCertificadosOpen && pathname === item.ruta;

                        return (
                            <Link
                                key={item.ruta}
                                href={item.ruta}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-extrabold text-xs transition-all ${estaActivo
                                    ? 'bg-padel-green text-deep-onyx shadow-md'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
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
                    onClick={() => {
                        // Lógica para cerrar sesión
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
}