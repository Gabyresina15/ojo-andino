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

test("acepta decimales con punto", () => {
  const texto = REAL.replace("2,3 mm", "2.3 mm").replace("2,9 °C", "2.9 °C").replace("0,083", "0.083");
  assert.deepEqual(validarNumeros(texto, payload).noVerificados, []);
});

test("rechaza decimales con punto falsos", () => {
  assert.ok(validarNumeros(REAL.replace("2,3 mm", "8.7 mm"), payload).noVerificados.length > 0);
});

test("la ventana de 7 días escrita después del monto no contamina al monto siguiente", () => {
  const ok = "Llegaron 2,5 mm en los últimos 7 días y 8,7 mm en el último mes.";
  assert.deepEqual(validarNumeros(ok, payload).noVerificados, []);
  assert.ok(validarNumeros(ok.replace("2,5 mm", "4,5 mm"), payload).noVerificados.length > 0);
});

test("una fecha en la oración siguiente no se toma como fecha del pico", () => {
  const pico = payload.patron_diario!.pico_maximo_dia;
  const otra = [...JSON.stringify(payload).matchAll(/\d{4}-(\d{2})-(\d{2})/g)]
    .map((m) => `${m[2]}/${m[1]}`)
    .find((f) => f !== pico);
  assert.ok(otra, "el payload debería tener otra fecha además del pico");
  const texto = `El pico más fuerte fue de 2,3 mm. Al ${otra} no hubo más lluvias.`;
  assert.deepEqual(validarNumeros(texto, payload).noVerificados, []);
});

test("una ventana de 7 días tras una conjunción pertenece al monto siguiente", () => {
  const ok = "En el mes cayeron 8,7 mm y en los últimos 7 días llegaron 2,5 mm.";
  assert.deepEqual(validarNumeros(ok, payload).noVerificados, []);
  assert.ok(validarNumeros(ok.replace("2,5 mm", "8,7 mm"), payload).noVerificados.length > 0);
});

test("un pico seguido de 'en la última semana' se verifica como pico", () => {
  const ok = "El pico fue de 2,3 mm en la última semana.";
  assert.deepEqual(validarNumeros(ok, payload).noVerificados, []);
  assert.ok(validarNumeros(ok.replace("2,3 mm", "2,5 mm"), payload).noVerificados.length > 0);
});
