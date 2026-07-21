import Link from "next/link";

interface CardProps {
  icon: string;
  title: string;
  description: string;
  href: string;
  linkText: string;
}

export default function Card({
  icon,
  title,
  description,
  href,
  linkText,
}: CardProps) {
  return (
    <div className="group flex h-full flex-col justify-between rounded-xl border-3 border-gray-800 bg-deep-onyx p-6 transition-all hover:border-padel-green">
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-padel-green/10 font-bold text-padel-green">
          {icon}
        </div>
        <h3 className="mb-2 text-xl font-bold text-text-dark-main">{title}</h3>
        <p className="mb-4 text-sm leading-relaxed text-text-dark-muted">
          {description}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-semibold text-padel-green group-hover:underline"
      >
        {linkText}
      </Link>
    </div>
  );
}
