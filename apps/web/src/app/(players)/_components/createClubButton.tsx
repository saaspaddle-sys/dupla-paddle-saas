import Link from "next/link";

interface CreateClubButtonProps {
  hasClub: boolean;
}

export default function CreateClubButton({ hasClub }: CreateClubButtonProps) {
  return (
    <div className="mt-auto pt-4">
      <Link
        className="w-full flex items-center justify-center gap-2 bg-padel-green hover:bg-[#b8e600] text-deep-onyx text-sm font-black py-3 px-4 rounded-2xl shadow-md transition-all cursor-pointer mb-4"
        href={hasClub ? "/club-dashboard" : "/crearClub-screen"}
      >
        {/* 
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        */}
        {hasClub ? "Mi Club" : "Crear Mi Club"}
      </Link>
    </div>
  );
}
