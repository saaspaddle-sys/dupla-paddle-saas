"use client";

import { useState, ChangeEvent } from "react";

export default function CargarCertificadoPage() {
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            if (file.type.startsWith("image/")) {
                setFilePreview(URL.createObjectURL(file));
            } else {
                setFilePreview(null);
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            {/* Botón Volver */}
            <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver a la Lista de Certificados
            </button>

            <div>
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                    Cargar Certificado Médico
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* COLUMNA IZQUIERDA: Guía y Ejemplo */}
                <div className="lg:col-span-5 space-y-6">

                    {/* Card de Advertencias */}
                    <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-md space-y-5">
                        <div className="flex items-center gap-3 text-padel-green">
                            <svg className="w-7 h-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h2 className="text-sm font-black uppercase tracking-wider leading-tight">
                                Evite que sea rechazado al momento de la validación
                            </h2>
                        </div>

                        <div className="space-y-4 text-xs font-medium border-t border-gray-800 pt-4">
                            <div>
                                <p className="text-padel-green font-bold uppercase mb-2">📷 En la imagen a subir:</p>
                                <ul className="space-y-1.5 text-gray-300">
                                    <li className="flex items-center gap-2">✓ Debe ser legible y encuadrada</li>
                                    <li className="flex items-center gap-2">✓ Debe figurar Nombre / DNI / Fecha de emisión</li>
                                    <li className="flex items-center gap-2">✓ Debe contener la firma y sello del profesional</li>
                                </ul>
                            </div>

                            <div>
                                <p className="text-padel-green font-bold uppercase mb-2">📝 En el formulario:</p>
                                <ul className="space-y-1.5 text-gray-300">
                                    <li className="flex items-center gap-2">✓ Transcribir el nombre del profesional firmante</li>
                                    <li className="flex items-center gap-2">✓ Transcribir la matrícula del profesional</li>
                                    <li className="flex items-center gap-2">✓ Transcribir la especialidad del profesional</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Card de Ejemplo Renderizado en SVG */}
                    <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-3">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Ejemplo de Certificado Válido
                        </h3>

                        {/* Plantilla ilustrativa de certificado */}
                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 bg-gray-50 flex flex-col items-center justify-center text-center">
                            <div className="w-full max-w-55 bg-white border border-gray-300 rounded-lg p-3 shadow-sm text-left space-y-2 pointer-events-none">
                                <div className="border-b border-gray-200 pb-2 flex justify-between items-center">
                                    <div className="h-2.5 w-20 bg-gray-300 rounded"></div>
                                    <div className="h-2 w-10 bg-padel-green rounded"></div>
                                </div>
                                <div className="space-y-1.5 py-1">
                                    <div className="h-2 w-32 bg-gray-200 rounded"></div>
                                    <div className="h-2 w-28 bg-gray-200 rounded"></div>
                                    <div className="h-2 w-36 bg-gray-200 rounded"></div>
                                </div>
                                <div className="border-t border-gray-200 pt-3 flex justify-between items-end">
                                    <div className="space-y-1">
                                        <div className="h-1.5 w-16 bg-gray-300 rounded"></div>
                                        <div className="h-1.5 w-12 bg-gray-200 rounded"></div>
                                    </div>
                                    {/* Sello / Firma simulada */}
                                    <div className="w-10 h-10 border border-emerald-500 rounded-full flex items-center justify-center opacity-80 rotate-[-12deg]">
                                        <span className="text-[8px] font-bold text-emerald-600">SELLO</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 font-medium mt-3">
                                Asegúrese de que su documento sea similar a este ejemplo.
                            </p>
                        </div>
                    </div>

                </div>

                {/* COLUMNA DERECHA: Formulario */}
                <div className="lg:col-span-7">
                    <form className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm space-y-6">

                        {/* Campo Dropzone */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                Cargar Certificado <span className="text-gray-400 font-normal lowercase">(solo imágenes JPG/PNG legibles, máx 5MB)</span>
                            </label>

                            <div className="relative border-2 border-dashed border-gray-300 hover:border-padel-green transition-colors rounded-2xl p-6 text-center bg-gray-50/50 flex flex-col items-center justify-center cursor-pointer group">
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/jpg"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />

                                {filePreview ? (
                                    <div className="space-y-2">
                                        <img src={filePreview} alt="Vista previa" className="max-h-40 mx-auto rounded-lg shadow-sm border border-gray-200" />
                                        <p className="text-xs font-semibold text-gray-700">{fileName}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-400 group-hover:text-padel-green group-hover:scale-110 transition-all mb-2">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <p className="text-xs font-bold text-gray-700">
                                            Seleccionar archivo <span className="font-normal text-gray-500">o arrastrar y soltar</span>
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-1">PNG, JPG hasta 5MB</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Expedición y Vigencia */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">
                                    Fecha de Expedición
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green text-gray-700 cursor-pointer"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">
                                    Vigencia Estimada
                                </label>
                                <div className="relative">
                                    <select
                                        defaultValue="30"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green appearance-none text-gray-700 cursor-pointer"
                                    >
                                        <option value="30">30 Días</option>
                                        <option value="60">60 Días</option>
                                        <option value="90">90 Días</option>
                                        <option value="180">180 Días (6 Meses)</option>
                                        <option value="365">365 Días (1 Año)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Profesional Firmante */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Profesional Firmante
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Dr. Juan Pérez"
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />
                        </div>

                        {/* Matrícula y Especialidad */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">
                                    Matrícula Profesional
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: MN 12345 / MP 6789"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase">
                                    Especialidad
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Médico Clínico / Deportólogo"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                                />
                            </div>
                        </div>


                        {/* Observaciones */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Motivo consulta
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Dolor en articulacion"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green"
                            />

                            <label className="text-xs font-bold text-gray-500 uppercase">
                                Notas / Observaciones varias / Diagnostico
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Añada aclaraciones o comentarios adicionales si es necesario..."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:border-padel-green resize-none"
                            ></textarea>
                        </div>

                        {/* Submit CTA */}
                        <button
                            type="submit"
                            className="w-full py-3.5 px-6 rounded-2xl bg-padel-green text-deep-onyx font-black text-sm tracking-wide uppercase hover:brightness-105 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Cargar Certificado Médico al Jugador
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}