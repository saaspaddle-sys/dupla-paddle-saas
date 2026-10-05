"use client";

import { useState, useTransition } from "react";
import type { Subscription } from "@/services/subscriptions/subscriptions";
import {
  startCheckoutAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from "@/services/subscriptions/subscription-actions";
import { UpgradeModal } from "./UpgradeModal";
import { DowngradeModal } from "./DowngradeModal";

interface Props {
  initialSubscription: Subscription;
}

export function SubscriptionManager({ initialSubscription }: Props) {
  const [subscription, setSubscription] =
    useState<Subscription>(initialSubscription);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);

  const handleSelectPlan = (plan: "basic" | "pro") => {
    setError(null);
    startTransition(async () => {
      const res = await startCheckoutAction(plan);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  const handleCancel = () => {
    if (
      !confirm(
        "¿Seguro que deseas pausar la renovacion automatica de tu suscripcion? Conservaras el acceso hasta el final del ciclo pagado.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelSubscriptionAction();
      if (res?.error) {
        setError(res.error);
      } else {
        setSubscription((prev) => ({ ...prev, renewsAutomatically: false }));
      }
    });
  };

  const handleResume = () => {
    setError(null);
    startTransition(async () => {
      const res = await resumeSubscriptionAction();
      if (res?.error) {
        setError(res.error);
      } else {
        setSubscription((prev) => ({ ...prev, renewsAutomatically: true }));
      }
    });
  };

  const currentPlan = subscription.plan;
  const isCanceledOrPaused =
    !subscription.renewsAutomatically && subscription.plan !== "free";

  return (
    <div className="space-y-8 max-w-5xl">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tarjeta de estado actual */}
      <div className="bg-deep-onyx border border-padel-green rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-text-dark-main uppercase">
            Plan Vigente
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-2xl font-bold text-text-dark-muted capitalize">
              {currentPlan}
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                subscription.status === "active"
                  ? "bg-padel-green text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {subscription.status === "active"
                ? "Activo"
                : subscription.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Cuota permitida: <strong>{subscription.maxTournaments}</strong>{" "}
            torneos simultaneos.
          </p>
          {subscription.currentPeriodEndsAt && (
            <p className="text-xs text-gray-500 mt-1">
              Periodo actual hasta:{" "}
              {new Date(subscription.currentPeriodEndsAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Acciones de suscripcion activa */}
        {currentPlan !== "free" && (
          <div className="flex flex-col sm:flex-row gap-2">
            {currentPlan === "pro" && (
              <button
                type="button"
                onClick={() => setShowDowngradeModal(true)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 transition disabled:opacity-50"
              >
                Cambiar a Basic
              </button>
            )}
            {currentPlan === "basic" && (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-padel-green hover:bg-green-500 text-deep-onyx transition disabled:opacity-50"
              >
                Mejorar a Pro
              </button>
            )}
            {isCanceledOrPaused ? (
              <button
                type="button"
                onClick={handleResume}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50"
              >
                Reanudar Renovacion
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar Renovacion
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cuadricula de planes */}
      <div>
        <h3 className="text-lg font-semibold text-text-dark-main mb-4">
          Planes disponibles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan Free */}
          <div
            className={`bg-admin-panel-contraste border rounded-xl p-6 flex flex-col justify-between ${
              currentPlan === "free"
                ? "border-padel-green ring-2 ring-padel-green"
                : "border-gray-600"
            }`}
          >
            <div>
              <h4 className="text-lg font-bold text-text-dark-main">Free</h4>
              <p className="text-sm text-gray-400 mt-1">
                Para clubes que estan empezando.
              </p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-extrabold text-text-dark-main">
                  $0
                </span>
                <span className="text-sm text-text-dark-main"> /mes</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  ✓ 1 torneo simultaneo
                </li>
                <li className="flex items-center gap-2">
                  ✓ Vista publica y brackets
                </li>
              </ul>
            </div>
            {currentPlan === "free" ? (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-gray-300 text-gray-500 cursor-default"
              >
                Plan actual
              </button>
            ) : null}
          </div>

          {/* Plan Basic */}
          <div
            className={`bg-admin-panel-contraste border rounded-xl p-6 flex flex-col justify-between ${
              currentPlan === "basic"
                ? "border-padel-green ring-2 ring-padel-green"
                : "border-3 border-gray-500"
            }`}
          >
            <div>
              <h4 className="text-lg font-bold text-text-dark-main">Basic</h4>
              <p className="text-sm text-gray-400 mt-1">
                Ideal para gestion regular de torneos.
              </p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-extrabold text-text-dark-main">
                  $5.000
                </span>
                <span className="text-sm text-text-dark-main"> ARS /mes</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  ✓ Hasta 3 torneos simultaneos
                </li>
                <li className="flex items-center gap-2">✓ Soporte por email</li>
                <li className="flex items-center gap-2">
                  ✓ Gestion completa de llaves
                </li>
              </ul>
            </div>

            {currentPlan === "basic" ? (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-gray-300 text-gray-500 cursor-default"
              >
                Plan actual
              </button>
            ) : currentPlan === "free" ? (
              <button
                type="button"
                onClick={() => handleSelectPlan("basic")}
                disabled={isPending}
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-padel-green hover:bg-green-500 text-deep-onyx transition disabled:opacity-50"
              >
                {isPending ? "Conectando con Mercado Pago..." : "Elegir Basic"}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-gray-300 text-gray-500"
              >
                Incluido en Pro
              </button>
            )}
          </div>

          {/* Plan Pro */}
          <div
            className={`bg-admin-panel-contraste border rounded-xl p-6 flex flex-col justify-between ${
              currentPlan === "pro"
                ? "border-padel-green ring-2 ring-padel-green"
                : "border-3 border-gray-500"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-text-dark-main">Pro</h4>
                <span className="text-xs bg-padel-green text-emerald-800 font-medium px-2 py-0.5 rounded">
                  Recomendado
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Para clubes de alta actividad.
              </p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-extrabold text-text-dark-main">
                  $10.000
                </span>
                <span className="text-sm text-text-dark-main"> ARS /mes</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  ✓ Hasta 12 torneos simultaneos
                </li>
                <li className="flex items-center gap-2">
                  ✓ Soporte preferencial 24/7
                </li>
                <li className="flex items-center gap-2">
                  ✓ Reportes y metricas avanzadas
                </li>
              </ul>
            </div>

            {currentPlan === "pro" ? (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-gray-300 text-gray-500 cursor-default"
              >
                Plan actual
              </button>
            ) : currentPlan === "free" ? (
              <button
                type="button"
                onClick={() => handleSelectPlan("pro")}
                disabled={isPending}
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-padel-green hover:bg-green-500 text-deep-onyx transition disabled:opacity-50"
              >
                {isPending ? "Conectando con Mercado Pago..." : "Elegir Pro"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                disabled={isPending}
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-padel-green hover:bg-green-500 text-deep-onyx transition disabled:opacity-50"
              >
                {isPending ? "Procesando..." : "Mejorar a Pro"}
              </button>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
      <DowngradeModal
        isOpen={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
      />
    </div>
  );
}
