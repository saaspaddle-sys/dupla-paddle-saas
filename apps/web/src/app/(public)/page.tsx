import Link from "next/link";
import Image from "next/image";
import Card from "./component/card";
import Header from "./component/header";
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
    <div className="min-h-screen bg-var(--background) text-var(--foreground) font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <section className="relative overflow-hidden rounded-xl bg-deep-onyx p-8 md:p-12 text-white grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/*Columna izquierda, logo e informacion */}
          <div className="relative z-10 flex flex-col items-center gap-4 text-left">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-gray-700 shadow-lg md:h-40 md:w-40">
              <Image
                src="/assets/logos/logo.webp"
                alt="Logo del club"
                fill
                sizes="(min-width: 768px) 160px, 112px"
                className="object-cover"
              />
            </div>
            <p className="text-3xl text-dark-main max-w-2xl leading-relaxed">
              Plataforma integral para complejos de padel. Reserva canchas,
              organiza ligas, automatiza fixtures y sigue tus estadisticas en
              tiempo real.
            </p>
          </div>
          {/*Columna derecha, imagen de fondo */}
          <div className="relative z-10 w-full">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg md:aspect-square">
              <Image
                src="/assets/images/background-principal.webp"
                alt="Imagen principal de la plataforma"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <div className="text-center max-w-3xl mx-auto space-y-6">
          <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight pt-4">
            Gestiona tu Club o Compite en los mejores Torneos
          </h3>

          <div className="pt-1 flex flex-wrap justify-center gap-4">
            <Link
              href="/login?role=club"
              className="px-6 py-3 bg-var(--foreground) text-var(--background) font-medium rounded-xl shadow-md hover:opacity-90 transition-all"
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
