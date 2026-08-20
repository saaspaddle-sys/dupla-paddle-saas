"use server";

import { ApiError, type FieldError } from "@/services/api/client";
import {
  registerPlayer,
  type DominantHand,
  type Gender,
} from "@/services/players/register";

export interface RegisterFormState {
  status: "idle" | "success" | "error";
  message: string;
  // Errores por campo, con la clave del form (igual a la del DTO).
  fieldErrors: Record<string, string[]>;
  outcome?: "created" | "claimed";
  // Lo tipeado, para rehidratar el form tras un error. Nunca el password.
  values?: Record<string, string>;
}

const SUCCESS_COPY: Record<"created" | "claimed", string> = {
  created: "¡Cuenta creada! Ya podés iniciar sesión.",
  claimed:
    "Encontramos un perfil cargado por un club con tu DNI y lo vinculamos a tu cuenta nueva.",
};

const ERROR_COPY: Record<string, string> = {
  email_registered: "Ya existe una cuenta con ese e-mail.",
  dni_has_account: "Ese DNI ya tiene una cuenta asociada.",
  validation: "Revisá los campos marcados.",
};

export async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  try {
    const response = await registerPlayer(toPayload(formData));
    return {
      status: "success",
      message: SUCCESS_COPY[response.outcome],
      fieldErrors: {},
      outcome: response.outcome,
    };
  } catch (error) {
    return toErrorState(error, formData);
  }
}

function toPayload(formData: FormData) {
  const phoneNumber = optional(formData, "phone");
  const emergencyNumber = optional(formData, "emergencyPhone");

  return {
    email: required(formData, "email"),
    password: required(formData, "password"),
    dni: required(formData, "dni"),
    firstName: required(formData, "firstName"),
    lastName: required(formData, "lastName"),
    gender: optional(formData, "gender") as Gender | undefined,
    birthDate: optional(formData, "birthDate"),
    category: optional(formData, "category"),
    dominantHand: optional(formData, "dominantHand") as
      DominantHand | undefined,
    country: optional(formData, "country"),
    province: optional(formData, "province"),
    // La API guarda un solo string E.164; el form lo parte en dos controles.
    phone: phoneNumber && optional(formData, "phoneCode") + phoneNumber,
    emergencyPhone:
      emergencyNumber &&
      optional(formData, "emergencyPhoneCode") + emergencyNumber,
  };
}

function required(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required field: ${key}`);
  }
  return value;
}

// Un campo opcional vacío se omite, no se manda como "". El @IsOptional()
// de la API solo saltea `undefined` y `null`.
function optional(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value;
}

function toErrorState(error: unknown, formData: FormData): RegisterFormState {
  const values = valuesFromFormData(formData);

  if (error instanceof ApiError) {
    const fieldErrors: Record<string, string[]> = {};
    if (Array.isArray(error.body.details)) {
      for (const fieldError of error.body.details as FieldError[]) {
        fieldErrors[fieldError.field] = fieldError.messages;
      }
    }
    return {
      status: "error",
      message:
        ERROR_COPY[error.body.code] ??
        "No pudimos completar el registro. Intentá de nuevo.",
      fieldErrors,
      values,
    };
  }

  return {
    status: "error",
    message: "No pudimos conectar con el servidor. Intentá de nuevo.",
    fieldErrors: {},
    values,
  };
}

function valuesFromFormData(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "password" || typeof value !== "string") {
      continue;
    }
    values[key] = value;
  }
  return values;
}
