import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { aCsv, fechaJujuy, guardarBarrido, leerHistorial, type FilaHistorial } from "../src/lib/historial";

const fila: FilaHistorial = {
  fecha: "2026-11-24",
  ejecutado_en: "2026-11-24T11:00:00.000Z",
  comunidad_id: "susques",
  estado: "deficit",
  lluvia_observada_mm: 2.1,
  lluvia_normal_mm: 10.3,
  anomalia_pct: -79.6,
  corte_datos: "2026-11-21",
  desde_cache: false,
  accion: "enviada",
  canal: "cola_institucional",
  mensaje: 'Llovió poco, "muy" poco',
};

const fetchReal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchReal;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

function simular(status: number, cuerpo: unknown = null) {
  const llamadas: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init });
    return new Response(cuerpo === null ? null : JSON.stringify(cuerpo), { status });
  }) as typeof fetch;
  return llamadas;
}

test("sin clave de servicio no escribe ni lee, aunque exista la clave anónima", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  const llamadas = simular(201);
  assert.equal(await guardarBarrido([fila]), "no_configurado");
  assert.equal(await leerHistorial({ dias: 30 }), null);
  assert.equal(llamadas.length, 0);
});

test("guarda sin pisar la fila que ya existe para ese día y localidad", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "srv";
  const llamadas = simular(201);
  assert.equal(await guardarBarrido([fila]), "guardado");
  const { url, init } = llamadas[0];
  assert.match(url, /historial_barridos\?on_conflict=fecha,comunidad_id$/);
  assert.match((init!.headers as Record<string, string>).Prefer, /resolution=ignore-duplicates/);
  assert.deepEqual(JSON.parse(init!.body as string), [fila]);
});

test("si Supabase rechaza o no responde, el barrido informa error y no lanza", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "srv";
  simular(500);
  assert.equal(await guardarBarrido([fila]), "error");
  globalThis.fetch = (async () => Promise.reject(new Error("red"))) as typeof fetch;
  assert.equal(await guardarBarrido([fila]), "error");
});

test("la lectura filtra por localidad y por fecha", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "srv";
  const llamadas = simular(200, [fila]);
  assert.deepEqual(await leerHistorial({ comunidadId: "susques", dias: 30 }), [fila]);
  const q = new URL(llamadas[0].url).searchParams;
  assert.equal(q.get("comunidad_id"), "eq.susques");
  assert.match(q.get("fecha")!, /^gte\.\d{4}-\d{2}-\d{2}$/);
});

test("el día se toma en hora de Jujuy y el CSV escapa comillas", () => {
  assert.equal(fechaJujuy("2026-11-25T01:30:00.000Z"), "2026-11-24");
  const [cab, datos] = aCsv([fila]).trim().split("\r\n");
  assert.ok(cab.startsWith("fecha,ejecutado_en,comunidad_id"));
  assert.ok(datos.endsWith('"Llovió poco, ""muy"" poco"'));
});
