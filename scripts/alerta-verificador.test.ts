import assert from "node:assert/strict";
import { test } from "node:test";
import { alertaDeterminista, payloadUsuario, validarNumeros } from "../src/lib/alerta";
import { lecturaCacheada } from "../src/lib/cache";
import { COMUNIDADES, getComunidad } from "../src/lib/comunidades";

const susques = getComunidad("susques")!;
const payload = payloadUsuario(susques, lecturaCacheada(susques.id)!, "comunidad");

// Dictamen real de Grok despachado a Susques el 24/11/2026 (cifras correctas).
const REAL =
  "En Susques, en estos últimos 30 días cayeron solo 8,7 mm de lluvia, con 27 días secos y una racha de 21 días sin una gota. En los últimos 7 días apenas llegaron 2,5 mm y el pico más fuerte fue de 2,3 mm el 12 de noviembre, que representó el 26 % del total del mes. La temperatura anda 2,9 °C por encima de lo normal, lo que acelera la evaporación de las aguadas y frena el rebrote del pastizal, justo cuando el NDVI sigue muy bajo en 0,083.";

test("acepta el dictamen real con cifras correctas", () => {
  assert.deepEqual(validarNumeros(REAL, payload).noVerificados, []);
});

const MUTACIONES: [string, string][] = [
  ["27 días secos", "20 días secos"],
  ["racha de 21 días", "racha de 15 días"],
  ["llegaron 2,5 mm", "llegaron 4,5 mm"],
  ["fue de 2,3 mm", "fue de 8,7 mm"],
  ["el 12 de noviembre", "el 19 de noviembre"],
  ["el 26 %", "el 40 %"],
  ["2,9 °C", "4,9 °C"],
  ["0,083", "0,150"],
];

for (const [original, falso] of MUTACIONES) {
  test(`rechaza "${falso}" (fuente: "${original}")`, () => {
    const texto = REAL.replace(original, falso);
    assert.notEqual(texto, REAL);
    assert.ok(validarNumeros(texto, payload).noVerificados.length > 0);
  });
}

test("el redactor determinista pasa su propia verificación en todos los municipios", () => {
  for (const c of COMUNIDADES) {
    const l = lecturaCacheada(c.id);
    if (!l) continue;
    for (const modo of ["comunidad", "parametrico"] as const) {
      const det = alertaDeterminista(c, l, modo);
      const v = validarNumeros(`${det.resumen_oral} ${det.nota_parametrica}`, payloadUsuario(c, l, modo));
      assert.deepEqual(v.noVerificados, [], `${c.id}/${modo}`);
    }
  }
});
