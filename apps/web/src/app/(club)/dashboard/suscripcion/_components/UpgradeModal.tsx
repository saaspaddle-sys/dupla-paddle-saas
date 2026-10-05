"use client";

import { useState, useTransition } from "react";
import {
  getUpgradeQuoteAction,
  createUpgradeAction,
} from "@/services/subscriptions/subscription-actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<"quote" | "confirm" | "loading">("quote");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    amount: string;
    recurringAmount: string;
    currency: string;
    periodEndsAt: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGetQuote = () => {
    setError(null);
    startTransition(async () => {
      const result = await getUpgradeQuoteAction();
      if ("error" in result) {
        setError(result.error);
      } else {
        setQuote(result);
        setStep("confirm");
      }
    });
  };

  const handleConfirmUpgrade = () => {
    if (!quote) return;
    setError(null);
    setStep("loading");
    startTransition(async () => {
      const result = await createUpgradeAction(quote.amount);
      if ("error" in result) {
        setError(result.error || "Ocurrió un error al procesar la mejora.");
        setStep("confirm");
      } else {
        window.location.href = result.checkoutUrl;
      }
    });
  };

  const handleClose = () => {
    setStep("quote");
    setError(null);
    setQuote(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-deep-onyx border border-padel-green rounded-xl p-6 max-w-md w-full shadow-lg">
        <h3 className="text-xl font-bold text-text-dark-main mb-4">
          Mejorar a Plan Pro
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {step === "quote" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Conoce el costo proporcional para mejorar tu plan a Pro de forma
              inmediata.
            </p>
            <button
              onClick={handleGetQuote}
              disabled={isPending}
              className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-padel-green hover:bg-green-500 text-deep-onyx transition disabled:opacity-50"
            >
              {isPending ? "Consultando..." : "Ver Cotización"}
            </button>
          </div>
        )}

        {step === "confirm" && quote && (
          <div className="space-y-4">
            <div className="bg-admin-panel-contraste rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Pago unico hoy:</span>
                <span className="text-base font-medium text-text-dark-main">
                  {quote.currency} {quote.amount}
                </span>
                <span className="text-xs text-gray-400">
                  (Diferencia cambio de Plan)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">
                  Nuevo monto mensual:
                </span>
                <span className="text-base font-medium text-text-dark-main">
                  {quote.currency} {quote.recurringAmount}
                </span>
              </div>
              <div className="border-t border-gray-600 pt-3">
                <span className="text-xs text-gray-500">
                  Válido hasta:{" "}
                  {new Date(quote.periodEndsAt).toLocaleDateString("es-AR")}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Se abrirá Mercado Pago para completar el pago de forma segura.
            </p>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 py-2.5 px-4 text-center text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpgrade}
                disabled={isPending}
                className="flex-1 py-2.5 px-4 text-center text-sm font-medium rounded-lg bg-padel-green hover:bg-green-500 text-deep-onyx transition disabled:opacity-50"
              >
                {isPending ? "Procesando..." : "Confirmar Mejora"}
              </button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-padel-green"></div>
            <p className="text-sm text-gray-400">Preparando el pago...</p>
          </div>
        )}
      </div>
    </div>
  );
}
