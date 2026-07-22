import Link from "next/link";

export default function Header() {
    return (
        <div>
            {/* 1. NAVBAR GENERAL */}
            <header className="bg-deep-onyx border-b dark:border-gray-200 dark:border-gray-800 backdrop-blur sticky top-0 z-50 ">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold tracking-tight text-padel-green">
                            Pádel<span className="text-[var(--background)]">SAAS</span>
                        </span>
                    </div>

                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium ">
                        <Link href="/torneos" className="text-text-dark-muted hover:text-padel-green transition-colors">Torneos</Link>
                        <Link href="/players" className="text-text-dark-muted hover:text-padel-green transition-colors">Jugadores</Link>
                        <Link href="/partidos" className="text-text-dark-muted hover:text-padel-green transition-colors">Partidos en Vivo</Link>
                        <Link href="/clasificaciones" className="text-text-dark-muted hover:text-padel-green transition-colors">Ranking</Link>
                        <Link href="/sedes" className="text-text-dark-muted hover:text-padel-green transition-colors">Sedes</Link>
                    </nav>

                    <div className="flex items-center gap-4">
                        {/* 1. INICIAR SESIÓN (Texto sutil que cambia a verde al pasar el mouse) */}
                        <Link
                            href="/login"
                            className="text-text-dark-muted hover:text-padel-green text-sm font-medium px-4 py-2 transition-colors"
                        >Iniciar Sesión</Link>

                        {/* 2. REGÍSTRATE (Botón destacado: fondo verde, letras oscuras para que se lea perfecto) */}
                        <Link href="/register" className="bg-padel-green text-deep-onyx hover:bg-opacity-90 text-sm font-semibold px-4 py-2 rounded-lg shadow-md transition-all">Registrate</Link>
                    </div>
                </div>
            </header>
        </div>
    )
}