import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as barrido } from "../src/app/api/cron/alertas/route";
import { GET as lecturas } from "../src/app/api/lecturas/route";
import { lecturaCacheada } from "../src/lib/cache";

const corteCache = lecturaCacheada("susques")!.meteorologia!.ultimoDiaConDato;

test("el barrido usa lecturas en vivo, no el cache del deploy", async () => {
  const r = await (await barrido()).json();
  assert.equal(r.totalMunicipios, 10);
  const vivos = r.despachos.filter((d: { desdeCache: boolean }) => !d.desdeCache);
  assert.ok(vivos.length > 0, "ninguna localidad se leyó en vivo");
  for (const d of vivos) assert.ok(d.corteDatos > corteCache, `${d.comunidadId}: corte ${d.corteDatos}`);
});

test("/api/lecturas sin id devuelve las 10 localidades", async () => {
  const todas = await (await lecturas(new Request("http://localhost/api/lecturas"))).json();
  assert.equal(todas.length, 10);
  assert.equal(new Set(todas.map((l: { comunidadId: string }) => l.comunidadId)).size, 10);
});

test("la síntesis regional sale de las lecturas, no de texto fijo", async () => {
  const { sintesisRegional } = await import("../src/lib/sintesis");
  const { COMUNIDADES } = await import("../src/lib/comunidades");
  const l = structuredClone(lecturaCacheada("volcan")!);
  l.meteorologia!.precipitacionMm30d.porcentaje = -60;
  const s = sintesisRegional({ volcan: l });
  assert.ok(s.deficit.some((f) => f.c.id === "volcan"));
  assert.equal(s.deficit.length + s.vial.length + s.punaConLluvia.length + s.normal.length, COMUNIDADES.length);
});
