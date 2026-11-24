/**
 * Historial de barridos en Supabase REST (PostgREST), sin SDK. Tabla: supabase/schema.sql.
 * Usa solo la clave de servicio: la clave anónima no tiene permisos sobre esta tabla.
 */
export type FilaHistorial = {
  fecha: string;
  ejecutado_en: string;
  comunidad_id: string;
  estado: "deficit" | "normal" | "superavit_reciente" | "sin_dato";
  lluvia_observada_mm: number;
  lluvia_normal_mm: number;
  anomalia_pct: number;
  corte_datos: string | null;
  desde_cache: boolean;
  accion: "enviada" | "en_vigilancia";
  canal: string;
  mensaje: string | null;
};

export type EstadoHistorial = "guardado" | "no_configurado" | "error";

const PAGINA = 1000;
const MAX_PAGINAS = 20;

const COLUMNAS =
  "fecha,ejecutado_en,comunidad_id,estado,lluvia_observada_mm,lluvia_normal_mm,anomalia_pct,corte_datos,desde_cache,accion,canal,mensaje";

function conexion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { base: `${url}/rest/v1/historial_barridos`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

/** Día calendario en Jujuy (YYYY-MM-DD) de un instante ISO. */
export function fechaJujuy(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Jujuy" });
}

/** Registra el barrido. Si ese día ya tiene fila para una localidad, la fila existente se conserva. */
export async function guardarBarrido(filas: FilaHistorial[]): Promise<EstadoHistorial> {
  const cx = conexion();
  if (!cx) return "no_configurado";
  try {
    const r = await fetch(`${cx.base}?on_conflict=fecha,comunidad_id`, {
      method: "POST",
      headers: { ...cx.headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(filas),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? "guardado" : "error";
  } catch {
    return "error";
  }
}

/** Filas más recientes primero. `null` si el historial no está configurado. */
export async function leerHistorial(opts: { comunidadId?: string; dias: number }): Promise<FilaHistorial[] | null> {
  const cx = conexion();
  if (!cx) return null;
  const desde = fechaJujuy(new Date(Date.now() - opts.dias * 86_400_000).toISOString());
  const q = new URLSearchParams({ select: COLUMNAS, fecha: `gte.${desde}`, order: "fecha.desc,comunidad_id.asc" });
  if (opts.comunidadId) q.set("comunidad_id", `eq.${opts.comunidadId}`);

  // Supabase corta cada respuesta (1000 filas por defecto): se pagina hasta agotar el rango pedido.
  const filas: FilaHistorial[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    q.set("offset", String(filas.length));
    q.set("limit", String(PAGINA));
    const r = await fetch(`${cx.base}?${q}`, { headers: cx.headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`historial ${r.status}`);
    const lote = (await r.json()) as FilaHistorial[];
    filas.push(...lote);
    if (lote.length < PAGINA) return filas;
  }
  throw new Error("historial incompleto");
}

const celda = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function aCsv(filas: FilaHistorial[]): string {
  const cols = COLUMNAS.split(",") as (keyof FilaHistorial)[];
  return [cols.join(","), ...filas.map((f) => cols.map((c) => celda(f[c])).join(","))].join("\r\n") + "\r\n";
}
