import datos from "../data/chirps-temporadas.json";
import { UMBRAL_TEMPORADA_PCT, ventanaTemporada } from "./lecturas";
import type { LecturaSatelital } from "./types";

const TEMPORADAS = datos.temporadas as Record<string, Record<string, number>>;
const CLIMA_DESDE = 2001;
const CLIMA_HASTA = 2025;
const MIN_TEMPORADAS_CLIMA = 20;

export type CruceTemporada = {
  fuente: "CHIRPS";
  /** Año en que termina la temporada cruzada. */
  temporada: number;
  observado: number;
  climatologia: number;
  porcentaje: number;
  /** Las dos fuentes quedan del mismo lado del umbral de déficit de temporada. */
  coincide: boolean;
};

/**
 * Segunda fuente para la temporada de lluvias que evalúa la lectura. Solo temporadas cerradas:
 * CHIRPS llega con semanas de demora y no se consulta en vivo (ver scripts/chirps-temporadas.ts).
 */
export function cruceTemporada(l: LecturaSatelital): CruceTemporada | null {
  const m = l.meteorologia;
  const nasa = m?.precipitacionTemporada;
  if (!m || !nasa || nasa.enCurso || nasa.porcentaje === null) return null;
  const { hasta, enCurso } = ventanaTemporada(m.ultimoDiaConDato.replaceAll("-", ""));
  if (enCurso) return null;
  const serie = TEMPORADAS[l.comunidadId];
  const temporada = Number(hasta.slice(0, 4));
  const observado = serie?.[temporada];
  if (observado === undefined) return null;
  const base: number[] = [];
  for (let a = CLIMA_DESDE; a <= CLIMA_HASTA; a++) if (serie[a] !== undefined) base.push(serie[a]);
  if (base.length < MIN_TEMPORADAS_CLIMA) return null;
  const climatologia = base.reduce((s, v) => s + v, 0) / base.length;
  if (climatologia <= 0) return null;
  const porcentaje = Math.round((observado / climatologia - 1) * 1000) / 10;
  return {
    fuente: "CHIRPS",
    temporada,
    observado,
    climatologia: Math.round(climatologia * 10) / 10,
    porcentaje,
    coincide: porcentaje <= UMBRAL_TEMPORADA_PCT === nasa.porcentaje <= UMBRAL_TEMPORADA_PCT,
  };
}

export function textoCruce(c: CruceTemporada): string {
  const pct = `${c.porcentaje >= 0 ? "+" : ""}${c.porcentaje.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const base = `Segunda fuente (CHIRPS), misma temporada: ${pct}.`;
  if (!c.coincide) return `${base} Las fuentes no coinciden: verificar en campo.`;
  return c.porcentaje <= UMBRAL_TEMPORADA_PCT
    ? `${base} Las dos fuentes marcan déficit de temporada.`
    : `${base} Ninguna de las dos fuentes marca déficit de temporada.`;
}
