//Se creara pantalla para registro debido a la cantidad de campos necesarios para la inscripcion
"use client";
import { useActionState, useEffect, useState } from "react";
import Header from "@/app/(public)/component/header";
import { registerAction, type RegisterFormState } from "./actions";
import Toast from "@/shared/components/Toast";

// ISO 3166-1 alpha-2 (para `country`) + código telefónico E.164 (para
// `phoneCode`/`emergencyPhoneCode`). Países más cercanos a un torneo local.
const COUNTRIES = [
  { iso: "AR", dial: "+54", label: "Argentina" },
  { iso: "UY", dial: "+598", label: "Uruguay" },
  { iso: "CL", dial: "+56", label: "Chile" },
  { iso: "PY", dial: "+595", label: "Paraguay" },
  { iso: "BR", dial: "+55", label: "Brasil" },
  { iso: "BO", dial: "+591", label: "Bolivia" },
  { iso: "VE", dial: "+58", label: "Venezuela" },
  { iso: "CO", dial: "+57", label: "Colombia" },
  { iso: "ES", dial: "+34", label: "España" },
  { iso: "US", dial: "+1", label: "Estados Unidos" },
];

const INITIAL_STATE: RegisterFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export default function Register() {
  //Estado para almacenar el sexo seleccionado("male","female" o "")
  const [sexoSeleccionado, setSexoSeleccionado] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState(
    registerAction,
    INITIAL_STATE,
  );

  // Tras el toast de éxito, se abre el modal de login (Header redirige a
  // player-dashboard cuando el login se completa).
  const [openLogin, setOpenLogin] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      const timer = setTimeout(() => {
        setOpenLogin(true);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [state.status]);

  function fieldError(name: string) {
    const messages = state.fieldErrors[name];
    if (!messages?.length) {
      return null;
    }
    return <p className="text-xs text-red-600 mt-1">{messages.join(" ")}</p>;
  }

  return (
    <div className="min-h-screen bg-(--background) font-sans flex flex-col">
      <Header openLogin={openLogin} />
      {/*TOATS */}

      {state.status === "success" && (
        <Toast
          message="¡Registro exitoso!"
          subMessage={
            state.message || "Te redirigiremos al inicio de sesión..."
          }
          type="success"
        />
      )}

      <main className="flex-1">
        {/* 1. SECCIÓN SUPERIOR OSCURA (Contenedor del título) */}
        <section className="bg-deep-onyx pt-12 pb-24 text-center px-4">
          <div className="max-w-4xl mx-auto space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-text-dark-main tracking-tight">
              Registro de jugador
            </h1>
            <p className="text-sm md:text-base text-text-dark-muted">
              Súmate a los torneos de Paddel de Benito Juarez
            </p>
          </div>
        </section>

        {/* 2. CONTENEDOR DEL FORMULARIO CON EFECTO SOBREPUESTO */}
        <section className="max-w-4xl mx-auto px-4 pb-20 w-full">
          {/* La magia pasa acá: 
                    -mt-16: Empuja la tarjeta hacia arriba sobre el fondo negro.
                    relative z-10: Asegura que quede por encima de la sección oscura y no se esconda.*/}
          <div className="relative z-10 -mt-16 bg-(--background) border-gray-400 dark:border-gray-800 p-6 md:p-10 rounded-2xl shadow-xl">
            <form action={formAction} className="space-y-6">
              <p aria-live="polite" className="text-sm font-medium">
                {state.message}
              </p>
              {/* Bloque: Datos de Acceso */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <h2>Datos de Acceso</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      E-mail
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      defaultValue={state.values?.email}
                      placeholder="Ej: riquelme@gmail.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                    {fieldError("email")}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Contraseña (8 a 72 caracteres)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        placeholder="******"
                        className="w-full px-4 py-2.5 pr-11 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <svg
                            className="w-5 h-5 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074L3.707 2.293zM10 15a5 5 0 01-4.546-2.924l1.464-1.464A3 3 0 0012.39 12.39l1.464-1.464A5 5 0 0110 15z" />
                            <path d="M2.28 6.22a12.02 12.02 0 00-1.822 3.53c1.274 4.057 5.064 7 9.542 7 1.062 0 2.077-.166 3.024-.472l-1.634-1.634A5 5 0 016.98 9.02L2.28 6.22z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 3C5.522 3 1.732 5.943.458 10c1.274 4.057 5.064 7 9.542 7s8.268-2.943 9.542-7C18.268 5.943 14.478 3 10 3zm0 12a5 5 0 110-10 5 5 0 010 10z" />
                            <path d="M10 8a2 2 0 100 4 2 2 0 000-4z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {fieldError("password")}
                  </div>
                </div>
              </div>
              {/* Bloque: Información Personal */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <h2>Información Personal</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Nombres
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      defaultValue={state.values?.firstName}
                      placeholder="Ej: Juan Román"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                    {fieldError("firstName")}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Apellido
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      defaultValue={state.values?.lastName}
                      placeholder="Ej: Riquelme"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                    {fieldError("lastName")}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      DNI
                    </label>
                    <input
                      type="text"
                      name="dni"
                      required
                      inputMode="numeric"
                      maxLength={8}
                      defaultValue={state.values?.dni}
                      placeholder="Ej: 20123456"
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value
                          .replace(/\D/g, "")
                          .slice(0, 8);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                    {fieldError("dni")}
                  </div>

                  {/* Contenedor principal en formato Grid para que ocupen la misma línea dividida en 2 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bloque 1: Sexo */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        Sexo
                      </label>
                      <div className="relative">
                        <select
                          name="gender"
                          value={sexoSeleccionado}
                          onChange={(e) => setSexoSeleccionado(e.target.value)} //guardamos la eleccion
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                        >
                          <option value="" disabled hidden>
                            Selecciona una opción
                          </option>
                          <option value="male">Masculino</option>
                          <option value="female">Femenino</option>
                        </select>
                        {/* Flecha personalizada del select (opcional, para que se vea igual en todos los navegadores) */}
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                          <svg
                            className="w-4 h-4 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    {/* Flecha personalizada absoluta */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        Fecha de Nacimiento
                      </label>
                      <div>
                        <input
                          type="date"
                          name="birthDate"
                          defaultValue={state.values?.birthDate}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                        />
                        {fieldError("birthDate")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Bloque: Información Personal */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <h2>Nivel de Juego</h2>
                </div>

                {/* CASO 1: seleccion Masculino */}
                {sexoSeleccionado === "male" && (
                  <div className="flex flex-col gap-1.5 animate-fadeIn">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Categoria Caballeros
                    </label>
                    <div className="relative">
                      <select
                        name="category"
                        defaultValue=""
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Seleccione nivel
                        </option>
                        <option value="caballeros primera">
                          Caballeros Primera
                        </option>
                        <option value="caballeros segunda">
                          Caballeros Segunda
                        </option>
                        <option value="caballeros tercera">
                          Caballeros Tercera
                        </option>
                        <option value="caballeros cuarta">
                          Caballeros Cuarta
                        </option>
                        <option value="caballeros quinta">
                          Caballeros Quinta
                        </option>
                        <option value="caballeros sexta">
                          Caballeros Sexta
                        </option>
                        <option value="caballeros septima">
                          Caballeros Septima
                        </option>
                        <option value="caballeros octava">
                          Caballeros Octava
                        </option>
                        <option value="caballeros Sin categorizar">
                          Caballeros SIN categorizar
                        </option>
                      </select>
                      {/* Flecha personalizada del select (opcional, para que se vea igual en todos los navegadores) */}
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                        <svg
                          className="w-4 h-4 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
                {/* CASO 2: Eligió Femenino */}
                {sexoSeleccionado === "female" && (
                  <div className="flex flex-col gap-1.5 animate-fadeIn">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Categoría Damas
                    </label>
                    <div className="relative">
                      <select
                        name="category"
                        defaultValue=""
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Seleccione nivel
                        </option>
                        <option value="damas primera">Damas Primera</option>
                        <option value="damas segunda">Damas Segunda</option>
                        <option value="damas tercera">Damas Tercera</option>
                        <option value="damas cuarta">Damas Cuarta</option>
                        <option value="damas quinta">Damas Quinta</option>
                        <option value="damas sexta">Damas Sexta</option>
                        <option value="damas Sin categorizar">
                          Damas SIN categorizar
                        </option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                        <svg
                          className="w-4 h-4 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* CASO 3: Aún no elige sexo */}
                {sexoSeleccionado === "" && (
                  <p className="text-sm text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    Por favor, selecciona tu sexo arriba para ver las categorías
                    disponibles.
                  </p>
                )}
              </div>
              {/* Bloque: Contacto y residencia */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <h2>Contacto y Domicilio</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      País
                    </label>
                    <div className="relative">
                      <select
                        name="country"
                        defaultValue={state.values?.country ?? "AR"}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                      >
                        {COUNTRIES.map((country) => (
                          <option key={country.iso} value={country.iso}>
                            {country.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                        <svg
                          className="w-4 h-4 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Provincia/Estado
                    </label>
                    <input
                      type="text"
                      name="province"
                      defaultValue={state.values?.province}
                      placeholder="Ej: Buenos Aires"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                  </div>
                  {/* Campo Combinado: Celular con código de país */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Celular (Cod. Pais + numero)
                    </label>
                    <div className="flex gap-2">
                      {/* Select para el Código de País */}
                      <div className="relative w-32 shrink-0">
                        <select
                          name="phoneCode"
                          defaultValue="+54"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer text-center font-medium"
                        >
                          {COUNTRIES.map((country) => (
                            <option key={country.iso} value={country.dial}>
                              {country.iso} {country.dial}
                            </option>
                          ))}
                          {/*mas adelante podemos instalar una librería liviana de manejo de teléfonos (como libphonenumber-js o usar componentes ya listos como react-phone-number-input */}
                        </select>
                        {/* Flechita del select */}
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                          <svg
                            className="w-4 h-4 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                      {/* Input para el Número de Teléfono */}
                      <input
                        type="tel"
                        name="phone"
                        defaultValue={state.values?.phone}
                        placeholder="xxxx-123456"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                      />
                    </div>
                    {fieldError("phone")}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Telefono Emergencia
                    </label>
                    <div className="flex gap-2">
                      <div className="relative w-32 shrink-0">
                        <select
                          name="emergencyPhoneCode"
                          defaultValue="+54"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer text-center font-medium"
                        >
                          {COUNTRIES.map((country) => (
                            <option key={country.iso} value={country.dial}>
                              {country.iso} {country.dial}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                          <svg
                            className="w-4 h-4 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                      <input
                        type="tel"
                        name="emergencyPhone"
                        defaultValue={state.values?.emergencyPhone}
                        placeholder="Fijo o celular"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                      />
                    </div>
                    {fieldError("emergencyPhone")}
                  </div>
                </div>
              </div>
              {/* Bloque:Preferencia de Juego */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <h2>Preferencia de Juego</h2>
                </div>
                {/* Contenedor Grid Principal */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Brazo Hábil (Segmented Control / Radio Group) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Brazo habil
                    </label>
                    <div className="flex bg-gray-50/75 p-1 rounded-xl border border-gray-200 dark:border-gray-700 h-10.5">
                      {/* Opción: Derecho */}
                      <label className="flex-1 inline-flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-600 rounded-lg cursor-pointer transition-all has-checked:bg-white has-checked:text-gray-900 has-checked:shadow-sm dark:has-checked:bg-gray-700 dark:has-checked:text-white">
                        <input
                          type="radio"
                          name="dominantHand"
                          value="right"
                          defaultChecked
                          className="sr-only"
                        />
                        <span>Derecho</span>
                      </label>

                      {/* Opción: Izquierdo */}
                      <label className="flex-1 inline-flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-600 rounded-lg cursor-pointer transition-all has-checked:bg-white has-checked:text-gray-900 has-checked:shadow-sm dark:has-checked:bg-gray-700 dark:has-checked:text-white">
                        <input
                          type="radio"
                          name="dominantHand"
                          value="left"
                          className="sr-only"
                        />
                        <span>Izquierdo</span>
                      </label>
                    </div>
                  </div>

                  {/* Bloque 2: Posicion habitual. La API todavía no tiene
                      este campo (ver RegisterIntegration.md): queda de UI,
                      sin enviarse en el payload hasta que se decida agregarlo. */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Posicion habitual
                    </label>
                    <div className="relative">
                      <select
                        defaultValue="derecho"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Seleccione posicion en la cancha
                        </option>
                        <option value="derecho">Lado derecho</option>
                        <option value="izquierdo">Lado izquierdo</option>
                        <option value="indistinto">Indistinto</option>
                      </select>
                      <div className="absolute inset-y-0     right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                        <svg
                          className="w-4 h-4 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full mt-6 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700  bg-deep-onyx text-xl font-bold tracking-wide transition-all duration-200 hover:border-padel-green hover:text-padel-green cursor-pointer shadow-md active:scale-[0.98] text-text-dark-main disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending ? "Creando cuenta…" : "Registrarse →"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
