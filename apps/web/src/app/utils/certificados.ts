export interface Medico {
  nombre: string;
  matricula: string;
  especialidad: string;
}

export interface Certificado {
  id: string;
  fechaExpedicion: string; // Formato 'YYYY-MM-DD'
  diasVigencia: number;
  motivoConsulta: string;
  notasDiagnostico: string;
  medico: Medico;
  archivoUrl?: string;
}

/** Formatea una fecha YYYY-MM-DD a DD/MM/YYYY */
export function formatearFecha(fechaStr: string | Date): string {
  const date = new Date(fechaStr);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Calcula la fecha de vencimiento sumando los días de vigencia */
export function calcularFechaVencimiento(
  fechaExpedicion: string,
  diasVigencia: number,
): Date {
  const fecha = new Date(fechaExpedicion);
  fecha.setUTCDate(fecha.getUTCDate() + diasVigencia);
  return fecha;
}

/** Evalúa el estado actual del certificado según la fecha de vencimiento */
export function obtenerEstadoVigencia(fechaVencimiento: Date): {
  texto: string;
  estilos: string;
} {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
  const diffDias = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return {
      texto: "Vencido",
      estilos: "bg-rose-100 text-rose-700",
    };
  }

  if (diffDias <= 15) {
    return {
      texto: "Por vencer",
      estilos: "bg-amber-100 text-amber-800",
    };
  }

  return {
    texto: "Vigente",
    estilos: "bg-emerald-100 text-emerald-800",
  };
}
