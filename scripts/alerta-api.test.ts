import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../src/app/api/alerta/route";
import { lecturaCacheada } from "../src/lib/cache";

const pedir = (body: unknown, ip = "1.1.1.1") =>
  POST(
    new Request("http://localhost/api/alerta", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );

test("ignora la lectura que manda el cliente y redacta con datos del servidor", async () => {
  const falsa = structuredClone(lecturaCacheada("susques")!);
  falsa.meteorologia!.precipitacionMm30d.observado = 999.9;
  falsa.meteorologia!.precipitacionMm30d.porcentaje = 400;
  for (const d of falsa.meteorologia!.serie) d.lluviaMm = 33.3;

  const r = await pedir({ id: "susques", modo: "parametrico", lectura: falsa });
  assert.equal(r.status, 200);
  const a = await r.json();
  assert.equal(a.estado_hidrico, "deficit");
  assert.match(a.corteDatos, /^\d{4}-\d{2}-\d{2}\|A\d{7}$/);
  assert.doesNotMatch(`${a.resumen_oral} ${a.nota_parametrica}`, /999|33,3|400/);
});

test("corta ráfagas desde una misma IP", async () => {
  let ultimo = 0;
  for (let i = 0; i < 31; i++) ultimo = (await pedir({ id: "volcan" }, "2.2.2.2")).status;
  assert.equal(ultimo, 429);
});
