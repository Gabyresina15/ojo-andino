import assert from "node:assert/strict";
import test from "node:test";
import { resumirFocos, resumirHumedad } from "../src/lib/contexto";

test("focos: cuenta solo las clases de fuego y separa la confianza baja", () => {
  const f = resumirFocos([
    { modis_date: "A2026305", calendar_date: "2026-11-01", data: [5, 5, 3, 4, 5] },
    { modis_date: "A2026313", calendar_date: "2026-11-09", data: [5, 7, 8, 9, 6] },
  ], new Date("2026-11-24T12:00:00Z"));
  assert.deepEqual(f, { desde: "2026-11-01", hasta: "2026-11-09", compuestos: 2, desactualizado: false, periodos: [{ fecha: "2026-11-09", pixeles: 3, nominalOAlta: 2 }] });
});

test("humedad: toma el último día válido y el de 30 días antes", () => {
  const top = { "20261022": 0.31, "20261121": 0.27, "20261122": -999 };
  const raiz = { "20261022": 0.3, "20261121": 0.26, "20261122": -999 };
  assert.deepEqual(resumirHumedad(top, raiz), { fecha: "2026-11-21", superficial: 0.27, raices: 0.26, superficial30d: 0.31, raices30d: 0.3 });
  assert.equal(resumirHumedad({ "20261122": -999 }, { "20261122": -999 }), null);
});

test("focos: si el último compuesto es viejo, se marca como desactualizado", () => {
  const s = [{ modis_date: "A2026313", calendar_date: "2026-11-09", data: [5] }];
  assert.equal(resumirFocos(s, new Date("2026-12-08T12:00:00Z"))?.desactualizado, false);
  assert.equal(resumirFocos(s, new Date("2026-12-10T12:00:00Z"))?.desactualizado, true);
});

test("vegetación: el producto y la fecha citados salen de la lectura, no de un texto fijo", async () => {
  const { fechaComposite, productoNdvi } = await import("../src/lib/lecturas");
  const base = { ultimoComposite: { fecha: "2026-10-24", modisDate: "A2026297", ndvi: 0.1 }, compositeAnterior: null, compositeAnioAnterior: null, aviso: "" };
  assert.equal(productoNdvi({ ...base, fuente: "MODIS MOD13Q1 vía ORNL TESViS" }), "MOD13Q1");
  assert.equal(productoNdvi({ ...base, fuente: "MODIS MYD13Q1 vía ORNL TESViS" }), "MYD13Q1");
  assert.equal(fechaComposite("2025-10-24"), "24 oct 2025");
});
