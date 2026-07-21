import Link from "next/link";
import Card from "./component/card";
import Footer from "./component/Footer";

export default function HomePage() {
  const features = [
    {
      icon: "🏆",
      title: "Proximos Torneos",
      description:
        "Inscribite a categorias desde 7ma hasta 1ra. Revisa sedes, zonas y horarios de juego.",
      href: "/torneos",
      linkText: "Ver cronograma →",
    },
    {
      icon: "🎾",
      title: "Partidos del Día",
      description:
        "Sigue los resultados en vivo, turnos de cancha y horarios de los complejos en tiempo real.",
      href: "/partidos",
      linkText: "Ver partidos →",
    },
    {
      icon: "📊",
      title: "Ranking General",
      description:
        "Revisa la tabla de posiciones actualizada, puntos acumulados y lideres de cada categoria.",
      href: "/clasificaciones",
      linkText: "Ver posiciones →",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <header className="sticky top-0 z-50 border-b bg-deep-onyx backdrop-blur dark:border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-padel-green">
              Pádel<span className="text-[var(--background)]">SAAS</span>
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link
              href="/torneos"
              className="text-text-dark-muted transition-colors hover:text-padel-green"
            >
              Torneos
            </Link>
            <Link
              href="/players"
              className="text-text-dark-muted transition-colors hover:text-padel-green"
            >
              Jugadores
            </Link>
            <Link
              href="/partidos"
              className="text-text-dark-muted transition-colors hover:text-padel-green"
            >
              Partidos en Vivo
            </Link>
            <Link
              href="/clasificaciones"
              className="text-text-dark-muted transition-colors hover:text-padel-green"
            >
              Ranking
            </Link>
            <Link
              href="/sedes"
              className="text-text-dark-muted transition-colors hover:text-padel-green"
            >
              Sedes
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-text-dark-muted transition-colors hover:text-padel-green"
            >
              Iniciar Sesion
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-padel-green px-4 py-2 text-sm font-semibold text-deep-onyx shadow-md transition-all hover:bg-opacity-90"
            >
              Registrate
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <section className="relative overflow-hidden rounded-xl bg-deep-onyx p-8 md:p-12 text-white grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/*Columna izquierda, logo e informacion */}
          <div className="relative z-10 flex flex-col items-center gap-4 text-left">
            <div
              className="h-28 w-28 overflow-hidden rounded-full border-2 border-gray-700 shadow-lg md:h-40 md:w-40"
              style={{
                backgroundImage: "url('/assets/logos/logo.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
            <p className="text-3xl text-dark-main max-w-2xl leading-relaxed">
              Plataforma integral para complejos de padel. Reserva canchas,
              organiza ligas, automatiza fixtures y sigue tus estadisticas en
              tiempo real.
            </p>
          </div>
          {/*Columna derecha, imagen de fondo */}
          <div className="relative z-10 w-full">
            <div
              className="aspect-video w-full rounded-lg md:aspect-square"
              style={{
                backgroundImage:
                  "url('/assets/images/background-principal.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
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

        <section className="mx-auto mt-6 max-w-7xl">
          <div className="grid grid-cols-1 gap-6 rounded-2xl md:grid-cols-3">
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
      <Footer />
    </div>
  );
}
