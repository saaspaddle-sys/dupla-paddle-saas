"use client";

import { useEffect, useState } from "react";

//login modal que abrira al presionar "Iniciar sesion" sobre la pantalla en la que el usuario se encuentre.

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  //efecto para desactivar modal con tecla escape, y desactivar scroll en el body mientras esta el modal abierto

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null; // si esta cerrado, no renderiza nada

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar sesion"
    >
      {/* Fondo oscuro / Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Contenedor del Modal */}
      <div className="relative z-10 w-full max-w-md p-6 bg-white dark:bg-deep-onyx rounded-2xl shadow-xl mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-padel-green"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold mb-4 text-text-dark-main">
          Iniciar Sesión
        </h2>

        <form className="space-y-4">
          <label className="text-text-dark-main">Usuario</label>
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/70 text-sm focus:outline-none focus:border-padel-green"
          />
          <label className="text-text-dark-main">Contraseña</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              className="w-full px-4 py-2.5 pr-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/70           
                            text-sm focus:outline-none focus:border-padel-green"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute inset-y-0 right-0 px-3 text-black hover:text-padel-green transition-colors"
            >
              {showPassword ? (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12c.92-2.6 2.67-4.83 4.99-6.32" />
                  <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
                  <path d="M1 1l22 22" />
                  <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-1.67 2.95" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 mt-3 bg-gray-50/80 hover:bg-padel-green text-main rounded-xl font-bold"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
