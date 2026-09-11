"use client";

import { useActionState, useEffect } from "react";
import { createClubAction } from "../crearClub-screen/actions";
import { initialCreateClubState } from "../crearClub-screen/state";

interface ModalFormCreateClubProps {
  isOpen: boolean;
  planName: string | null;
  onClose: () => void;
}

// Modal del form de creación de club. `planName` es solo copy: `POST
// /clubs` no lo recibe, todo club nace `free` y el upgrade a un plan pago
// se activa a mano (docs/decisions.md, 2026-09-03).
export default function ModalFormCreateClub({
  isOpen,
  planName,
  onClose,
}: ModalFormCreateClubProps) {
  const [state, formAction, pending] = useActionState(
    createClubAction,
    initialCreateClubState,
  );

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Crear mi club"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <form
        action={formAction}
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-gray-800 bg-[#141619] p-6 space-y-4"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-padel-green"
        >
          ✕
        </button>

        <p className="text-center text-xs text-padel-green font-semibold">
          Elegiste el plan <span className="underline">{planName}</span>.
        </p>

        <div className="space-y-1">
          <label
            htmlFor="club-name"
            className="text-xs font-bold text-gray-300"
          >
            Nombre del club
          </label>
          <input
            id="club-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ej: Club de Padel El Triunfo"
            className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-700 bg-[#1e2024] text-sm text-white focus:outline-none focus:border-padel-green"
          />
        </div>

        {state.status === "error" && (
          <p role="alert" className="text-xs font-medium text-red-400">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-padel-green px-4 py-3 text-xs font-bold uppercase tracking-wider text-black hover:bg-padel-green/90 disabled:opacity-60 transition-all"
        >
          {pending ? "Creando club..." : "Confirmar y crear mi club"}
        </button>
      </form>
    </div>
  );
}
