/* Este archivo es la Server Action de Login en Next.js (App Router). Su función principal es procesar los datos del formulario directamente en el servidor, validar la entrada, comunicarse con el backend/API, crear la cookie de sesión y devolver una respuesta estructurada al cliente.*/

"use server";

import { ApiError } from "@/services/api/client";
import { login } from "@/services/auth/login";
import { createSession } from "@/lib/session";
import type { LoginFormState } from "./state";

// `invalid_credentials` es el mismo code tanto si el email no existe como si
// la contraseña está mal — a propósito, no lo distinguimos en la UI.
const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  account_suspended: "Tu cuenta está suspendida. Escribinos para reactivarla.",
  too_many_requests: "Demasiados intentos. Esperá un minuto y probá de nuevo.",
  validation: "Revisá los datos ingresados.",
};

// Server Action del form de login: valida, llama a la API y si el login
// sale bien deja la sesión creada antes de devolver el estado.
export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    email.trim() === "" ||
    typeof password !== "string" ||
    password === ""
  ) {
    return { status: "error", message: "Completá tu email y tu contraseña." };
  }

  try {
    const result = await login({ email, password });
    await createSession(result.accessToken, result.expiresIn);
    return { status: "success", message: "" };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        status: "error",
        message:
          ERROR_COPY[error.body.code] ??
          "No pudimos iniciar sesión. Intentá de nuevo en unos minutos.",
      };
    }
    return {
      status: "error",
      message: "No pudimos conectar con el servidor. Intentá de nuevo.",
    };
  }
}
