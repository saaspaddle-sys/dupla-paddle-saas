import "server-only";

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

// El `details` de un 400 de validación: una entrada por campo inválido.
export interface FieldError {
  field: string;
  messages: string[];
}

export class ApiError extends Error {
  constructor(readonly body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL is not set");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new ApiError(await toErrorBody(response));
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

async function toErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    // La API siempre responde las cuatro claves (AppExceptionFilter).
    return (await response.json()) as ApiErrorBody;
  } catch {
    // Si el body no es JSON, el error no lo generó la API sino algo más
    // arriba (proxy, timeout, la API caída).
    return {
      statusCode: response.status,
      code: "internal_error",
      message: response.statusText,
      details: null,
    };
  }
}
