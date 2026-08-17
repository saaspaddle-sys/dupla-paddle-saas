# Cómo conectar el login al backend

Guía de implementación para cablear el `LoginModal` existente a `POST /auth/login` y `GET /auth/me`. El lado de la API ya está hecho y mergeado; esto describe el trabajo que falta en `apps/web`. Es una guía, no un contrato — el contrato real sale de `docs/api-conventions.md` y del código de `apps/api/src/auth/`.

## Decisión de arquitectura (ya tomada, no rediscutir)

Detalle completo en `docs/decisions.md`, entrada "Login (API)" (2026-08-17). Lo que importa para el frontend:

1. **Patrón BFF.** La API nunca pone una cookie ni sabe de CORS: `POST /auth/login` devuelve el JWT bearer puro en el body. Es **una Server Action de Next**, corriendo en el servidor de `apps/web`, la que recibe ese token y lo guarda como cookie `httpOnly` del origen de web (`:3001` en dev). El JS del browser nunca ve el token.
2. **Un solo access token, 7 días, sin refresh.** No hay tabla de sesiones ni endpoint de refresh — no lo implementes.
3. **Sin `zod` ni ninguna lib de validación nueva.** El repo no tiene ninguna hoy; la validación autoritativa la hace el `ValidationPipe` de la API. Del lado del cliente alcanza con chequear que los campos no estén vacíos.

## El contrato (ya implementado en `apps/api`)

### `POST /auth/login`

Sin auth, con rate limit (5 intentos/min por IP).

```
Request:  { email: string, password: string }
200:      { accessToken: string, tokenType: 'Bearer', expiresIn: number }  // expiresIn en segundos
401:      { statusCode, code: 'invalid_credentials', message, details: null }
403:      { statusCode, code: 'account_suspended', message, details: null }
400:      { statusCode, code: 'validation', message, details: [...] }
429:      { statusCode, code: 'too_many_requests', message, details: null }
```

`invalid_credentials` es **idéntico** (mismo `code`, mismo `message`) para "el email no existe" y para "la contraseña está mal" — a propósito, no lo distingas en la UI ni intentes inferir cuál fue.

### `GET /auth/me`

Requiere `Authorization: Bearer <token>`.

```
200: { id: string, email: string, player: { id, firstName, lastName, category, gender } | null }
401: { statusCode, code: 'unauthenticated', message, details: null }
```

`player: null` significa que esa cuenta no tiene un perfil de jugador vinculado (va a pasar, por ejemplo, con el staff de un club cuando exista esa parte). Nunca esperes `dni` ni `passwordHash` en la respuesta — la API no los expone en ningún endpoint.

El shape de error de los 4xx es siempre `{ statusCode, code, message, details }` (`docs/decisions.md`, "Shape de error uniforme de la API") — `code` es lo que mapeás a copy en español, `message` es texto en inglés para debug, nunca lo muestres al usuario (`API.md`).

## Pasos

### 1. Variable de entorno

`apps/web/.gitignore` ignora `.env*`. Agregá la negación y el archivo de ejemplo:

```diff
 # env files (can opt-in for committing if needed)
 .env*
+!.env.local.example
```

```env
# apps/web/.env.local.example
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

Con un default en código (`http://localhost:3000`) no hace falta que nadie configure nada para levantar en dev.

### 2. Capa `services/` (todavía no existe — la crea esta feature)

`apps/web/docs/API.md` la exige: las llamadas HTTP se centralizan ahí, ningún componente hace `fetch` directo.

`src/services/api-client.ts` — fetch wrapper que traduce el shape de error de la API a una excepción tipada:

```ts
const DEFAULT_API_BASE_URL = "http://localhost:3000";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.statusCode = body.statusCode;
    this.details = body.details;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, token } = options;

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store", // depende de la sesión, nunca cachear
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(payload)) throw new ApiError(payload);
    throw new ApiError({
      statusCode: response.status,
      code: "unknown_error",
      message: "unexpected error calling the API",
      details: null,
    });
  }

  return payload as T;
}
```

`src/services/auth.ts`:

```ts
import { apiFetch } from "./api-client";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export function login(credentials: LoginCredentials): Promise<LoginResult> {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export interface CurrentUserPlayer {
  id: string;
  firstName: string;
  lastName: string;
  category: string | null;
  gender: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  player: CurrentUserPlayer | null;
}

export function getCurrentUser(token: string): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me", { token });
}
```

### 3. Sesión — `src/lib/session.ts`

`import "server-only"` (agregá el paquete: `pnpm --filter web add server-only`) para garantizar que esto nunca se bundlee al cliente. Usa `cookies()` de `next/headers`, que en Next 16 es **async** — mirá `node_modules/next/dist/docs/01-app/02-guides/authentication.md` antes de tocar esto, tiene el patrón de referencia completo (sesión, DAL, Server Actions).

```ts
import "server-only";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "session";

export async function createSession(
  accessToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // `true` fijo rompe en http://localhost
    sameSite: "lax",
    path: "/",
    maxAge: expiresInSeconds,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
```

`getSessionToken` es lo que van a usar los Server Components que necesiten mandar `Authorization: Bearer` a la API (paneles privados, cuando existan).

### 4. Server Action de login — `src/app/(auth)/login/actions.ts`

```ts
"use server";

import { createSession } from "@/lib/session";
import { ApiError } from "@/services/api-client";
import { login } from "@/services/auth";
import { loginErrorCopy } from "./error-copy";

export interface LoginState {
  ok: boolean;
  error: string | null;
}

export const initialLoginState: LoginState = { ok: false, error: null };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    email.trim() === "" ||
    typeof password !== "string" ||
    password === ""
  ) {
    return { ok: false, error: "Completá tu email y tu contraseña." };
  }

  try {
    const result = await login({ email, password });
    await createSession(result.accessToken, result.expiresIn);
    return { ok: true, error: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: loginErrorCopy(error.code) };
    }
    return { ok: false, error: loginErrorCopy("unknown_error") };
  }
}
```

### 5. Copy de errores — `src/app/(auth)/login/error-copy.ts`

Mapeá `code` (nunca `message`) a español:

```ts
const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  account_suspended: "Tu cuenta está suspendida. Escribinos para reactivarla.",
  too_many_requests: "Demasiados intentos. Esperá un minuto y probá de nuevo.",
  validation: "Revisá los datos ingresados.",
};

const FALLBACK_COPY =
  "No pudimos iniciar sesión. Intentá de nuevo en unos minutos.";

export function loginErrorCopy(code: string): string {
  return ERROR_COPY[code] ?? FALLBACK_COPY;
}
```

### 6. Cablear `LoginModal` (`(auth)/login/component/loginModal.tsx`)

El modal ya existe con toda la UI (backdrop, cierre por Escape, bloqueo de scroll, toggle de ver contraseña) — no la rehagas, solo cablealo:

- `const [state, formAction, pending] = useActionState(loginAction, initialLoginState);` y `<form action={formAction}>` en vez de `<form>` sola.
- Agregar `name="email"` / `name="password"` a los inputs — hoy no los tienen, así que el `FormData` llegaría vacío.
- `id` en cada input + `htmlFor` en su `<label>` (hoy no están asociados). Cambiar el label "Usuario" por "Email" — el input ya es `type="email"`.
- Mostrar `state.error` (un `<p role="alert">` alcanza) y deshacer el botón con `pending` (`disabled={pending}`, texto "Ingresando…").
- `useRouter` de `next/navigation` + un `useEffect` sobre `state.ok`: si es `true`, `onClose()` y `router.refresh()` — así la página relee la cookie recién puesta.

No hace falta un componente nuevo ni tocar el resto del archivo.

## Verificación

```bash
pnpm --filter web run lint
pnpm --filter web run build
```

A mano, con `pnpm run start:dev` (API) y `pnpm run dev:web` corriendo:

1. Registrar un jugador de prueba: `POST http://localhost:3000/auth/register` (Swagger en `/docs`, o `curl`).
2. `http://localhost:3001`, botón "Iniciar Sesión" → credenciales malas: el modal muestra el error sin recargar la página. Credenciales buenas: el modal se cierra.
3. DevTools → Application → Cookies de `localhost:3001`: tiene que existir `session`, con `HttpOnly` tildado y vencimiento a 7 días.

## Fuera de alcance de esta tarea

- **Estado de sesión en el header** ("Iniciar Sesión" vs. nombre del usuario + "Cerrar sesión"). Sin esto no hay forma de cerrar sesión desde la UI — conviene que sea la tarea inmediatamente siguiente, no algo que se demore.
- **`proxy.ts` / guard de rutas privadas.** Hoy no hay ninguna ruta privada real (`/admin` es un placeholder estático sin datos), así que no hay nada concreto que proteger todavía.
- **Conectar el registro** (`/register`) a `POST /auth/register`. Distinto de esta tarea, mismo patrón de capa `services/`.
