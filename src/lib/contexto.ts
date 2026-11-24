import type { Comunidad } from "./types";
import { fetchJson } from "./lecturas";

/**
 * Contexto satelital adicional de una localidad. Se muestra aparte: nada de esto interviene en el estado hídrico,
 * la alerta, el barrido ni los PDF. Cada bloque es `null` si su fuente no respondió.
 */

const ORNL = "https://modis.ornl.gov/rst/api/v1";
const POWER = "https://power.larc.nasa.gov/api/temporal/daily/point";
const STAC = "https://earth-search.aws.element84.com/v1/search";

export const RADIO_FOCOS_KM = 10;
/** Clases de FireMask de MOD14A2: 7, 8 y 9 son fuego con confianza baja, nominal y alta. */
const FOCO_MIN = 7;
const FOCO_NOMINAL = 8;

export type FocosCalor = {
  desde: string;
  hasta: string;
  /** Compuestos de 8 días con al menos un píxel de fuego, y cantidad de píxeles de 1 km en cada uno. */
  periodos: { fecha: string; pixeles: number; nominalOAlta: number }[];
  compuestos: number;
};
export type RadarSentinel1 = {
  escenas: { id: string; fecha: string; satelite: string; orbita: string }[];
};
export type HumedadSuelo = {
  fecha: string;
  superficial: number;
  raices: number;
  /** Valor de 30 días antes, si existe. */
  superficial30d: number | null;
  raices30d: number | null;
};
export type ContextoSatelital = {
  comunidadId: string;
  generadoEn: string;
  focos: FocosCalor | null;
  radar: RadarSentinel1 | null;
  humedad: HumedadSuelo | null;
};

type Fecha = { modis_date: string; calendar_date: string };
type Subset = { scale?: string; ncols?: number; subset: { modis_date: string; calendar_date: string; data: number[] }[] };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function resumirFocos(subset: Subset["subset"]): FocosCalor | null {
  if (!subset.length) return null;
  const periodos = subset
    .map((s) => ({
      fecha: s.calendar_date,
      pixeles: s.data.filter((c) => c >= FOCO_MIN).length,
      nominalOAlta: s.data.filter((c) => c >= FOCO_NOMINAL).length,
    }))
    .filter((p) => p.pixeles > 0);
  return { desde: subset[0].calendar_date, hasta: subset[subset.length - 1].calendar_date, periodos, compuestos: subset.length };
}

export function resumirHumedad(top: Record<string, number>, raiz: Record<string, number>, fill = -999): HumedadSuelo | null {
  const ok = (v: number | undefined): v is number => v !== undefined && v !== fill && v >= 0;
  const fechas = Object.keys(top)
    .sort()
    .filter((f) => ok(top[f]) && ok(raiz[f]));
  const ult = fechas[fechas.length - 1];
  if (!ult) return null;
  const iso = (f: string) => `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`;
  const antes = new Date(Date.parse(iso(ult)) - 30 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const hay = fechas.includes(antes);
  return {
    fecha: iso(ult),
    superficial: r2(top[ult]),
    raices: r2(raiz[ult]),
    superficial30d: hay ? r2(top[antes]) : null,
    raices30d: hay ? r2(raiz[antes]) : null,
  };
}

async function leerFocos(c: Comunidad): Promise<FocosCalor | null> {
  const pt = `latitude=${c.lat}&longitude=${c.lon}`;
  const { dates } = await fetchJson<{ dates: Fecha[] }>(`${ORNL}/MOD14A2/dates?${pt}`, 12_000);
  const ult = dates.slice(-5);
  if (!ult.length) return null;
  const s = await fetchJson<Subset>(
    `${ORNL}/MOD14A2/subset?${pt}&startDate=${ult[0].modis_date}&endDate=${ult[ult.length - 1].modis_date}` +
      `&kmAboveBelow=${RADIO_FOCOS_KM}&kmLeftRight=${RADIO_FOCOS_KM}&band=FireMask`,
    20_000,
  );
  return resumirFocos(s.subset);
}

type ItemStac = { id: string; properties: { datetime: string; platform?: string; "sat:orbit_state"?: string } };

async function leerRadar(c: Comunidad): Promise<RadarSentinel1 | null> {
  const j = await fetchJson<{ features: ItemStac[] }>(STAC, 12_000, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-1-grd"],
      intersects: { type: "Point", coordinates: [c.lon, c.lat] },
      limit: 3,
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    }),
  });
  if (!j.features?.length) return null;
  return {
    escenas: j.features.map((f) => ({
      id: f.id,
      fecha: f.properties.datetime,
      satelite: `Sentinel-${(f.properties.platform ?? "sentinel-1").replace("sentinel-", "").toUpperCase()}`,
      orbita: f.properties["sat:orbit_state"] === "ascending" ? "ascendente" : f.properties["sat:orbit_state"] === "descending" ? "descendente" : "",
    })),
  };
}

async function leerHumedad(c: Comunidad): Promise<HumedadSuelo | null> {
  const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const hoy = new Date();
  const j = await fetchJson<{ header?: { fill_value?: number }; properties: { parameter: Record<string, Record<string, number>> } }>(
    `${POWER}?parameters=GWETTOP,GWETROOT&community=AG&latitude=${c.lat}&longitude=${c.lon}&format=JSON` +
      `&start=${ymd(new Date(hoy.getTime() - 50 * 86_400_000))}&end=${ymd(hoy)}`,
    10_000,
  );
  const p = j.properties.parameter;
  return resumirHumedad(p.GWETTOP ?? {}, p.GWETROOT ?? {}, j.header?.fill_value);
}

const memoria = new Map<string, { vence: number; ctx: ContextoSatelital }>();
const enVuelo = new Map<string, Promise<ContextoSatelital>>();
const TTL = 6 * 3600 * 1000;
const TTL_PARCIAL = 10 * 60 * 1000;

export async function contextoServidor(c: Comunidad): Promise<ContextoSatelital> {
  const m = memoria.get(c.id);
  if (m && Date.now() < m.vence) return m.ctx;
  let p = enVuelo.get(c.id);
  if (!p) {
    p = (async () => {
      const seguro = <T>(x: Promise<T | null>) => x.catch(() => null);
      const [focos, radar, humedad] = await Promise.all([
        seguro(leerFocos(c)),
        seguro(leerRadar(c)),
        seguro(leerHumedad(c)),
      ]);
      const ctx: ContextoSatelital = { comunidadId: c.id, generadoEn: new Date().toISOString(), focos, radar, humedad };
      const completo = focos && radar && humedad;
      memoria.set(c.id, { vence: Date.now() + (completo ? TTL : TTL_PARCIAL), ctx });
      return ctx;
    })().finally(() => enVuelo.delete(c.id));
    enVuelo.set(c.id, p);
  }
  return p;
}
