import Link from 'next/link';
import Card from './component/card';
import Footer from './component/Footer'

export default function HomePage() {

  //defino los datos que se veran reflejados en la Card
  const features = [
    {
      icon: "🏆",
      title: "Próximos Torneos",
      description: "Inscríbete a categorías desde 7ma hasta 1ra. Revisa sedes, zonas y horarios de juego.",
      href: "/torneos",
      linkText: "Ver cronograma →",
    },
    {
      icon: "🎾",
      title: "Partidos del Día",
      description: "Sigue los resultados en vivo, turnos de cancha y horarios de los complejos en tiempo real.",
      href: "/partidos",
      linkText: "Ver partidos →",
    },
    {
      icon: "📊",
      title: "Ranking General",
      description: "Revisa la tabla de posiciones actualizada, puntos acumulados y líderes de cada categoría.",
      href: "/clasificaciones",
      linkText: "Ver posiciones →",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">

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

      {/* 2. HERO SECTION (Bienvenida e Impacto) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">

        <section className="relative overflow-hidden rounded-xl bg-deep-onyx p-8 md:p-12 text-white grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* COLUMNA IZQUIERDA: Texto e Información */}
          <div className='relative z-10 flex flex-col gap-4 items-center text-left'>
            <div
              className='w-28 h-28 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-gray-700 shadow-lg'
              style={{
                backgroundImage: "url('/assets/logos/logo.png')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <p className="text-3xl text-dark-main max-w-2xl leading-relaxed">
              Plataforma integral para complejos de pádel. Reserva canchas, organiza ligas, automatiza fixtures y sigue tus estadísticas en tiempo real.
            </p>
          </div>

          {/* COLUMNA DERECHA: Imagen de fondo */}
          <div className='relative z-10 w-full'>
            <div className='w-full aspect-video md:aspect-square rounded-lg' style={{
              backgroundImage: "url('/assets/images/background-principal.png')",
              //agregamos stilos css basicos para que se vea bien
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}></div>
          </div>
        </section>



        <div className="text-center max-w-3xl mx-auto space-y-6">

          <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight pt-4">
            Gestiona tu Club o Compite en los mejores Torneos
          </h3>

          <div className="pt-1 flex flex-wrap justify-center gap-4">
            <Link
              href="/login?role=club"
              className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] font-medium rounded-xl shadow-md hover:opacity-90 transition-all"
            >
              Registrar mi Club
            </Link>
            <Link
              href="/torneos"
              className="px-6 py-3 border border-gray-300 dark:border-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:bg-padel-green transition-all"
            >
              Buscar Torneos Activos
            </Link>
          </div>

        </div>

        {/* 3. SECCIÓN DE ACCESOS RÁPIDOS CARD (Dashboard Público) */}
        <section className="max-w-7xl mx-auto mt-6 ">
          <div className="grid grid-cols-1 md:grid-cols-3 rounded-2xl gap-6 ">
            {features.map((item, index) => (
              <Card
                key={index}
                icon={item.icon}
                title={item.title}
                description={item.description}
                href={item.href}
                linkText={item.linkText}
              />
            ))}
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  );
}