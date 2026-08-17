# Integración del registro de jugador

Cómo conectar la pantalla `/register` con `POST /auth/register`, la primera integración real entre `apps/web` y `apps/api`.

**Este documento no define el contrato.** El contrato sale de [`docs/api-conventions.md`](../../../docs/api-conventions.md) y las decisiones de [`docs/decisions.md`](../../../docs/decisions.md); el resumen del endpoint del lado del cliente vive en [`API.md`](./API.md). Acá está el _cómo_: qué capas crear, cómo mapear el formulario que ya existe, cómo manejar los errores y qué trampas concretas tiene este endpoint.

## Punto de partida

Lo que ya está:

- **La API está lista.** `POST /auth/register` (clase _plataforma_: sin auth, sin `club_id`) crea la cuenta y el perfil, o reclama un perfil que ya había cargado un club, deduplicando por DNI. Documentada en `http://localhost:3000/docs`.
- **El formulario está armado pero muerto**: `src/app/(auth)/register/page.tsx` es un `<form>` sin `onSubmit`, sin `action` y con la mayoría de los inputs sin `name`. Nada sale del navegador.

Lo que no existe todavía y hay que crear con esta feature: la capa `services/`, el manejo de errores de API, y la variable de entorno con la base URL. Es la primera feature que necesita esa infraestructura, así que **la establece a propósito y registra la decisión en `docs/decisions.md`** (`docs/workflow.md`).

## Antes de escribir código: dos cosas a resolver

### 1. La API no tiene CORS habilitado

`apps/api/src/main.ts` no llama a `app.enableCors()`. Un `fetch` desde el navegador en `localhost:3001` hacia `localhost:3000` es cross-origin y el preflight lo va a frenar. Hay dos salidas, y **la elección es una decisión técnica que va a `docs/decisions.md` en el mismo PR**:

| Opción                                                      | Qué implica                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server Action / Route Handler** (recomendada)             | El navegador le pega a Next, y Next le pega a la API desde el servidor. No hay cross-origin, la base URL no se expone en el bundle, y la contraseña nunca viaja en un `fetch` del cliente. Es también la que sirve cuando llegue el login con cookie `httpOnly`. |
| **`app.enableCors()` en la API + `fetch` desde el cliente** | Toca `apps/api`, obliga a mantener una allowlist de orígenes por entorno, y expone la base URL en el bundle (`NEXT_PUBLIC_`).                                                                                                                                    |

El resto de este documento asume la primera.

### 2. La base URL de la API

`API.md` menciona `NEXT_PUBLIC_API_BASE_URL`. Con la llamada del lado del servidor **el prefijo `NEXT_PUBLIC_` sobra**, y sobra por una razón real: todo lo que lleva ese prefijo queda inlineado en el bundle del navegador en tiempo de build. Usá `API_BASE_URL` (sin prefijo, solo servidor) y actualizá `API.md` y `Deployment.md` en el mismo PR.

```bash
# .env de la raíz del monorepo
API_BASE_URL=http://localhost:3000
```

## Arquitectura de la integración

Cuatro piezas, cada una con una sola responsabilidad:

```text
page.tsx  ("use client")     formulario + estado de UI, vía useActionState
   ↓ FormData
actions.ts  ("use server")   FormData → payload, y error de API → copy en español
   ↓ payload tipado
services/players/register.ts contrato del endpoint (tipos de request y response)
   ↓
services/api/client.ts       fetch wrapper: base URL, headers, shape de error
   ↓
POST /auth/register
```

La regla que sostiene esto: **un componente nunca llama `fetch` directo** (`API.md`), y **la traducción de idioma vive en una sola capa**. El copy en español no baja más allá de `actions.ts`, y los valores de wire (`male`, `right`, `AR`) no suben más arriba de él.

### `src/services/api/client.ts`

```ts
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
  });

  if (!response.ok) {
    throw new ApiError(await toErrorBody(response));
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
```

Este módulo es **solo de servidor**. Si querés que el compilador lo garantice, agregá el paquete `server-only` e importalo arriba de todo; un import accidental desde un componente cliente pasa a ser error de build en vez de una fuga de la base URL al bundle.

### `src/services/players/register.ts`

Los tipos del contrato, escritos a mano por ahora. Cuando exista `packages/shared` se comparten con `apps/api` en vez de duplicarse (`docs/workflow.md`).

```ts
import { apiFetch } from "@/services/api/client";

export type Gender = "male" | "female";
export type DominantHand = "right" | "left";

export interface RegisterPlayerPayload {
  email: string;
  password: string;
  dni: string;
  firstName: string;
  lastName: string;
  gender?: Gender;
  birthDate?: string;
  category?: string;
  dominantHand?: DominantHand;
  country?: string;
  province?: string;
  phone?: string;
  emergencyPhone?: string;
}

export interface RegisterPlayerResponse {
  outcome: "created" | "claimed";
  user: { id: string; email: string };
  player: {
    id: string;
    firstName: string;
    lastName: string;
    category: string | null;
    gender: Gender | null;
    createdAt: string;
  };
}

export function registerPlayer(
  payload: RegisterPlayerPayload,
): Promise<RegisterPlayerResponse> {
  return apiFetch<RegisterPlayerResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

La respuesta **no trae `dni`, ni `passwordHash`, ni los datos de contacto del perfil**, y eso es deliberado (`docs/decisions.md`, 2026-08-17). No los agregues al tipo "por completitud".

### `src/app/(auth)/register/actions.ts`

```ts
"use server";

import { ApiError, type FieldError } from "@/services/api/client";
import { registerPlayer } from "@/services/players/register";

export interface RegisterFormState {
  status: "idle" | "success" | "error";
  message: string;
  // Errores por campo, con la clave del form (no la del DTO).
  fieldErrors: Record<string, string[]>;
  outcome?: "created" | "claimed";
  // Lo tipeado, para rehidratar el form tras un error. Nunca el password.
  values?: Record<string, string>;
}

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
```

`toPayload` y el mapeo de errores están en las dos secciones que siguen.

### `page.tsx`

El formulario es un componente cliente (ya lo es, por el `useState` del sexo), así que la action tiene que vivir en su propio archivo con `"use server"` — no se puede declarar dentro de un `"use client"`.

```tsx
"use client";
import { useActionState } from "react";
import { registerAction, type RegisterFormState } from "./actions";

const INITIAL_STATE: RegisterFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export default function Register() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} noValidate={false}>
      {/* ...campos... */}
      <p aria-live="polite">{state.message}</p>
      <button type="submit" disabled={pending}>
        {pending ? "Creando cuenta…" : "Registrarse →"}
      </button>
    </form>
  );
}
```

`pending` sale del propio hook: no hace falta un `useState` de loading, y usarlo evita el doble submit. Si el botón termina en su propio componente, `useFormStatus` de `react-dom` da lo mismo sin prop drilling.

**Ojo con un detalle de React 19**: al enviar un form con `action`, los campos no controlados se limpian. Si la API devuelve `400`, la persona vería el formulario vacío. Por eso el estado devuelve `values` y los inputs se rehidratan con `defaultValue={state.values?.email}` — todos menos el password, que se vuelve a tipear.

## Mapeo del formulario actual

El form de `/register` se diseñó antes de que existiera el contrato, así que hoy **no coincide** con lo que la API acepta. Esta tabla es la lista de cambios, no una descripción de lo que ya funciona:

| Control de hoy                        | Campo de la API           | Qué hay que cambiar                                                                                                              |
| ------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| "Nombre de usuario" (`Ej: 35123456`)  | `dni`                     | La API no tiene usuario: es el DNI. Renombrar el label y validar 7 u 8 dígitos.                                                  |
| "Contraseña (mín. 6 caracteres)"      | `password`                | El mínimo real es **8**; el máximo, 72 caracteres **y** 72 bytes UTF-8. Corregir el label — hoy promete algo que la API rechaza. |
| E-mail (placeholder `Ej: Riquelme`)   | `email`                   | `type="email"`, y arreglar el placeholder.                                                                                       |
| Nombres / Apellido                    | `firstName` / `lastName`  | 2 a 60 caracteres; solo letras (con acentos y ñ), apóstrofo, punto, guion y espacio.                                             |
| Sexo (`masculino` / `femenino`)       | `gender`                  | El `value` del `<option>` pasa a `male` / `female`; el texto visible sigue en español.                                           |
| Categoría (`caballeros primera`, …)   | `category`                | Texto libre de hasta 40 caracteres: entra tal cual.                                                                              |
| Fecha de Nacimiento                   | `birthDate`               | `<input type="date">` ya emite `YYYY-MM-DD`. No la reformatees. No puede ser futura ni de más de 120 años.                       |
| País (texto libre `Ej: Argentina`)    | `country`                 | Pasa a `<select>` que emite el **ISO 3166-1 alpha-2** (`AR`). "Argentina" da `400`.                                              |
| Provincia/Estado                      | `province`                | Texto libre de hasta 80 caracteres.                                                                                              |
| Celular (select de código + número)   | `phone`                   | Un solo string en **E.164**: concatenar código y número antes de mandar.                                                         |
| Teléfono Emergencia                   | `emergencyPhone`          | También E.164, y hoy **no tiene selector de código de país**. Sin él, cualquier valor da `400`: falta agregarlo.                 |
| Brazo hábil (`derecho` / `izquierdo`) | `dominantHand`            | El `value` pasa a `right` / `left`.                                                                                              |
| Posición habitual                     | — **no existe en la API** | Ver abajo.                                                                                                                       |

### Campos que la API no conoce

El `ValidationPipe` corre con `forbidNonWhitelisted: true`: una clave de más no se ignora, **rechaza el request entero** con `400 validation` y el mensaje `property 'posicionHabitual' is not allowed`. Así que `posicionHabitual` tiene dos caminos, y ninguno es mandarlo igual: se deja fuera del payload (queda como UI sin persistir), o se pide el campo al backend y entra por el flujo normal (`api-designer` → contrato → migración). Decidilo antes de implementar, no después del primer `400`.

### Nombrá los controles como el DTO

Los `name` de los inputs son identificadores de código: **van en inglés** y conviene que sean exactamente los del DTO. Con eso, `toPayload` deja de ser un diccionario de traducciones y queda casi mecánico. El copy en español es el `<label>` y el texto del `<option>`, no el `value`.

Hoy varios inputs **no tienen `name`**, y sin `name` un campo no entra en el `FormData`: se envía como si estuviera vacío, en silencio. Es lo primero a arreglar.

### `toPayload`: las tres trampas

```ts
function toPayload(formData: FormData): RegisterPlayerPayload {
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

// Un campo opcional vacío se omite, no se manda como "". El @IsOptional()
// de la API solo saltea `undefined` y `null`: un "" es un valor presente y
// falla contra el @MinLength/@Matches del campo.
function optional(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? undefined : text;
}
```

1. **Opcional vacío se omite.** Es el error más fácil de cometer con `Object.fromEntries(formData)`: manda `""` en los ocho campos opcionales y devuelve un `400` con ocho errores para un formulario que la persona llenó bien. (`Object.fromEntries` además arrastra las claves `$ACTION_` que agrega React.)
2. **El teléfono se concatena, no se manda partido.** `+54` + `9 2284 12-3456`. Los espacios, guiones, puntos y paréntesis los limpia la API, así que no hace falta sanearlos acá — lo que sí importa es que el `+` y el código de país estén.
3. **Trim sí, en el password no.** El `optional`/`required` trimea texto; el password se toma crudo. Trimear una contraseña es un bug: cambia silenciosamente lo que la persona eligió y rompe el login después.

## Manejo de errores

La regla del proyecto: **se mapea el `code`, nunca el `message`**. El `message` viene en inglés y es para debug/logging; el `code` es un identificador estable y es el contrato real (`docs/api-conventions.md`).

```ts
const ERROR_COPY: Record<string, string> = {
  email_registered:
    "Ya existe una cuenta con ese e-mail. Probá iniciar sesión.",
  dni_has_account: "Ese DNI ya tiene una cuenta asociada.",
  validation: "Revisá los campos marcados.",
  invalid_json: "No pudimos procesar el formulario. Volvé a intentarlo.",
};

const FALLBACK_COPY =
  "No pudimos completar el registro. Volvé a intentarlo en unos minutos.";
```

Un `code` desconocido cae en `FALLBACK_COPY`, igual que un `500 internal_error` o un `fetch` que tira (API caída, DNS, timeout): esos ni siquiera llegan a ser `ApiError`, así que el `catch` tiene que cubrir los dos casos.

Para el `400 validation`, el `details` trae `[{ field, messages }]` por campo inválido y ahí está el valor: en vez de un cartel único arriba, cada input muestra su error. El `field` viene con el nombre del DTO (`firstName`), en inglés; si los `name` del form son los mismos, la asociación es directa y solo falta el copy en español por campo.

```ts
function toErrorState(error: unknown, formData: FormData): RegisterFormState {
  const values = echoValues(formData); // todo menos el password

  if (!(error instanceof ApiError)) {
    // Falla de red o bug del cliente: no hay `code` que mapear.
    console.error("register failed", error);
    return { status: "error", message: FALLBACK_COPY, fieldErrors: {}, values };
  }

  const { code, details } = error.body;
  return {
    status: "error",
    message: ERROR_COPY[code] ?? FALLBACK_COPY,
    fieldErrors: code === "validation" ? toFieldErrors(details) : {},
    values,
  };
}
```

Dos cosas que no van en ese `console.error`: **el body del request y el `formData`**. Ahí adentro están la contraseña y el DNI — el DNI es dato personal y la API lo excluye de sus respuestas justamente por eso (Ley 25.326, `docs/decisions.md`). Se loguea el `code` y el `statusCode`, no el input.

## Después del `201`

- **El registro no loguea.** No emite token ni cookie: `AuthModule` (login, `/auth/me`) todavía no existe (`apps/api/AGENTS.md`). No escribas código que asuma sesión iniciada. El final del flujo es un mensaje de éxito y una invitación a iniciar sesión — con el `LoginModal` del header, que ya está.
- **`outcome` cambia el copy, y es el valor visible del dedup.** Con `created` alcanza un "listo, tu cuenta está creada". Con `claimed`, el perfil ya existía porque un club lo había cargado: "ya te teníamos registrado, vinculamos tu cuenta a tu perfil". Los dos casos vuelven `201`.
- **Con `claimed`, `firstName`/`lastName`/`category` de la respuesta no son necesariamente lo que se tipeó**: pueden ser los datos que cargó el club, porque el merge no pisa lo que ya estaba. Si mostrás el nombre en la pantalla de éxito, mostrá **el de la respuesta**, no el del form.

## Qué no hacer

- **No mandes `club_id`** — ni acá ni en ningún endpoint. `Player` es global y no lo tiene; en los endpoints de club el scoping sale del JWT. Es el invariante de tenancy (`CLAUDE.md` raíz).
- **No agregues un chequeo "en vivo" de DNI o e-mail** (on blur, mientras se tipea). El endpoint no tiene rate limiting todavía (`docs/decisions.md`, deuda anotada), quema ~100 ms de bcrypt por request y ya funciona como oráculo de enumeración de DNIs. Tampoco reintentes automáticamente un `409`.
- **No dupliques las reglas de validación de la API** más allá de lo que el control ya garantiza gratis (`type="email"`, `required`, `minLength`, un `<select>` que solo emite valores válidos). Un espejo hecho a mano de la regex de E.164 o de la lista ISO se desincroniza y termina rechazando cosas que la API acepta. La API es la fuente de verdad; el cliente solo evita el viaje obvio.
- **No pongas la base URL ni nada sensible detrás de `NEXT_PUBLIC_`**: queda inlineado en el bundle del navegador.

## Accesibilidad, lo mínimo del form

Hoy ningún `<label>` tiene `htmlFor` ni ningún input tiene `id`, así que los labels no están asociados a nada: un lector de pantalla no los anuncia y el click en el label no enfoca el campo.

- `htmlFor` + `id` en cada par label/input, `name` en todos.
- `autoComplete` correcto: `email`, `new-password`, `given-name`, `family-name`, `tel`, `bday`, `country`.
- `required` en los cinco obligatorios (`email`, `password`, `dni`, `firstName`, `lastName`).
- El error de cada campo con `aria-describedby` apuntando al `id` del mensaje, e `aria-invalid` cuando corresponde.
- El mensaje general en un contenedor con `aria-live="polite"`, para que se anuncie al llegar.
- El submit `disabled` mientras `pending`.

## Cómo probarlo

No hay framework de tests en `apps/web` todavía (`apps/web/AGENTS.md`), así que la verificación es manual, con todo levantado desde la raíz:

```bash
pnpm run db:up        # Postgres local
pnpm run start:dev    # API en :3000
pnpm run dev:web      # Next en :3001
```

Los tres casos que hay que ver antes de abrir el PR — el `409` de e-mail es el más fácil de reproducir (registrate dos veces con el mismo e-mail y distinto DNI):

1. **Alta feliz** → `201` con `outcome: "created"`.
2. **`409 email_registered`** → el copy correspondiente, y el formulario conserva lo tipeado.
3. **`400 validation`** → forzalo con un DNI de 5 dígitos y verificá que el error aparezca en _ese_ campo, no como cartel genérico.

El contrato crudo se prueba sin frontend contra `http://localhost:3000/docs` ("Try it out"), o con:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "content-type: application/json" \
  -d '{"email":"test@example.com","password":"unaclavelarga","dni":"35123456","firstName":"Juan","lastName":"Perez"}'
```

## Checklist del PR

- [ ] Decisión registrada en `docs/decisions.md`: capa `services/`, llamada del lado del servidor y nombre de la variable de entorno.
- [ ] `API.md` y `Deployment.md` actualizados con la variable que quedó (`API_BASE_URL`, no `NEXT_PUBLIC_`).
- [ ] `Frontend.md` (sección 5, "Servicios y datos") y `Architecture.md` reflejan que ya existe la capa `services/`.
- [ ] `ReleaseNotes.md` con el cambio funcional.
- [ ] Sin `any` en los tipos de request y response.
- [ ] `pnpm --filter web run lint`, `pnpm --filter web run build` y `pnpm run format:check` en verde.
