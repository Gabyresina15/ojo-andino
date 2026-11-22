import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ResolucionSatelital from "../src/components/ResolucionSatelital";

test("la referencia espacial distingue estimaciones regionales de verdor por píxel", () => {
  const html = renderToStaticMarkup(<ResolucionSatelital />);
  assert.match(html, /NASA POWER · Meteorología regional.*0,5° × 0,625°.*55 km de norte a sur.*misma celda.*no mediciones de una estación local/);
  assert.match(html, /MODIS MOD13Q1 · Vegetación local.*250 m.*por píxel.*ORNL TESViS.*compuesto de 16 días.*ni un promedio del municipio/);
});
