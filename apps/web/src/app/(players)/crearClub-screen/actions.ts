"use server";

import { redirect } from "next/navigation";
import { ApiError } from "@/services/api/client";
import { createClub } from "@/services/clubs/create-club";
import { getSessionToken } from "@/lib/session";
import type { CreateClubFormState } from "./state";

const ERROR_COPY: Record<string, string> = {
  club_limit_reached: "Tu cuenta ya tiene un club.",
  slug_taken: "No pudimos generar una URL para ese nombre, probá con otro.",
  unauthenticated: "Tu sesión expiró. Volvé a iniciar sesión.",
  too_many_requests: "Demasiados intentos. Esperá un minuto y probá de nuevo.",
  validation: "Revisá el nombre ingresado.",
};

// Server Action del form de creación de club: el plan elegido en la UI es
// solo informativo, `POST /clubs` no lo recibe — todo club nace en `free`
// y el upgrade a un plan pago se activa a mano (docs/decisions.md, 2026-09-03).
export async function createClubAction(
  _prevState: CreateClubFormState,
  formData: FormData,
): Promise<CreateClubFormState> {
  const name = formData.get("name");

  if (typeof name !== "string" || name.trim() === "") {
    return { status: "error", message: "Ingresá el nombre de tu club." };
  }

  const token = await getSessionToken();
  if (!token) {
    return { status: "error", message: ERROR_COPY.unauthenticated };
  }

  try {
    await createClub({ name }, token);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        status: "error",
        message:
          ERROR_COPY[error.body.code] ??
          "No pudimos crear el club. Intentá de nuevo en unos minutos.",
      };
    }
    return {
      status: "error",
      message: "No pudimos conectar con el servidor. Intentá de nuevo.",
    };
  }

  redirect("/dashboard-customer");
}
