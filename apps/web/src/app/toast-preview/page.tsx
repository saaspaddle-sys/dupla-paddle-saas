"use client";
import { useState } from "react";
import Toast from "@/shared/components/Toast";

type ToastType = "success" | "error" | "info";

interface ToastConfig {
  type: ToastType;
  message: string;
  subMessage: string;
}

const PRESETS: Record<ToastType, ToastConfig> = {
  success: {
    type: "success",
    message: "¡Registro exitoso!",
    subMessage: "Te redirigiremos al inicio de sesión...",
  },
  error: {
    type: "error",
    message: "No pudimos completar el registro.",
    subMessage: "Intentá de nuevo.",
  },
  info: {
    type: "info",
    message: "Revisá tu bandeja de entrada.",
    subMessage: "Te enviamos un mail de confirmación.",
  },
};

export default function ToastPreview() {
  const [toast, setToast] = useState<ToastConfig | null>(null);

  function show(type: ToastType) {
    setToast(null);
    // Reinicia la animación de entrada aunque sea el mismo tipo de toast.
    requestAnimationFrame(() => setToast(PRESETS[type]));
  }

  return (
    <main className="min-h-screen bg-(--background) px-6 py-24">
      <section className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Componentes
          </p>
          <h1 className="mt-2 text-2xl font-bold">Preview de Toast</h1>
          <p className="mt-2 text-sm text-gray-500">
            Probá cada estado y el botón de cierre o esperá el auto-dismiss.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => show("success")}
            className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
          >
            Success
          </button>
          <button
            type="button"
            onClick={() => show("error")}
            className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
          >
            Error
          </button>
          <button
            type="button"
            onClick={() => show("info")}
            className="rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600"
          >
            Info
          </button>
        </div>

        {toast && (
          <Toast
            message={toast.message}
            subMessage={toast.subMessage}
            type={toast.type}
          />
        )}
      </section>
    </main>
  );
}
