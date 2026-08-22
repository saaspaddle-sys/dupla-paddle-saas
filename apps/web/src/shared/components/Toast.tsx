"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  subMessage?: string;
  type?: "success" | "error" | "info";
}

export default function Toast({
  message,
  subMessage,
  type = "success",
}: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  const bgColors = {
    success: "bg-emerald-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
  };

  const messageColors = {
    success: "text-emerald-600",
    error: "text-red-600",
    info: "text-blue-600",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 min-w-72 max-w-[calc(100vw-2rem)] bg-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-200 transition-all duration-300 animate-in fade-in slide-in-from-top-4 pointer-events-auto"
    >
      <div
        className={`${bgColors[type]} p-2 rounded-xl flex items-center justify-center shrink-0`}
      >
        {type === "success" && (
          <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === "error" && (
          <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 001.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === "info" && (
          <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9 8a1 1 0 112 0v5a1 1 0 11-2 0V8zm1-4a1 1 0 100 2 1 1 0 000-2z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-bold text-sm ${messageColors[type]}`}>{message}</p>
        {subMessage && (
          <p className="text-xs text-gray-500">
            {subMessage}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={() => setVisible(false)}
        className="shrink-0 text-gray-400 hover:text-gray-700"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
