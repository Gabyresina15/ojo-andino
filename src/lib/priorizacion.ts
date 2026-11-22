import { estadoHidrico } from "./lecturas";
import type { Comunidad, LecturaSatelital } from "./types";

export type NodoPriorizacion = { comunidad: Pick<Comunidad, "id" | "nombre">; lectura: LecturaSatelital | null };

export function simularPriorizacion(nodos: NodoPriorizacion[], fletesTotales: number) {
  if (!Number.isSafeInteger(fletesTotales) || fletesTotales < 0) {
    throw new RangeError("Los fletes deben ser un entero no negativo seguro");
  }
  const filas = nodos.map(({ comunidad, lectura }, i) => {
    const baseline = Math.floor(fletesTotales / nodos.length) + (i < fletesTotales % nodos.length ? 1 : 0);
    const estado = lectura ? estadoHidrico(lectura) : "sin_dato";
    return {
      id: comunidad.id, nombre: comunidad.nombre, estado,
      porcentaje: lectura?.meteorologia?.precipitacionMm30d.porcentaje ?? null,
      ventana: lectura?.meteorologia?.precipitacionMm30d.ventana ?? "Sin dato",
      ultimoDiaConDato: lectura?.meteorologia?.ultimoDiaConDato ?? null,
      baseline, priorizado: estado === "superavit_reciente" ? 0 : baseline, delta: 0,
    };
  });
  const recuperados = filas.filter((f) => f.estado === "superavit_reciente");
  const conDato = filas.filter((f) => f.estado !== "sin_dato").length;
  const liberados = recuperados.reduce((s, f) => s + f.baseline, 0);
  const deficit = filas.filter((f) => f.estado === "deficit");
  const pesoTotal = deficit.reduce((s, f) => s + Math.abs(f.porcentaje!), 0);
  const cuotas = deficit.map((fila, i) => {
    const cuota = liberados * (Math.abs(fila.porcentaje!) / pesoTotal);
    return { fila, i, entero: Math.floor(cuota), resto: cuota - Math.floor(cuota) };
  });
  let restantes = liberados - cuotas.reduce((s, c) => s + c.entero, 0);
  cuotas.sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const c of cuotas) c.fila.priorizado += c.entero + (restantes-- > 0 ? 1 : 0);
  for (const f of filas) f.delta = f.priorizado - f.baseline;
  return {
    filas, fletesTotales, nodosConDato: conDato, nodosRecuperados: recuperados.length,
    porcentajeReasignable: conDato ? recuperados.length / conDato * 100 : 0,
    fletesReasignados: deficit.length ? liberados : 0,
    fletesSinEmergencia: liberados,
    reservaProvincial: nodos.length ? (deficit.length ? 0 : liberados) : fletesTotales,
  };
}
