import Link from "next/link";

// 1. Definimos la estructura de datos que necesita la tarjeta
interface CardProps {
    icon: string;
    title: string;
    description: string;
    href: string;
    linkText: string;
}

// 2. Pasamos las propiedades como argumentos al componente
export default function Card({ icon, title, description, href, linkText }: CardProps) {
    return (
        <div className="p-6 rounded-xl border-3 border-gray-800 bg-deep-onyx hover:border-padel-green transition-all group flex flex-col justify-between h-full">
            <div>
                <div className="w-12 h-12 rounded-xl bg-padel-green/10 flex items-center justify-center text-padel-green font-bold mb-4">{icon}</div>
                <h3 className="text-xl font-bold mb-2 text-text-dark-main">{title}</h3>
                <p className="text-text-dark-muted text-sm mb-4 leading-relaxed">{description}</p>
            </div>
                <Link href={href} className="text-sm font-semibold text-padel-green group-hover:underline inline-flex items-center gap-1">
                    {linkText}
                </Link>
        </div>
    )
}