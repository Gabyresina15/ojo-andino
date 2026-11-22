import { estadoHidrico } from "./lecturas";
import type { Comunidad, EstadoHidrico, LecturaSatelital } from "./types";

export type NodoPriorizacion = {
  comunidad: Pick<Comunidad, "id" | "nombre">;
  lectura: LecturaSatelital | null;
};

export type FilaPriorizacion = {
  id: string;
  nombre: string;
  estado: EstadoHidrico;
  porcentaje: number | null;
  ventana: string;
  ultimoDiaConDato: string | null;
  baseline: number;
  priorizado: number;
  delta: number;
};

export type ResultadoPriorizacion = {
  filas: FilaPriorizacion[];
  fletesTotales: number;
  nodosConDato: number;
  nodosRecuperados: number;
  porcentajeReasignable: number;
  fletesReasignados: number;
  fletesARecuperados: number;
  reservaProvincial: number;
};

function repartirPorRestosMayores(pesos: number[], total: number): number[] {
  const pesoTotal = pesos.reduce((suma, peso) => suma + peso, 0);
  const cuotas = pesos.map((peso, indice) => {
    const cuota = total * (peso / pesoTotal);
    return {
      indice,
      entero: Math.floor(cuota),
      resto: cuota - Math.floor(cuota),
    };
  });
  const restantes = total - cuotas.reduce((suma, cuota) => suma + cuota.entero, 0);
  cuotas.sort((a, b) => b.resto - a.resto || a.indice - b.indice);
  const reparto = pesos.map(() => 0);
  cuotas.forEach((cuota, posicion) => {
    reparto[cuota.indice] = cuota.entero + (posicion < restantes ? 1 : 0);
  });
  return reparto;
}

export function simularPriorizacion(
  nodos: NodoPriorizacion[],
  fletesTotales: number,
): ResultadoPriorizacion {
  if (!Number.isSafeInteger(fletesTotales) || fletesTotales < 0) {
    throw new RangeError("Los fletes deben ser un entero no negativo seguro");
  }
  const filas: FilaPriorizacion[] = nodos.map(({ comunidad, lectura }, i) => {
    const baseline = Math.floor(fletesTotales / nodos.length) + (i < fletesTotales % nodos.length ? 1 : 0);
    const estado = lectura ? estadoHidrico(lectura) : "sin_dato";
    return {
      id: comunidad.id,
      nombre: comunidad.nombre,
      estado,
      porcentaje: lectura?.meteorologia?.precipitacionMm30d.porcentaje ?? null,
      ventana: lectura?.meteorologia?.precipitacionMm30d.ventana ?? "Sin dato",
      ultimoDiaConDato: lectura?.meteorologia?.ultimoDiaConDato ?? null,
      baseline,
      priorizado: estado === "superavit_reciente" ? 0 : baseline,
      delta: 0,
    };
  });
  const recuperados = filas.filter((f) => f.estado === "superavit_reciente");
  const conDato = filas.filter((f) => f.estado !== "sin_dato").length;
  const liberados = recuperados.reduce((s, f) => s + f.baseline, 0);
  const deficit = filas.filter(
    (fila): fila is FilaPriorizacion & { porcentaje: number } =>
      fila.estado === "deficit" && typeof fila.porcentaje === "number",
  );
  const reparto = repartirPorRestosMayores(
    deficit.map((fila) => Math.abs(fila.porcentaje)),
    liberados,
  );
  deficit.forEach((fila, indice) => {
    fila.priorizado += reparto[indice];
  });
  for (const f of filas) f.delta = f.priorizado - f.baseline;
  return {
    filas,
    fletesTotales,
    nodosConDato: conDato,
    nodosRecuperados: recuperados.length,
    porcentajeReasignable: conDato ? recuperados.length / conDato * 100 : 0,
    fletesReasignados: deficit.length ? liberados : 0,
    fletesARecuperados: liberados,
    reservaProvincial: nodos.length ? (deficit.length ? 0 : liberados) : fletesTotales,
  };
}
