//Se creara pantalla para registro debido a la cantidad de campos necesarios para la inscripcion
"use client";
import { useState } from "react";
import Header from "@/app/(public)/component/header";

export default function Register() {
  //Estado para almacenar el sexo seleccionado("masculino","femenino" o "")
  const [sexoSeleccionado, setSexoSeleccionado] = useState<string>("");

  return (
    <div className="min-h-screen bg-[var(--background)] font-sans flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 1. SECCIÓN SUPERIOR OSCURA (Contenedor del título) */}
        <section className="bg-deep-onyx pt-12 pb-24 text-center px-4">
          <div className="max-w-4xl mx-auto space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-text-dark-main tracking-tight">
              Registro de jugador
            </h1>
            <p className="text-sm md:text-base text-text-dark-muted">
              Súmate a la asociación más grande de pádel en Olavarría
            </p>
          </div>
        </section>

        {/* 2. CONTENEDOR DEL FORMULARIO CON EFECTO SOBREPUESTO */}
        <section className="max-w-4xl mx-auto px-4 pb-20 w-full">
          {/* La magia pasa acá: 
                    -mt-16: Empuja la tarjeta hacia arriba sobre el fondo negro.
                    relative z-10: Asegura que quede por encima de la sección oscura y no se esconda.*/}
          <div className="relative z-10 -mt-16 bg-[var(--background)] border-gray-400 dark:border-gray-800 p-6 md:p-10 rounded-2xl shadow-xl">
            <form className="space-y-8">
              {/* Bloque: Datos de Acceso */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <span className="text-xl">🔒</span>
                  <h2>Datos de Acceso</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Nombre de usuario
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 35123456"
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Contraseña (mín. 6 caracteres)
                    </label>
                    <input
                      type="password"
                      placeholder="******"
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                  </div>
                </div>
              </div>
              {/* Bloque: Información Personal */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <span className="text-xl">👤</span>
                  <h2>Información Personal</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Nombres
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Juan Román"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Apellido
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Riquelme"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      E-mail
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Riquelme"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
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
                          name="sexo"
                          value={sexoSeleccionado}
                          onChange={(e) => setSexoSeleccionado(e.target.value)} //guardamos la eleccion
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                        >
                          <option value="" disabled hidden>
                            Selecciona una opción
                          </option>
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
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
                          name="Fecha de nacimiento"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Bloque: Información Personal */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <span className="text-xl">🥎</span>
                  <h2>Nivel de Juego</h2>
                </div>

                {/* CASO 1: seleccion Masculino */}
                {sexoSeleccionado === "masculino" && (
                  <div className="flex flex-col gap-1.5 animate-fadeIn">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Categoria Caballeros
                    </label>
                    <div className="relative">
                      <select
                        name="categoria"
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
                {sexoSeleccionado === "femenino" && (
                  <div className="flex flex-col gap-1.5 animate-fadeIn">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Categoría Damas
                    </label>
                    <div className="relative">
                      <select
                        name="categoria"
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
                  <span className="text-xl">📱</span>
                  <h2>Contacto y Domicilio</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      País
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Argentina"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Provincia/Estado
                    </label>
                    <input
                      type="text"
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
                          name="codigoPais"
                          defaultValue="+54"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer text-center font-medium"
                        >
                          <option value="+54">AR +54</option>
                          <option value="+598">UY +598</option>
                          <option value="+56">CL +56</option>
                          <option value="+595">PY +595</option>
                          <option value="+55">BR +55</option>
                          <option value="+591">BO +591</option>
                          <option value="+58">VE +58</option>
                          <option value="+57">CO +57</option>
                          <option value="+34">ES +34</option>
                          <option value="+1">US +1</option>
                          {/*paises mas cercanos que pueden llegar a estar en torneo. mas adelante podemos instalar una librería liviana de manejo de teléfonos (como libphonenumber-js o usar componentes ya listos como react-phone-number-input */}
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
                        name="celular"
                        placeholder="xxxx-123456"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Telefono Emergencia
                    </label>
                    <input
                      type="tel"
                      placeholder="Fijo o celular"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                    />
                  </div>
                </div>
              </div>
              {/* Bloque:Preferencia de Juego */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800 text-main">
                  <span className="text-xl">🕹️</span>
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
                          name="brazoHabil"
                          value="derecho"
                          defaultChecked
                          className="sr-only"
                        />
                        <span>Derecho</span>
                      </label>

                      {/* Opción: Izquierdo */}
                      <label className="flex-1 inline-flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-600 rounded-lg cursor-pointer transition-all has-checked:bg-white has-checked:text-gray-900 has-checked:shadow-sm dark:has-checked:bg-gray-700 dark:has-checked:text-white">
                        <input
                          type="radio"
                          name="brazoHabil"
                          value="izquierdo"
                          className="sr-only"
                        />
                        <span>Izquierdo</span>
                      </label>
                    </div>
                  </div>

                  {/* Bloque 2: Posicion habitual */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Posicion habitual
                    </label>
                    <div className="relative">
                      <select
                        name="posicionHabitual"
                        defaultValue="derecha"
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
                className="w-full mt-6 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700  bg-deep-onyx text-xl font-bold tracking-wide transition-all duration-200 hover:border-padel-green hover:text-padel-green cursor-pointer shadow-md active:scale-[0.98] text-text-dark-main"
              >
                Registrarse →
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
