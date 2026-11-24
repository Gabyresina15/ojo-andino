import assert from "node:assert/strict";
import { test } from "node:test";
import { lecturaCacheada } from "../src/lib/cache";
import { getComunidad } from "../src/lib/comunidades";
import { urlWhatsAppInformeTecnico } from "../src/lib/whatsapp-informe-tecnico";

const origen = "https://ojo.example";

test("empaqueta las cifras cacheadas de Susques y el expediente absoluto en un mensaje de WhatsApp", () => {
  const susques = getComunidad("susques")!;
  const lectura = lecturaCacheada(susques.id)!;
  const url = new URL(urlWhatsAppInformeTecnico(susques, lectura, origen));
  assert.equal(url.origin + url.pathname, "https://wa.me/");
  assert.match(url.href, /%0A\*Estado%20h%C3%ADdrico%3A\*/);
  const texto = url.searchParams.get("text")!;
  assert.match(texto, /\*Ojo Andino · Informe técnico — Susques\*/);
  assert.match(texto, /Déficit hídrico/);
  assert.match(texto, /Lluvia de 30 días — NASA POWER:\* 8,7 mm vs\. 41,1 mm de referencia \(-78,9 %\)/);
  assert.match(texto, /0,083 \(compuesto del 2026-11-01, MODIS/);
  assert.match(texto, /Acción recomendada:\* Priorizar a Susques/);
  assert.ok(texto.endsWith(`*Informe completo:* ${origen}/municipio/susques`));
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
  const texto = new URL(urlWhatsAppInformeTecnico(comunidad, parcial, origen)).searchParams.get("text")!;
  assert.match(texto, /Sin datos suficientes/);
  assert.match(texto, /Lluvia de 30 días — NASA POWER/);
  assert.doesNotMatch(texto, /%|NDVI|Acción recomendada/);
  assert.ok(texto.endsWith(`${origen}/municipio/abra-pampa`));
});

test("publica las cifras de temporada cuando la temporada decide el estado", () => {
  const comunidad = getComunidad("abra-pampa")!;
  const lectura = structuredClone(lecturaCacheada(comunidad.id)!);
  const m = lectura.meteorologia!;
  m.precipitacionMm30d = { ...m.precipitacionMm30d, observado: 12.2, climatologia: 6.2, porcentaje: 96.8 };
  m.precipitacionTemporada = {
    observado: 361,
    climatologia: 456,
    porcentaje: -20.8,
    unidad: "mm",
    ventana: "01/12/2025–30/04/2026 (151 días con dato)",
    diasConDato: 151,
    enCurso: false,
  };
  const texto = new URL(urlWhatsAppInformeTecnico(comunidad, lectura, origen)).searchParams.get("text")!;
  assert.match(texto, /Déficit hídrico/);
  assert.match(texto, /Temporada de lluvias — NASA POWER:\* 361,0 mm vs\. 456,0 mm de referencia \(-20,8 %\)/);
  assert.ok(texto.includes(m.precipitacionTemporada.ventana));
  assert.doesNotMatch(texto, /Lluvia de 30 días|12,2 mm|96,8 %/);

  m.precipitacionTemporada = undefined;
  const sinTemporada = new URL(urlWhatsAppInformeTecnico(comunidad, lectura, origen)).searchParams.get("text")!;
  assert.match(sinTemporada, /época seca sin datos de temporada/);
  assert.doesNotMatch(sinTemporada, /NASA POWER|96,8 %|Acción recomendada/);
});
