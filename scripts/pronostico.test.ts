import assert from "node:assert/strict";
import { test } from "node:test";
import { DIAS_PRONOSTICO, agregarPorDia } from "../src/lib/pronostico";

const paso = (time: string, h1?: number, h6?: number) => ({
  time,
  data: {
    ...(h1 === undefined ? {} : { next_1_hours: { details: { precipitation_amount: h1 } } }),
    ...(h6 === undefined ? {} : { next_6_hours: { details: { precipitation_amount: h6 } } }),
  },
});

test("el pronóstico suma por día de Argentina, sin contar dos veces el paso horario y el de 6 horas", () => {
  const ahora = new Date("2026-11-24T19:00:00Z");
  const pasos = [];
  // Horario hasta el 27/11 06:00 UTC: 0,1 mm por hora, con un bloque de 6 h que no debe sumarse.
  for (let t = Date.parse("2026-11-24T19:00:00Z"); t < Date.parse("2026-11-27T06:00:00Z"); t += 3600e3)
    pasos.push(paso(new Date(t).toISOString(), 0.1, 99));
  // Después, cada 6 horas: 1,2 mm por bloque.
  for (let t = Date.parse("2026-11-27T06:00:00Z"); t < Date.parse("2026-12-04T00:00:00Z"); t += 6 * 3600e3)
    pasos.push(paso(new Date(t).toISOString(), undefined, 1.2));

  const dias = agregarPorDia(pasos, ahora);
  assert.equal(dias.length, DIAS_PRONOSTICO);
  assert.equal(dias[0].fecha, "2026-11-25");
  assert.equal(dias[0].mm, 2.4);
  // 27/11 local: 3 horas del paso horario (00 a 03 h) + bloques de 03, 09 y 15 h.
  assert.equal(dias[2].mm, 3.9);
  // El bloque de las 21 h locales cae casi entero en el día siguiente.
  assert.equal(dias[3].mm, 4.8);
  assert.equal(dias[6].fecha, "2026-12-01");
});

test("si la fuente no cubre los 7 días, no se completa con ceros", () => {
  const dias = agregarPorDia([paso("2026-11-25T12:00:00Z", 0.5)], new Date("2026-11-24T19:00:00Z"));
  assert.equal(dias.length, 1);
});
