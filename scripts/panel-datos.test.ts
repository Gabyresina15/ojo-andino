import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PanelDatos from "../src/components/PanelDatos";
import { recomendacionGobierno } from "../src/lib/alerta";
import { lecturaCacheada } from "../src/lib/cache";
import { COMUNIDADES, getComunidad } from "../src/lib/comunidades";
import { estadoHidrico, PISO_NORMAL_30D_MM } from "../src/lib/lecturas";
import type { Comunidad, LecturaSatelital } from "../src/lib/types";

function fila(c: Comunidad, l: LecturaSatelital) {
  const html = renderToStaticMarkup(createElement(PanelDatos, { comunidad: c, lectura: l, modo: "parametrico" }));
  const row = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)?.find((row) => row.includes(`${c.nombre}</td>`));
  assert.ok(row);
  return row.replace(/<[^>]*>/g, " ");
}

test("el tablero reutiliza la misma recomendación que el PDF para cada municipio", () => {
  for (const c of COMUNIDADES) {
    const l = lecturaCacheada(c.id)!;
    assert.ok(fila(c, l).includes(recomendacionGobierno(c, l)));
  }
});

test("época seca sin temporada o meteorología ausente: Sin dato y verificación, nunca Normal", () => {
  const c = getComunidad("abra-pampa")!;
  const seca = structuredClone(lecturaCacheada(c.id)!);
  seca.meteorologia!.precipitacionMm30d.climatologia = PISO_NORMAL_30D_MM - 1;
  delete seca.meteorologia!.precipitacionTemporada;
  for (const l of [seca, { ...seca, meteorologia: null }]) {
    assert.equal(estadoHidrico(l), "sin_dato");
    const row = fila(c, l);
    assert.match(row, /Sin dato/);
    assert.ok(row.includes(recomendacionGobierno(c, l)));
    assert.match(row, /Verificar necesidades en campo/);
    assert.doesNotMatch(row, /Normal|habitual|sin operativo de emergencia/);
  }
});

test("sin lectura, el panel informa que está cargando sin recomendar normalidad", () => {
  const html = renderToStaticMarkup(createElement(PanelDatos, {
    comunidad: getComunidad("abra-pampa")!, lectura: null, modo: "parametrico",
  }));
  assert.match(html, /Cargando datos/);
  assert.doesNotMatch(html, /Normal|habitual/);
});
