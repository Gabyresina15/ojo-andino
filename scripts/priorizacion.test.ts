import assert from "node:assert/strict";
import { test } from "node:test";
import { lecturaCacheada } from "../src/lib/cache";
import { COMUNIDADES } from "../src/lib/comunidades";
import { estadoHidrico } from "../src/lib/lecturas";
import { lecturaMasReciente } from "../src/lib/lectura-reciente";
import { leerCosto, leerFletes } from "../src/lib/entradas-priorizacion";
import { presupuestoRedirigido, simularPriorizacion, type NodoPriorizacion } from "../src/lib/priorizacion";

function nodo(id: string, porcentaje: number | null): NodoPriorizacion {
  const lectura = structuredClone(lecturaCacheada("susques")!);
  lectura.meteorologia!.precipitacionMm30d.porcentaje = porcentaje;
  return { comunidad: { id, nombre: id }, lectura };
}

test("valida texto crudo de fletes y costos", () => {
  for (const texto of ["", "-7", "3.5", "NaN", "Infinity"]) assert.equal(leerFletes(texto), null);
  assert.equal(leerFletes("0"), 0);
  assert.equal(leerFletes("7"), 7);
  for (const texto of ["", "-7", "0.123", "Infinity"]) assert.equal(leerCosto(texto), null);
  assert.equal(leerCosto("0.05"), 0.05);
  assert.equal(leerCosto("0,05"), 0.05);
  assert.equal(leerCosto("0"), 0);
});

test("elige la lectura por último día y luego por generación", () => {
  const cache = lecturaCacheada("susques")!;
  const local = structuredClone(cache);
  local.meteorologia!.ultimoDiaConDato = "2000-01-01";
  local.generadoEn = "2099-01-01T00:00:00Z";
  assert.equal(lecturaMasReciente(local, cache), cache);
  local.meteorologia!.ultimoDiaConDato = cache.meteorologia!.ultimoDiaConDato;
  assert.equal(lecturaMasReciente(local, cache)?.generadoEn, local.generadoEn);
  assert.equal(lecturaMasReciente(null, cache), cache);
  assert.equal(lecturaMasReciente(null, null), null);
});

test("calcula presupuesto en centavos sin deriva de punto flotante", () => {
  assert.equal(presupuestoRedirigido(3, 0.05), 0.15);
  assert.equal(presupuestoRedirigido(3, 0.1), 0.3);
  assert.equal(presupuestoRedirigido(0, 150000), 0);
  assert.equal(presupuestoRedirigido(30, 150000), 4500000);
});

test("conserva enteros, libera recuperados y preserva normal y sin dato", () => {
  const nodos = [nodo("a", 80), nodo("b", -80), nodo("c", null), nodo("d", 0)];
  for (let total = 0; total < 100; total++) {
    const r = simularPriorizacion(nodos, total);
    assert.equal(r.filas.reduce((s, f) => s + f.baseline, 0), total);
    assert.equal(r.filas.reduce((s, f) => s + f.priorizado, 0) + r.reservaProvincial, total);
    assert.ok(r.filas.every((f) => Number.isInteger(f.priorizado)));
    assert.equal(r.filas[0].priorizado, 0);
    assert.equal(r.fletesARecuperados, r.filas[0].baseline);
    for (const i of [2, 3]) assert.equal(r.filas[i].priorizado, r.filas[i].baseline);
  }
  assert.deepEqual(simularPriorizacion(nodos, 5).filas.map((f) => f.baseline), [2, 1, 1, 1]);
});

test("sin déficit lo liberado queda en reserva; dato ausente no recupera", () => {
  const r = simularPriorizacion([nodo("a", 70), { comunidad: { id: "b", nombre: "b" }, lectura: null }], 9);
  assert.equal(r.reservaProvincial, 5);
  assert.equal(r.fletesReasignados, 0);
  assert.equal(r.fletesARecuperados, 5);
  assert.equal(r.filas[1].priorizado, 4);
  assert.equal(r.porcentajeReasignable, 100);
});

test("distribuye proporcionalmente con restos deterministas", () => {
  const r = simularPriorizacion([nodo("a", 50), nodo("b", -25), nodo("c", -75)], 30);
  assert.deepEqual(r.filas.map((f) => f.priorizado), [0, 13, 17]);
  assert.equal(r.fletesReasignados, 10);
});

test("vacío, cero y entradas inválidas", () => {
  assert.equal(simularPriorizacion([], 7).reservaProvincial, 7);
  assert.equal(simularPriorizacion([], 7).fletesARecuperados, 0);
  assert.equal(simularPriorizacion([nodo("a", null)], 0).porcentajeReasignable, 0);
  for (const n of [-1, 1.5, NaN, Infinity]) assert.throws(() => simularPriorizacion([], n), RangeError);
});

test("el porcentaje refleja los estados del cache real de la Puna", () => {
  const nodos = COMUNIDADES.filter((c) => c.region === "puna").map((comunidad) => ({ comunidad, lectura: lecturaCacheada(comunidad.id) }));
  const estados = nodos.map((n) => n.lectura ? estadoHidrico(n.lectura) : "sin_dato");
  const conDato = estados.filter((e) => e !== "sin_dato").length;
  const recuperados = estados.filter((e) => e === "superavit_reciente").length;
  assert.equal(simularPriorizacion(nodos, 40).porcentajeReasignable, conDato ? recuperados / conDato * 100 : 0);
});
