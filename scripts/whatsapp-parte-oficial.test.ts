import assert from "node:assert/strict";
import { test } from "node:test";
import { lecturaCacheada } from "../src/lib/cache";
import { getComunidad } from "../src/lib/comunidades";
import { urlWhatsAppParteOficial } from "../src/lib/whatsapp-parte-oficial";

const origen = "https://ojo.example";

test("empaqueta las cifras cacheadas de Susques y el expediente absoluto en un mensaje de WhatsApp", () => {
  const susques = getComunidad("susques")!;
  const lectura = lecturaCacheada(susques.id)!;
  const url = new URL(urlWhatsAppParteOficial(susques, lectura, origen));
  assert.equal(url.origin + url.pathname, "https://wa.me/");
  assert.match(url.href, /%0A\*Estado%20h%C3%ADdrico%3A\*/);
  const texto = url.searchParams.get("text")!;
  assert.match(texto, /\*Ojo Andino · Parte Oficial — Susques\*/);
  assert.match(texto, /Déficit hídrico/);
  assert.match(texto, /8,7 mm vs\. 41,1 mm de referencia \(-78,9 %\)/);
  assert.match(texto, /0,083 \(compuesto del 2026-11-01, MODIS/);
  assert.match(texto, /Acción recomendada:\* Priorizar a Susques/);
  assert.ok(texto.endsWith(`${origen}/municipio/susques`));
});

test("no inventa una anomalía, un diagnóstico o un NDVI cuando faltan datos", () => {
  const comunidad = getComunidad("abra-pampa")!;
  const lectura = lecturaCacheada(comunidad.id)!;
  const meteorologia = lectura.meteorologia!;
  const parcial = {
    ...lectura,
    meteorologia: {
      ...meteorologia,
      precipitacionMm30d: { ...meteorologia.precipitacionMm30d, porcentaje: null },
    },
    ndvi: null,
  };
  const texto = new URL(urlWhatsAppParteOficial(comunidad, parcial, origen)).searchParams.get("text")!;
  assert.match(texto, /Sin datos suficientes/);
  assert.match(texto, /Lluvia — NASA POWER/);
  assert.doesNotMatch(texto, /%|NDVI|Acción recomendada/);
  assert.ok(texto.endsWith(`${origen}/municipio/abra-pampa`));
});
