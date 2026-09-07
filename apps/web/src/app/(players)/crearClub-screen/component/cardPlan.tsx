type Plan = {
  name: string;
  description: string;
  keys: number;
  price: string;
  badge?: string;
  features: string[];
  buttonText: string;
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    description: "Para conocer la plataforma y comenzar a organizar.",
    keys: 1,
    price: "Gratis",
    features: [
      "Creación de tu club.",
      "Organización de una categoría completa.",
      "Gestión de jugadores e inscripciones.",
      "Generación de llaves y resultados.",
      "Visualización pública del torneo.",
    ],
    buttonText: "Crear mi club gratis",
  },
  {
    name: "Basic",
    description: "Para clubes que organizan sus primeros torneos completos.",
    keys: 3,
    price: "Plan pago",
    badge: "Más elegido",
    highlighted: true,
    features: [
      "Todo lo incluido en Free.",
      "Hasta 3 llaves activas.",
      "Organización de un fin de semana de torneo.",
      "Mayor capacidad para gestionar categorías.",
      "Acceso a las funcionalidades disponibles del MVP.",
    ],
    buttonText: "Solicitar plan Basic",
  },
  {
    name: "Pro",
    description: "Para clubes que organizan torneos con mayor cantidad de categorías.",
    keys: 12,
    price: "Plan pago",
    badge: "Mayor capacidad",
    features: [
      "Todo lo incluido en Basic.",
      "Hasta 12 llaves activas.",
      "Mayor capacidad para organizar torneos.",
      "Ideal para clubes con muchas categorías.",
      "Acceso a las funcionalidades disponibles del MVP.",
    ],
    buttonText: "Solicitar plan Pro",
  },
];


interface CardPlanProps {
  onSelectPlan: (planName: string) => void;
}

export default function CardPlan({ onSelectPlan }: CardPlanProps) {
  return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 ${
                plan.highlighted
                  ? "bg-[#181a2e] border-2 border-padel-green shadow-lg shadow-padel-green/10"
                  : "bg-padel-dark border-3 border-gray-800"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-padel-green px-3 py-1 text-xs font-semibold text-text-main tracking-wider shadow-sm">
                  {plan.badge}
                </span>
              )}

              <div>
                {/* Nombre y descripción */}
                <h2 className="text-2xl font-bold text-white">
                  {plan.name}
                </h2>
                <p className="mt-2 min-h-12 text-xs text-gray-400 leading-relaxed">
                  {plan.description}
                </p>

                {/* Llaves */}
                <div className="mt-4">
                  <p className="text-4xl font-extrabold text-white">
                    {plan.keys}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-padel-green uppercase tracking-wide">
                    {plan.keys === 1 ? "llave activa" : "llaves activas"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 font-medium">
                    {plan.price}
                  </p>
                </div>

                <div className="my-6 h-px bg-gray-800" />

                {/* Beneficios */}
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-300">
                    Incluye:
                  </h3>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-xs text-gray-300"
                      >
                        <span className="text-padel-green font-bold">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Botón */}
              <button
                type="button"
                onClick={() => onSelectPlan(plan.name)}
                className={`mt-8 w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-padel-green text-black hover:bg-padel-green/90 shadow-md"
                    : "bg-[#1e2024] border border-gray-700 text-white hover:border-gray-500 hover:bg-[#25282e]"
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
  );

}