/*NOTA:
Se tomo el formulario del registro y se le hicieron las siguientes modificaciones para poder editar el perfil del jugador en ciertas secciones

Ajustes aplicados al formulario original:

1-Avatar con subida de imagen: Selector de archivo que genera un preview inmediato en tiempo real con opción de eliminar o cambiar la imagen.

2-Reorganización de Secciones: Removida la cabecera repetida del registro público para integrarlo al panel privado.

3-Gestión de Contraseña: Convertido en un bloque específico ("Cambiar Contraseña") opcional.

4-Campos Bloqueados: DNI/Nombre de usuario configurado como disabled (datos no editables por el jugador).

5-Carga y Estado Inicial: Precarga de estados para los inputs y el selector dinámico de categoría según sexo.
*/

"use client";

import { useState, ChangeEvent } from "react";
export default function PerfilPage() {
    // Estado para la foto de perfil y su vista previa
    const [fotoPreview, setFotoPreview] = useState<string | null>(null);

    /*Aca hay que hacer el fetch para traer los datos de la db a futuro */
    // Datos editables del jugador
    const [sexoSeleccionado, setSexoSeleccionado] = useState<string>("femenino");
    const [formData, setFormData] = useState({
        nombres: "Julieta",
        apellido: "Sak",
        email: "julieta.sak@example.com",
        categoria: "damas cuarta",
        fechaNacimiento: "1998-05-14",
        pais: "Argentina",
        provincia: "Buenos Aires",
        codigoPais: "+54",
        celular: "2284-123456",
        telefonoEmergencia: "2284-654321",
        brazoHabil: "derecho",
        posicionHabitual: "derecha",
    });

    // Manejo de la subida e previsualización de la foto de perfil
    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setFotoPreview(imageUrl);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Cabecera de la sección */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                    Mi Perfil
                </h1>
                <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">
                    Actualizá tus datos personales y preferencias de juego
                </p>
            </div>

            <form className="bg-white border border-gray-200 dark:border-gray-800 p-6 md:p-8 rounded-3xl shadow-sm space-y-8">

                {/* BLOQUE: Foto de Perfil */}
                <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative group">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gray-100 border-2 border-padel-green flex items-center justify-center shadow-inner">
                            {fotoPreview ? (
                                <img
                                    src={fotoPreview}
                                    alt="Foto de perfil"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl font-black text-gray-400">
                                    {formData.nombres[0]}
                                    {formData.apellido[0]}
                                </span>
                            )}
                        </div>

                        <label
                            htmlFor="foto-upload"
                            className="absolute bottom-0 right-0 bg-deep-onyx text-white p-2 rounded-full cursor-pointer hover:bg-padel-green hover:text-deep-onyx transition-all shadow-md"
                            title="Cambiar foto"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </label>
                        <input
                            id="foto-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                        />
                    </div>

                    <div className="text-center sm:text-left space-y-1">
                        <h3 className="font-bold text-gray-800 text-sm">Foto de Perfil</h3>
                        <p className="text-xs text-gray-400 max-w-xs">
                            Formatos recomendados: JPG o PNG. Tamaño máximo: 5MB.
                        </p>
                        {fotoPreview && (
                            <button
                                type="button"
                                onClick={() => setFotoPreview(null)}
                                className="text-xs font-semibold text-rose-500 hover:underline pt-1 block"
                            >
                                Quitar foto
                            </button>
                        )}
                    </div>
                </div>

                {/* BLOQUE: Datos de Acceso */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                        <h2>Datos de Acceso</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Nombre de usuario (DNI)
                            </label>
                            <input
                                type="text"
                                value="35123456"
                                disabled
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 text-sm cursor-not-allowed font-medium"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Nueva Contraseña (Opcional)
                            </label>
                            <input
                                type="password"
                                placeholder="******"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>
                    </div>
                </div>

                {/* BLOQUE: Información Personal */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                        <h2>Información Personal</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Nombres
                            </label>
                            <input
                                type="text"
                                defaultValue={formData.nombres}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Apellido
                            </label>
                            <input
                                type="text"
                                defaultValue={formData.apellido}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                E-mail
                            </label>
                            <input
                                type="email"
                                defaultValue={formData.email}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Sexo
                                </label>
                                <div className="relative">
                                    <select
                                        name="sexo"
                                        value={sexoSeleccionado}
                                        onChange={(e) => setSexoSeleccionado(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                                    >
                                        <option value="" disabled hidden>
                                            Selecciona una opción
                                        </option>
                                        <option value="masculino">Masculino</option>
                                        <option value="femenino">Femenino</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Fecha de Nacimiento
                                </label>
                                <input
                                    type="date"
                                    defaultValue={formData.fechaNacimiento}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* BLOQUE: Nivel de Juego */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                        <h2>Nivel de Juego</h2>
                    </div>

                    {sexoSeleccionado === "masculino" && (
                        <div className="flex flex-col gap-1.5 animate-fadeIn">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                Categoría Caballeros
                            </label>
                            <div className="relative">
                                <select
                                    name="categoria"
                                    defaultValue={formData.categoria}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                                >
                                    <option value="" disabled hidden>Seleccione nivel</option>
                                    <option value="caballeros primera">Caballeros Primera</option>
                                    <option value="caballeros segunda">Caballeros Segunda</option>
                                    <option value="caballeros tercera">Caballeros Tercera</option>
                                    <option value="caballeros cuarta">Caballeros Cuarta</option>
                                    <option value="caballeros quinta">Caballeros Quinta</option>
                                    <option value="caballeros sexta">Caballeros Sexta</option>
                                    <option value="caballeros septima">Caballeros Séptima</option>
                                    <option value="caballeros octava">Caballeros Octava</option>
                                    <option value="caballeros Sin categorizar">Caballeros SIN categorizar</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}

                    {sexoSeleccionado === "femenino" && (
                        <div className="flex flex-col gap-1.5 animate-fadeIn">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                Categoría Damas
                            </label>
                            <div className="relative">
                                <select
                                    name="categoria"
                                    defaultValue={formData.categoria}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                                >
                                    <option value="" disabled hidden>Seleccione nivel</option>
                                    <option value="damas primera">Damas Primera</option>
                                    <option value="damas segunda">Damas Segunda</option>
                                    <option value="damas tercera">Damas Tercera</option>
                                    <option value="damas cuarta">Damas Cuarta</option>
                                    <option value="damas quinta">Damas Quinta</option>
                                    <option value="damas sexta">Damas Sexta</option>
                                    <option value="damas Sin categorizar">Damas SIN categorizar</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* BLOQUE: Contacto y Domicilio */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                        <h2>Contacto y Domicilio</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">País</label>
                            <input
                                type="text"
                                defaultValue={formData.pais}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">Provincia/Estado</label>
                            <input
                                type="text"
                                defaultValue={formData.provincia}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Celular (Cód. País + número)
                            </label>
                            <div className="flex gap-2">
                                <div className="relative w-32 shrink-0">
                                    <select
                                        name="codigoPais"
                                        defaultValue={formData.codigoPais}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer text-center font-medium"
                                    >
                                        <option value="+54">AR +54</option>
                                        <option value="+598">UY +598</option>
                                        <option value="+56">CL +56</option>
                                        <option value="+595">PY +595</option>
                                        <option value="+55">BR +55</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </div>
                                <input
                                    type="tel"
                                    name="celular"
                                    defaultValue={formData.celular}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">Teléfono Emergencia</label>
                            <input
                                type="tel"
                                defaultValue={formData.telefonoEmergencia}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>
                    </div>
                </div>

                {/* BLOQUE: Preferencia de Juego */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                        <h2>Preferencia de Juego</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                Brazo hábil
                            </label>
                            <div className="flex bg-gray-50/75 p-1 rounded-xl border border-gray-200 dark:border-gray-700 h-10.5">
                                <label className="flex-1 inline-flex items-center justify-center text-sm font-medium text-gray-700 rounded-lg cursor-pointer transition-all has-checked:bg-white has-checked:text-gray-900 has-checked:shadow-sm
                dark:has-checked:bg-gray-700 dark:has-checked:text-white">
                                    <input
                                        type="radio"
                                        name="brazoHabil"
                                        value="derecho"
                                        defaultChecked={formData.brazoHabil === "derecho"}
                                        className="sr-only"
                                    />
                                    <span>Derecho</span>
                                </label>

                                <label className="flex-1 inline-flex items-center justify-center text-sm font-medium text-gray-700 rounded-lg cursor-pointer transition-all has-checked:bg-white has-checked:text-gray-900 has-checked:shadow-sm
                dark:has-checked:bg-gray-700 dark:has-checked:text-white">
                                    <input
                                        type="radio"
                                        name="brazoHabil"
                                        value="izquierdo"
                                        defaultChecked={formData.brazoHabil === "izquierdo"}
                                        className="sr-only"
                                    />
                                    <span>Izquierdo</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                Posición habitual
                            </label>
                            <div className="relative">
                                <select
                                    name="posicionHabitual"
                                    defaultValue={formData.posicionHabitual}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                                >
                                    <option value="" disabled hidden>Seleccione posición</option>
                                    <option value="derecho">Lado derecho</option>
                                    <option value="izquierdo">Lado izquierdo</option>
                                    <option value="indistinto">Indistinto</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Botón de Guardado */}
                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-deep-onyx text-white hover:text-padel-green font-bold text-sm border-2 border-transparent hover:border-padel-green transition-all shadow-md active:scale-[0.98] cursor-pointer"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    );
}