"use client";

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
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 text-write px-5 py-3.5 rounded-2xl shadow-2xl border border-white transition-all duration-300 animate-in fade-in slide-in-from-top-4 pointer-events-none">
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
      </div>
      <div>
        <p className={`font-bold text-sm ${messageColors[type]}`}>{message}</p>
        {subMessage && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
}
