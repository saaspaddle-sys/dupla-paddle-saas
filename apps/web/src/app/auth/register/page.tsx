import { redirect } from "next/navigation";

// Alias de compatibilidad: mantiene operativo /auth/register para links viejos
// o externos, pero centraliza la UI real en /register.
// Ventaja: una sola fuente de verdad para el formulario y menor riesgo de
// inconsistencias al mantener estilos, validaciones y lógica en un único lugar.
export default function AuthRegisterAliasPage() {
  redirect("/register");
}
