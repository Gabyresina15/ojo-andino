import type { Anomalia, AnomaliaTemporada, CompositeNdvi, LecturaSatelital } from "./types";

const POWER = "https://power.larc.nasa.gov/api/temporal";
const ORNL = "https://modis.ornl.gov/rst/api/v1/MYD13Q1";
const MESES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const FILL = -999;

export async function fetchJson<T>(url: string, timeoutMs: number, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status} en ${new URL(url).host}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
function isoFromYmd(s: string): string {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

type PowerDaily = {
  properties: { parameter: { PRECTOTCORR: Record<string, number>; T2M: Record<string, number> } };
  header?: { fill_value?: number };
};
type PowerClim = {
  properties: { parameter: { PRECTOTCORR: Record<string, number>; T2M: Record<string, number> } };
  header?: { range?: string };
};

/**
 * Con una normal de 30 días por debajo de este piso (estación seca de la Puna: 2–6 mm), unos pocos mm
 * mueven el desvío a ±100 % o más sin cambiar la condición del campo: el porcentaje de 30 días no se usa.
 */
export const PISO_NORMAL_30D_MM = 10;
/** Desvío de la temporada de lluvias que se considera déficit. Provisorio: falta calibrarlo con registros de emergencia. */
export const UMBRAL_TEMPORADA_PCT = -20;
/** Desvío de la lluvia de 30 días (en valor absoluto) que separa déficit o superávit de lo normal. Sin calibrar. */
export const UMBRAL_30D_PCT = 25;
const MIN_DIAS_TEMPORADA_EN_CURSO = 60;
const COBERTURA_MINIMA = 0.9;

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(isoFromYmd(b)) - Date.parse(isoFromYmd(a))) / 86400000) + 1;
}

/**
 * Temporada de lluvias a evaluar para un corte dado: la que está en curso si ya lleva 60 días
 * (desde el 1/12), o la última completa (1/12 al 30/4).
 */
export function ventanaTemporada(ultimo: string): { desde: string; hasta: string; enCurso: boolean } {
  const anio = Number(ultimo.slice(0, 4));
  const mes = Number(ultimo.slice(4, 6));
  if (mes === 12 || mes <= 4) {
    const desde = `${mes === 12 ? anio : anio - 1}1201`;
    if (diasEntre(desde, ultimo) >= MIN_DIAS_TEMPORADA_EN_CURSO) return { desde, hasta: ultimo, enCurso: true };
    const a = Number(desde.slice(0, 4));
    return { desde: `${a - 1}1201`, hasta: `${a}0430`, enCurso: false };
  }
  return { desde: `${anio - 1}1201`, hasta: `${anio}0430`, enCurso: false };
}

export async function leerMeteorologia(lat: number, lon: number, hoy = new Date()): Promise<NonNullable<LecturaSatelital["meteorologia"]>> {
  // Alcanza para la última temporada de lluvias completa aunque el corte caiga en diciembre–enero.
  const inicio = new Date(hoy.getTime() - 530 * 86400000);
  const q = `community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
  const [diario, clima] = await Promise.all([
    fetchJson<PowerDaily>(`${POWER}/daily/point?parameters=PRECTOTCORR,T2M&${q}&start=${ymd(inicio)}&end=${ymd(hoy)}`, 6000),
    fetchJson<PowerClim>(`${POWER}/climatology/point?parameters=PRECTOTCORR,T2M&${q}`, 6000),
  ]);
  const fill = diario.header?.fill_value ?? FILL;
  const P = diario.properties.parameter.PRECTOTCORR;
  const T = diario.properties.parameter.T2M;
  const CP = clima.properties.parameter.PRECTOTCORR;
  const CT = clima.properties.parameter.T2M;

  const fechas = Object.keys(P).sort();
  const validas = fechas.filter((f) => P[f] !== fill && P[f] > fill + 1);
  if (validas.length < 7) throw new Error("NASA POWER devolvió muy pocos días con dato");

  const ult30 = validas.slice(-30);
  const climaDia = (f: string) => CP[MESES[Number(f.slice(4, 6)) - 1]];
  const obs = ult30.reduce((s, f) => s + P[f], 0);
  const clim = ult30.reduce((s, f) => s + climaDia(f), 0);
  const ultimo = isoFromYmd(ult30[ult30.length - 1]);
  const primero = isoFromYmd(ult30[0]);

  const precip: Anomalia = {
    observado: r2(obs),
    climatologia: r2(clim),
    unidad: "mm",
    porcentaje: clim > 0 ? r1((obs / clim - 1) * 100) : null,
    ventana: `${ddmm(primero)}–${ddmm(ultimo)}/${ultimo.slice(0, 4)} (${ult30.length} días con dato)`,
    diasConDato: ult30.length,
  };

  const anomalia = (dias: string[], desde: string, hasta: string): Anomalia | undefined => {
    if (dias.length < diasEntre(desde, hasta) * COBERTURA_MINIMA) return undefined;
    const o = dias.reduce((s, f) => s + P[f], 0);
    const c = dias.reduce((s, f) => s + climaDia(f), 0);
    const a = isoFromYmd(dias[0]);
    const b = isoFromYmd(dias[dias.length - 1]);
    return {
      observado: r2(o),
      climatologia: r2(c),
      unidad: "mm",
      porcentaje: c > 0 ? r1((o / c - 1) * 100) : null,
      ventana: `${ddmm(a)}/${a.slice(0, 4)}–${ddmm(b)}/${b.slice(0, 4)} (${dias.length} días con dato)`,
      diasConDato: dias.length,
    };
  };
  const ultimoYmd = ult30[ult30.length - 1];
  const ultimosN = (n: number) => {
    const desde = ymd(new Date(Date.parse(isoFromYmd(ultimoYmd)) - (n - 1) * 86400000));
    return anomalia(validas.filter((f) => f >= desde), desde, ultimoYmd);
  };
  const temp = ventanaTemporada(ultimoYmd);
  const aTemp = anomalia(validas.filter((f) => f >= temp.desde && f <= temp.hasta), temp.desde, temp.hasta);
  const temporada: AnomaliaTemporada | undefined = aTemp ? { ...aTemp, enCurso: temp.enCurso } : undefined;

  const tVal = fechas.filter((f) => T[f] !== fill && T[f] > fill + 1).slice(-7);
  const mesUlt = MESES[Number(ult30[ult30.length - 1].slice(4, 6)) - 1];
  const tMedia = tVal.reduce((s, f) => s + T[f], 0) / Math.max(tVal.length, 1);

  return {
    fuente: "NASA POWER",
    ultimoDiaConDato: ultimo,
    demoraDeclarada: "2–3 días (meteorología)",
    climatologiaPeriodo: clima.header?.range?.match(/\((.*?)\)/)?.[1] ?? "January 2001 - December 2025",
    precipitacionMm30d: precip,
    precipitacionMm90d: ultimosN(90),
    precipitacionMm180d: ultimosN(180),
    precipitacionTemporada: temporada,
    temperaturaC7d: {
      mediaObservada: r2(tMedia),
      climatologiaMes: CT[mesUlt],
      mesClimatologico: mesUlt,
      ventana: tVal.length ? `${ddmm(isoFromYmd(tVal[0]))}–${ddmm(isoFromYmd(tVal[tVal.length - 1]))}` : "sin dato",
    },
    serie: ult30.map((f) => ({
      fecha: isoFromYmd(f),
      lluviaMm: r2(P[f]),
      climaMm: r2(climaDia(f)),
      t2m: T[f] !== fill ? r2(T[f]) : null,
    })),
  };
}

type OrnlDates = { dates: { modis_date: string; calendar_date: string }[] };
type OrnlSubset = { scale: string; subset: { modis_date: string; calendar_date: string; data: number[] }[] };

export async function leerNdvi(lat: number, lon: number): Promise<NonNullable<LecturaSatelital["ndvi"]>> {
  const pt = `latitude=${lat}&longitude=${lon}`;
  const { dates } = await fetchJson<OrnlDates>(`${ORNL}/dates?${pt}`, 9000);
  if (!dates?.length) throw new Error("ORNL sin fechas");
  const last = dates[dates.length - 1];
  const prev = dates[dates.length - 2];
  const yearAgoCode = `A${Number(last.modis_date.slice(1, 5)) - 1}${last.modis_date.slice(5)}`;
  const yearAgo = dates.find((d) => d.modis_date === yearAgoCode);

  const sub = (a: string, b: string) =>
    fetchJson<OrnlSubset>(`${ORNL}/subset?${pt}&startDate=${a}&endDate=${b}&kmAboveBelow=0&kmLeftRight=0&band=250m_16_days_NDVI`, 10000);

  const [actual, anio] = await Promise.all([
    sub(prev?.modis_date ?? last.modis_date, last.modis_date),
    yearAgo ? sub(yearAgo.modis_date, yearAgo.modis_date).catch(() => null) : Promise.resolve(null),
  ]);

  const toComp = (s: OrnlSubset | null, code: string): CompositeNdvi | null => {
    const item = s?.subset.find((x) => x.modis_date === code);
    if (!item || item.data[0] === undefined || item.data[0] <= -2000) return null;
    return { fecha: item.calendar_date, modisDate: item.modis_date, ndvi: r3(item.data[0] * Number(s!.scale || 0.0001)) };
  };

  const ultimo = toComp(actual, last.modis_date);
  if (!ultimo) throw new Error("ORNL sin valor NDVI válido");
  return {
    fuente: "MODIS MYD13Q1 vía ORNL TESViS",
    ultimoComposite: ultimo,
    compositeAnterior: prev ? toComp(actual, prev.modis_date) : null,
    compositeAnioAnterior: yearAgo ? toComp(anio, yearAgo.modis_date) : null,
    aviso: "Producto compuesto de 16 días a 250 m: no es un dato de hoy. Índice de verdor, no porcentaje de pasto.",
  };
}

export async function leerTodo(id: string, lat: number, lon: number): Promise<LecturaSatelital> {
  const errores: string[] = [];
  const [met, ndvi] = await Promise.all([
    leerMeteorologia(lat, lon).catch((e: Error) => {
      errores.push(`NASA POWER: ${e.message}`);
      return null;
    }),
    leerNdvi(lat, lon).catch((e: Error) => {
      errores.push(`ORNL MODIS: ${e.message}`);
      return null;
    }),
  ]);
  return {
    comunidadId: id,
    generadoEn: new Date().toISOString(),
    fuenteCache: false,
    meteorologia: met,
    ndvi,
    errores,
  };
}

/**
 * Qué indicador decide el estado: la lluvia de 30 días, salvo en época seca (normal de 30 días bajo el piso),
 * donde decide la temporada de lluvias. "epoca_seca_sin_temporada" = época seca y no hay dato de temporada.
 */
export function baseEstado(l: LecturaSatelital): "lluvia_30d" | "temporada_lluvias" | "epoca_seca_sin_temporada" {
  const m = l.meteorologia;
  if (!m || m.precipitacionMm30d.climatologia >= PISO_NORMAL_30D_MM) return "lluvia_30d";
  return m.precipitacionTemporada?.porcentaje != null ? "temporada_lluvias" : "epoca_seca_sin_temporada";
}

/** Anomalía que sostiene el estado; null si ninguna lo hace (época seca sin dato de temporada). */
export function anomaliaDelEstado(l: LecturaSatelital): Anomalia | null {
  const m = l.meteorologia;
  if (!m) return null;
  const base = baseEstado(l);
  if (base === "lluvia_30d") return m.precipitacionMm30d;
  return base === "temporada_lluvias" ? m.precipitacionTemporada! : null;
}

/** Orden de priorización: primero los déficits y, dentro de cada grupo, el desvío más negativo. */
export function porPrioridad(a: { estado: string; pct: number }, b: { estado: string; pct: number }): number {
  return Number(b.estado === "deficit") - Number(a.estado === "deficit") || a.pct - b.pct;
}

/** Identifica con qué corte de datos se hizo una lectura, para no mezclar un dictamen con cifras de otro corte. */
export function corteLectura(l: LecturaSatelital): string {
  return `${l.meteorologia?.ultimoDiaConDato ?? "-"}|${l.ndvi?.ultimoComposite?.modisDate ?? "-"}`;
}

/** Clasificación determinista: la verdad la decide el dato, no el LLM. */
export function estadoHidrico(l: LecturaSatelital): "deficit" | "normal" | "superavit_reciente" | "sin_dato" {
  const p = l.meteorologia?.precipitacionMm30d.porcentaje;
  if (p === null || p === undefined) return "sin_dato";
  const base = baseEstado(l);
  if (base === "temporada_lluvias") {
    return l.meteorologia!.precipitacionTemporada!.porcentaje! <= UMBRAL_TEMPORADA_PCT ? "deficit" : "normal";
  }
  if (base === "epoca_seca_sin_temporada") return "normal";
  if (p <= -UMBRAL_30D_PCT) return "deficit";
  if (p >= UMBRAL_30D_PCT) return "superavit_reciente";
  return "normal";
}

/** Código del producto MODIS del que salió una lectura de vegetación (el cache del deploy puede traer el de Terra). */
export function productoNdvi(ndvi: LecturaSatelital["ndvi"] | undefined): "MYD13Q1" | "MOD13Q1" {
  return ndvi?.fuente.includes("MOD13Q1") ? "MOD13Q1" : "MYD13Q1";
}

const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2025-10-24" → "24 oct 2025": rótulo del compuesto, tomado de su fecha real. */
export function fechaComposite(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES_ES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** Lluvia reciente sobre lo normal no borra una temporada de lluvias cerrada en déficit: en ese caso no se descarta el envío de forraje. */
export function temporadaCerradaEnDeficit(l: LecturaSatelital): boolean {
  const t = l.meteorologia?.precipitacionTemporada;
  return !!t && !t.enCurso && t.porcentaje !== null && t.porcentaje <= UMBRAL_TEMPORADA_PCT;
}
