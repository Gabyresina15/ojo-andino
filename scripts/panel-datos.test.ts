import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PanelDatos from "../src/components/PanelDatos";
import { lecturaCacheada } from "../src/lib/cache";
import { getComunidad } from "../src/lib/comunidades";
import { estadoHidrico, PISO_NORMAL_30D_MM, UMBRAL_DEFICIT_PCT, UMBRAL_SUPERAVIT_PCT } from "../src/lib/lecturas";
import type { Comunidad, LecturaSatelital } from "../src/lib/types";

function fila(c: Comunidad, l: LecturaSatelital) {
  const html = renderToStaticMarkup(createElement(PanelDatos, { comunidad: c, lectura: l, modo: "parametrico" }));
  const row = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)?.find((row) => row.includes(`${c.nombre}</td>`));
  assert.ok(row);
  return row;
}

test("el tablero muestra etiquetas breves acordes al estado hídrico en ambas regiones", () => {
  for (const id of ["abra-pampa", "tilcara"]) {
    const c = getComunidad(id)!;
    for (const [pct, estado, diagnostico, accion] of [
      [UMBRAL_DEFICIT_PCT, "deficit", "Déficit", "🚚 Priorizar envío de forraje (alfalfa) y agua"],
      [0, "normal", "Normal", "Seguimiento municipal habitual"],
      [UMBRAL_SUPERAVIT_PCT, "superavit_reciente", "Superávit", c.region === "quebrada"
        ? "🚧 Vigilar drenajes urbanos, obras y escorrentía en caminos"
        : "🌱 Sin emergencia de forraje (esperar rebrote natural)"],
      [null, "sin_dato", "Sin dato", "Verificar en campo antes de asistir"],
    ] as const) {
      const l = structuredClone(lecturaCacheada(id)!);
      l.meteorologia!.precipitacionMm30d.climatologia = PISO_NORMAL_30D_MM;
      l.meteorologia!.precipitacionMm30d.porcentaje = pct;
      assert.equal(estadoHidrico(l), estado);
      const row = fila(c, l);
      assert.ok(row.includes(diagnostico));
      const accionCelda = row.match(/<td\b[^>]*>[\s\S]*?<\/td>/g)![5].replace(/<[^>]*>/g, "");
      assert.equal(accionCelda, accion);
      assert.ok(accionCelda.length <= 60);
    }
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
    assert.match(row, /Verificar en campo antes de asistir/);
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
