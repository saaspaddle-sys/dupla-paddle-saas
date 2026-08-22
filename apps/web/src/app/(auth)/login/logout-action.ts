/*indica que esta función se ejecuta en el servidor. Esto es necesario porque una cookie httpOnly no puede modificarse directamente desde JavaScript del navegador
El sidebar puede importarla desde el cliente, pero Next.js genera internamente la llamada remota al servir.El token nunca queda expuesto al componente cliente
*/
"use server";

import { destroySession } from "@/lib/session";

// Server Action que cierra la sesión eliminando la cookie httpOnly.
export async function logoutAction(): Promise<void> {
  await destroySession();
}
