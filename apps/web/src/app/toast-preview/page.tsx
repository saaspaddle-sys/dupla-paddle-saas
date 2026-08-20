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
    <div className="min-h-scree bg-(--background)n flex flex-col items-center gap-6 pt-24 bg-(--background) bg-deep-onyx">
      {/* bg-deep-onyx  Para comparar como queda*/}
      <h1 className="text-xl font-bold">Preview de Toast</h1>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => show("success")}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold"
        >
          Success
        </button>
        <button
          type="button"
          onClick={() => show("error")}
          className="px-4 py-2 rounded-xl bg-red-500 text-white font-semibold"
        >
          Error
        </button>
        <button
          type="button"
          onClick={() => show("info")}
          className="px-4 py-2 rounded-xl bg-blue-500 text-white font-semibold"
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
    </div>
  );
}
