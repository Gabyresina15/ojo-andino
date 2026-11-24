import assert from "node:assert/strict";
import { test } from "node:test";
import { baseEstado, estadoHidrico, porPrioridad, ventanaTemporada } from "../src/lib/lecturas";
import { alertaDeterminista, payloadUsuario, validarNumeros } from "../src/lib/alerta";
import { lecturaCacheada } from "../src/lib/cache";
import { getComunidad } from "../src/lib/comunidades";
import type { Anomalia, LecturaSatelital } from "../src/lib/types";

const anom = (observado: number, climatologia: number): Anomalia => ({
  observado,
  climatologia,
  unidad: "mm",
  porcentaje: Math.round((observado / climatologia - 1) * 1000) / 10,
  ventana: "x",
  diasConDato: 30,
});

function lectura(p30: Anomalia, temporada?: Anomalia): LecturaSatelital {
  const l = structuredClone(lecturaCacheada("abra-pampa")!);
  l.meteorologia!.precipitacionMm30d = p30;
  l.meteorologia!.precipitacionTemporada = temporada
    ? { ...temporada, ventana: "01/12/2025–30/04/2026 (151 días con dato)", enCurso: false }
    : undefined;
  return l;
}

test("ventanaTemporada elige la temporada en curso o la última completa", () => {
  assert.deepEqual(ventanaTemporada("20260923"), { desde: "20251201", hasta: "20260430", enCurso: false });
  assert.deepEqual(ventanaTemporada("20260315"), { desde: "20251201", hasta: "20260315", enCurso: true });
  assert.deepEqual(ventanaTemporada("20261220"), { desde: "20251201", hasta: "20260430", enCurso: false });
  assert.deepEqual(ventanaTemporada("20270110"), { desde: "20251201", hasta: "20260430", enCurso: false });
  assert.deepEqual(ventanaTemporada("20270129"), { desde: "20261201", hasta: "20270129", enCurso: true });
});

test("época seca: +98 % sobre 6 mm no es superávit; decide la temporada", () => {
  // Abra Pampa al 23/09/2026 (NASA POWER): 12,2 mm vs 6,2 mm en 30 días; temporada 361 vs 456 mm.
  const l = lectura(anom(12.2, 6.2), anom(361, 456));
  assert.equal(baseEstado(l), "temporada_lluvias");
  assert.equal(estadoHidrico(l), "deficit");
  assert.equal(estadoHidrico(lectura(anom(7.4, 4.4), anom(459, 513))), "normal");
});

test("época seca sin dato de temporada: ni déficit ni superávit", () => {
  assert.equal(estadoHidrico(lectura(anom(12.2, 6.2))), "normal");
  assert.equal(estadoHidrico(lectura(anom(0.5, 6.2))), "normal");
});

test("con normal de 30 días sobre el piso sigue decidiendo la lluvia de 30 días", () => {
  assert.equal(estadoHidrico(lectura(anom(8.7, 41.1), anom(459, 513))), "deficit");
  assert.equal(estadoHidrico(lectura(anom(82.1, 42.6), anom(361, 456))), "superavit_reciente");
});

test("el dictamen por temporada cita las cifras de la temporada y pasa el verificador", () => {
  const c = getComunidad("abra-pampa")!;
  const l = lectura(anom(12.2, 6.2), anom(361, 456));
  for (const modo of ["comunidad", "parametrico"] as const) {
    const a = alertaDeterminista(c, l, modo);
    assert.equal(a.estado_hidrico, "deficit");
    assert.match(a.resumen_oral, /temporada de lluvias .* 361,0 mm frente a 456,0 mm/);
    assert.match(a.nota_parametrica, /desvío -20,8 %/);
    const v = validarNumeros(`${a.resumen_oral} ${a.nota_parametrica}`, payloadUsuario(c, l, modo));
    assert.deepEqual(v.noVerificados, []);
  }
});

test("sin dato de temporada en época seca, la nota no cita el desvío de 30 días que no se usó", () => {
  const a = alertaDeterminista(getComunidad("abra-pampa")!, lectura(anom(12.2, 6.2)), "parametrico");
  assert.doesNotMatch(a.nota_parametrica, /desvío/);
});

test("un déficit de temporada se prioriza antes que un normal con desvío de 30 días más negativo", () => {
  const filas = [
    { id: "normal", estado: "normal", pct: -20 },
    { id: "temporada", estado: "deficit", pct: 98 },
    { id: "30d", estado: "deficit", pct: -79 },
  ].sort(porPrioridad);
  assert.deepEqual(filas.map((f) => f.id), ["30d", "temporada", "normal"]);
});

test("el verificador no acepta el acumulado de 30 días presentado como el de la temporada", () => {
  const c = getComunidad("abra-pampa")!;
  const p = payloadUsuario(c, lectura(anom(12.2, 6.2), anom(361, 456)), "comunidad");
  assert.deepEqual(validarNumeros("La temporada de lluvias dejó 361,0 mm frente a 456,0 mm.", p).noVerificados, []);
  assert.notDeepEqual(validarNumeros("La temporada de lluvias dejó 12,2 mm.", p).noVerificados, []);
  assert.notDeepEqual(validarNumeros("En los últimos 30 días cayeron 361,0 mm.", p).noVerificados, []);
});
