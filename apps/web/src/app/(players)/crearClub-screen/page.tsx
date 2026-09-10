"use client";

import { useState } from "react";
import CardPlan from "./component/cardPlan";
import ModalFormCreateClub from "../_components/modalFormCreateClub";

export default function ClubPlans() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = (planName: string) => {
    setSelectedPlan(planName);
  };

  return (
    /* flex-1 w-full min-h-full fuerza al contenedor a rellenar todo el área del dashboard */
    <div className="flex-1 w-full min-h-full bg-deep-onyx px-4 py-8 sm:px-6 lg:px-8 text-white">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Encabezado */}
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Elegí el plan para tu club
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-400">
            Empezá gratis, organizá tus torneos y elegí el plan que mejor se
            adapte a tu club.
          </p>
        </div>

        {/*Tarjetas */}
        <CardPlan onSelectPlan={handleSelectPlan} />

        {/* Información importante */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-[#141619] p-5">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              El organizador paga la suscripción
            </h3>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed">
              El dueño de la cuenta es quien contrata el plan. El cobro es
              manual: la activación y la facturación se realizan por afuera de
              la plataforma.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#141619] p-5">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              Los jugadores no pagan
            </h3>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed">
              La inscripción y el acceso a la vista pública son gratuitos para
              los jugadores, tengan cuenta o no.
            </p>
          </div>
        </div>

        {/* Información para jugadores */}
        <div className="rounded-2xl border border-gray-800 bg-[#141619] p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Una experiencia gratuita para jugadores
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              Tu club organiza. Tus jugadores consultan, se registran y siguen
              sus torneos sin costo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 border-t border-gray-800 pt-4">
            <div>
              <h3 className="font-bold text-xs text-padel-green uppercase tracking-wide">
                Vista pública
              </h3>
              <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                Acceso sin login para consultar torneos, llaves y jugadores
                mediante filtros.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-xs text-padel-green uppercase tracking-wide">
                Cuenta de jugador
              </h3>
              <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                Los jugadores pueden registrarse e iniciar sesión para tener su
                perfil, pero no es obligatorio para ver la información pública.
              </p>
            </div>
          </div>
        </div>

        <ModalFormCreateClub
          isOpen={selectedPlan !== null}
          planName={selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      </div>
    </div>
  );
}
