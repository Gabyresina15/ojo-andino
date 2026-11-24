import type { Comunidad } from "./types";

export const DIAS_PRONOSTICO = 7;
const URL_MET = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
// MET Norway exige identificar la aplicación en el User-Agent.
const USER_AGENT = "OjoAndino/1.0 (https://github.com/Gabyresina15/ojo-andino)";
const UTC_ARGENTINA_MS = -3 * 3600 * 1000;
const HORA_MS = 3600 * 1000;

export type DiaPronostico = { fecha: string; mm: number };
export type Pronostico = {
  comunidadId: string;
  /** Cuándo corrió el modelo, según la fuente. */
  actualizado: string;
  dias: DiaPronostico[];
  totalMm: number;
};

type PasoMet = {
  time: string;
  data: {
    next_1_hours?: { details?: { precipitation_amount?: number } };
    next_6_hours?: { details?: { precipitation_amount?: number } };
  };
};

const fechaLocal = (ms: number) => new Date(ms + UTC_ARGENTINA_MS).toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Suma la lluvia pronosticada por día calendario de Argentina, para los `DIAS_PRONOSTICO` días completos
 * que siguen a `ahora`. Usa el paso horario mientras exista y después el de 6 horas (asignado por su punto medio).
 */
export function agregarPorDia(pasos: PasoMet[], ahora: Date): DiaPronostico[] {
  const porDia = new Map<string, number>();
  for (const p of pasos) {
    const t = Date.parse(p.time);
    const h1 = p.data.next_1_hours?.details?.precipitation_amount;
    const h6 = p.data.next_6_hours?.details?.precipitation_amount;
    if (typeof h1 === "number") {
      const f = fechaLocal(t + HORA_MS / 2);
      porDia.set(f, (porDia.get(f) ?? 0) + h1);
    } else if (typeof h6 === "number") {
      const f = fechaLocal(t + 3 * HORA_MS);
      porDia.set(f, (porDia.get(f) ?? 0) + h6);
    }
  }
  const dias: DiaPronostico[] = [];
  for (let i = 1; i <= DIAS_PRONOSTICO; i++) {
    const fecha = fechaLocal(ahora.getTime() + i * 24 * HORA_MS);
    const mm = porDia.get(fecha);
    if (mm === undefined) break;
    dias.push({ fecha, mm: r1(mm) });
  }
  return dias;
}

// `dia`: fecha de Argentina en que se armó la ventana; al cambiar el día, los 7 días ya son otros.
const memoria = new Map<string, { vence: number; dia: string; p: Pronostico | null }>();
const TTL_MIN = 30 * 60 * 1000;
const TTL_ERROR = 5 * 60 * 1000;
const enVuelo = new Map<string, Promise<Pronostico | null>>();

/** Pronóstico de lluvia de MET Norway (CC BY 4.0). `null` si la fuente no responde o no cubre los 7 días. */
export async function pronosticoServidor(c: Comunidad): Promise<Pronostico | null> {
  const m = memoria.get(c.id);
  if (m && Date.now() < m.vence && m.dia === fechaLocal(Date.now())) return m.p;
  let p = enVuelo.get(c.id);
  if (!p) {
    p = consultar(c).finally(() => enVuelo.delete(c.id));
    enVuelo.set(c.id, p);
  }
  return p;
}

async function consultar(c: Comunidad): Promise<Pronostico | null> {
  const ahora = new Date();
  const dia = fechaLocal(ahora.getTime());
  try {
    // La fuente pide no usar más de 4 decimales en las coordenadas.
    const r = await fetch(`${URL_MET}?lat=${c.lat.toFixed(4)}&lon=${c.lon.toFixed(4)}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`MET ${r.status}`);
    const j = (await r.json()) as { properties: { meta: { updated_at: string }; timeseries: PasoMet[] } };
    const dias = agregarPorDia(j.properties.timeseries, ahora);
    if (dias.length < DIAS_PRONOSTICO) throw new Error("pronóstico incompleto");
    const p: Pronostico = {
      comunidadId: c.id,
      actualizado: j.properties.meta.updated_at,
      dias,
      totalMm: r1(dias.reduce((s, d) => s + d.mm, 0)),
    };
    // Se respeta el vencimiento que indica la fuente, con un mínimo propio.
    const expira = Date.parse(r.headers.get("expires") ?? "");
    memoria.set(c.id, { vence: Math.max(Date.now() + TTL_MIN, Number.isFinite(expira) ? expira : 0), dia, p });
    return p;
  } catch {
    memoria.set(c.id, { vence: Date.now() + TTL_ERROR, dia, p: null });
    return null;
  }
}
