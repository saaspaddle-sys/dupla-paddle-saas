import proximosTorneos from "../data/nextTournament.json";

export default function NextTournament() {
  return (
    <div className="bg-admin-panel-contraste border border-gray-800/80 rounded-2xl p-5 md:p-6">
      <h3 className="text-base font-bold text-white mb-4">Próximos Torneos</h3>
      <div className="space-y-3">
        {proximosTorneos.map((item, idx) => (
          <div
            key={idx}
            className="bg-[#141619] border border-gray-800/80 rounded-xl p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-black text-white">{item.nombre}</h4>
              <span
                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                  item.badgeType === "green"
                    ? "bg-padel-green/20 text-padel-green border border-padel-green/40"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}
              >
                {item.badge}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
              <span className="flex items-center gap-1">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {item.fecha}
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {item.parejas}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full text-center text-xs font-black text-padel-green hover:underline mt-4 cursor-pointer block">
        VER TODOS
      </button>
    </div>
  );
}
