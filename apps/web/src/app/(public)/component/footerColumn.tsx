import Link from "next/link";

//defino los datos que se veran reflejados en footer

// Estructura de cada sub-enlace individual
interface FooterLink {
  label: string;
  href: string;
}
// Estructura de cada columna del footer
interface FooterColumnProps {
  title: string;
  links: FooterLink[];
}

// Componente para una sola columna del Footer
export default function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div className="flex flex-col gap-4">
      <h5 className="text-lg font-bold text-text-dark-main tracking-tight">
        {title}
      </h5>
      {/* Lista de enlaces internos */}
      <nav className="flex flex-col gap-2.5">
        {links.map((link, index) => (
          <Link
            key={index}
            href={link.href}
            className="text-sm text-text-dark-muted hover:text-padel-green transition-colors w-fit"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
