import Link from 'next/link';
import Card from './component/card';
import Header from './component/header';

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

      <Header />

      {/* 2. HERO SECTION (Bienvenida e Impacto) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">

        <section className="relative overflow-hidden rounded-xl bg-deep-onyx p-8 md:p-12 text-white grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* COLUMNA IZQUIERDA: Texto e Información */}
          <div className='relative z-10 flex flex-col gap-4 items-center text-left'>
            <div
              className='w-28 h-28 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-gray-700 shadow-lg'
              style={{
                backgroundImage: "url('/assets/logos/logo.jpeg')",
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
              backgroundImage: "url('/assets/images/background-principal.jpg')",
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
    </div>
  );
}