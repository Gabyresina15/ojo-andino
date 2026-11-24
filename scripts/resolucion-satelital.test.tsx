import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ResolucionSatelital from "../src/components/ResolucionSatelital";

test("la referencia espacial distingue estimaciones regionales de verdor por píxel", () => {
  for (const producto of ["MYD13Q1", "MOD13Q1"] as const) {
    const html = renderToStaticMarkup(<ResolucionSatelital producto={producto} />);
    assert.match(html, /NASA POWER · Meteorología regional.*0,5° × 0,625°.*55 km de norte a sur.*misma celda.*no mediciones de una estación local/);
    assert.ok(html.includes(`MODIS ${producto} · Vegetación local`));
    assert.match(html, /250 m.*por píxel.*ORNL TESViS.*compuesto de 16 días.*ni un promedio del municipio/);
  }
});
