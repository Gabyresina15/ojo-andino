import { COMUNIDADES } from "./comunidades";
import { lecturaCacheada } from "./cache";
import { estadoHidrico } from "./lecturas";
import type { Comunidad, LecturaSatelital } from "./types";

export type FilaSintesis = { c: Comunidad; pct: number };

/** Agrupa las localidades por estado con las mismas lecturas que muestran el mapa y la tabla. */
export function sintesisRegional(lecturas?: Record<string, LecturaSatelital | null>) {
  const deficit: FilaSintesis[] = [];
  const vial: FilaSintesis[] = [];
  const punaConLluvia: FilaSintesis[] = [];
  const normal: FilaSintesis[] = [];
  for (const c of COMUNIDADES) {
    const l = lecturas?.[c.id] ?? lecturaCacheada(c.id);
    const fila = { c, pct: l?.meteorologia?.precipitacionMm30d.porcentaje ?? 0 };
    const est = l ? estadoHidrico(l) : "sin_dato";
    if (est === "deficit") deficit.push(fila);
    else if (est === "superavit_reciente") (c.region === "quebrada" ? vial : punaConLluvia).push(fila);
    else normal.push(fila);
  }
  deficit.sort((a, b) => a.pct - b.pct);
  const puna = COMUNIDADES.filter((c) => c.region === "puna");
  const punaSinDeficit = puna.length - deficit.filter((f) => f.c.region === "puna").length;
  return { deficit, vial, punaConLluvia, normal, punaTotal: puna.length, punaSinDeficit };
}

export const nombres = (filas: FilaSintesis[]) => filas.map((f) => f.c.nombre).join(", ") || "Ninguno";
