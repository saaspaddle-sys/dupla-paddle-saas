import {
  Certificado,
  formatearFecha,
  calcularFechaVencimiento,
  obtenerEstadoVigencia,
} from '../../utils/certificados'


//interface que simula datos de la DB y los helper estan en utils certificados.ts

//mock de prueba

const mockCertificados: Certificado[] = [
  {
    id: "1",
    fechaExpedicion: "2025-01-10",
    diasVigencia: 1,
    motivoConsulta: "Alta Médica por Esguince",
    notasDiagnostico: "Tratamiento de kinesiología completado",
    medico: {
      nombre: "Dr. Esteban Peralta",
      matricula: "51029",
      especialidad: "Traumatología",
    },
  },
  {
    id: "2",
    fechaExpedicion: "2025-09-05",
    diasVigencia: 360,
    motivoConsulta: "Electrocardiograma y Ergometría",
    notasDiagnostico: "Revisión cardiovascular preventiva",
    medico: {
      nombre: "Dra. Mariana López",
      matricula: "31204",
      especialidad: "Cardiología",
    },
  },
  {
    id: "3",
    fechaExpedicion: "2026-03-12",
    diasVigencia: 180,
    motivoConsulta: "Aptitud Física de Alto Rendimiento",
    notasDiagnostico: "Apto para competencia sin observaciones",
    medico: {
      nombre: "Dr. Roberto Gómez",
      matricula: "45892",
      especialidad: "Deportología",
    },
  },
]

export default function CertificadosListPage() {
  // Ordenamiento: lo más reciente arriba
  const certificadosOrdenados = [...mockCertificados].sort(
    (a, b) => new Date(b.fechaExpedicion).getTime() - new Date(a.fechaExpedicion).getTime()
  );


  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-deep-onyx md:text-3xl font-black tracking-tight">
        Mis Certificados
      </h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Historial de Certificados</h3>
          <p className="text-xs text-gray-400 mt-1">
            Revisá el estado y detalle de tus certificados médicos presentados.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-6 text-center w-28">Fecha</th>
                <th className="py-4 px-6">Diagnóstico</th>
                <th className="py-4 px-6 text-center w-36">Vigencia Hasta</th>
                <th className="py-4 px-6 text-center w-28">Estado</th>
                <th className="py-4 px-6 text-right w-48">Médico</th>
                <th className="py-4 px-6 text-center w-20">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm">
              {certificadosOrdenados.map((cert) => {
                const fechaVencimiento = calcularFechaVencimiento(
                  cert.fechaExpedicion,
                  cert.diasVigencia
                );
                const estado = obtenerEstadoVigencia(fechaVencimiento);

                return (
                  <tr key={cert.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-center font-bold text-gray-900 text-xs">
                      {formatearFecha(cert.fechaExpedicion)}
                    </td>

                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900 leading-tight">
                        {cert.motivoConsulta}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                        {cert.notasDiagnostico}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center font-bold text-gray-900 text-xs">
                      {formatearFecha(fechaVencimiento)}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${estado.estilos}`}
                      >
                        {estado.texto}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="font-bold text-gray-900 leading-tight text-xs">
                        {cert.medico.nombre}
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">
                        Mat. {cert.medico.matricula} ({cert.medico.especialidad})
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <button
                        type="button"
                        title="Ver archivo"
                        className="p-2 text-gray-400 hover:text-padel-green hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}