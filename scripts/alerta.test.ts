import assert from "node:assert/strict";
import { test } from "node:test";
import cache from "../src/data/cache-lecturas.json";
import { COMUNIDADES } from "../src/lib/comunidades";
import { AlertaSchema, alertaDeterminista, generarAlerta, payloadUsuario, SYSTEM_PROMPT, validarNumeros } from "../src/lib/alerta";
import { estadoHidrico, UMBRAL_DEFICIT_PCT, UMBRAL_SUPERAVIT_PCT } from "../src/lib/lecturas";
import type { LecturaSatelital } from "../src/lib/types";

const lecturas = cache as Record<string, LecturaSatelital>;
const modos = ["comunidad", "parametrico"] as const;

function verificar(c: (typeof COMUNIDADES)[number], l: LecturaSatelital) {
  for (const modo of modos) {
    const alerta = alertaDeterminista(c, l, modo);
    const payload = payloadUsuario(c, l, modo);
    assert.deepEqual(validarNumeros(`${alerta.resumen_oral} ${alerta.nota_parametrica} ${alerta.fuentes}`, payload).noVerificados, []);
    assert.equal(alerta.estado_hidrico, estadoHidrico(l));
    assert.ok(AlertaSchema.safeParse(alerta).success, JSON.stringify(alerta));
    assert.equal(payload.gatillo.estado, estadoHidrico(l));
    assert.equal(payload.gatillo.umbral_deficit_pct, UMBRAL_DEFICIT_PCT);
    assert.equal(payload.gatillo.umbral_superavit_pct, UMBRAL_SUPERAVIT_PCT);
    assert.equal(payload.gatillo.activado, ["deficit", "superavit_reciente"].includes(estadoHidrico(l)));
    assert.ok((modo === "parametrico" ? alerta.resumen_oral : alerta.nota_parametrica).includes(payload.recomendacion_base));
    assert.equal((alerta.resumen_oral.match(/% del total/g) ?? []).length, payload.patron_diario && estadoHidrico(l) !== "sin_dato" ? 1 : 0);
    if (l.ndvi) {
      assert.equal((alerta.resumen_oral.match(/índice de verdor/g) ?? []).length, 1);
      assert.ok(alerta.resumen_oral.includes(l.ndvi.ultimoComposite.fecha));
    } else {
      assert.doesNotMatch(alerta.resumen_oral, /índice de verdor/);
    }
    if (modo === "parametrico") {
      assert.match(alerta.resumen_oral, /Gatillo paramétrico/);
      assert.match(alerta.nota_parametrica, /gatillo/i);
      assert.doesNotMatch(alerta.resumen_oral + alerta.nota_parametrica, /verificá|revisá|cuidá|podés|tenés|fijate|avisá|priorizá|evitá|inspeccioná|registrá|monitoreá/i);
      if (alerta.estado_hidrico !== "sin_dato") {
        const umbral = alerta.estado_hidrico === "deficit" ? `${UMBRAL_DEFICIT_PCT} %`
          : alerta.estado_hidrico === "normal" ? `±${UMBRAL_SUPERAVIT_PCT} %` : `+${UMBRAL_SUPERAVIT_PCT} %`;
        assert.ok(alerta.resumen_oral.includes(umbral));
        assert.ok(alerta.nota_parametrica.includes(umbral));
      }
      assert.ok(!alerta.nota_parametrica.includes(payload.recomendacion_base));
      assert.doesNotMatch(alerta.resumen_oral, /Registrar inspección y necesidades/);
      for (const frase of alerta.nota_parametrica.split(/(?<=\.)\s+/)) {
        assert.ok(!alerta.resumen_oral.includes(frase), frase);
      }
      for (const etiqueta of ["Diagnóstico:", "Riesgo operativo:", "Recomendación:"]) {
        assert.ok(alerta.resumen_oral.includes(etiqueta));
      }
    }
    assert.doesNotMatch(alerta.resumen_oral + alerta.nota_parametrica, /% de pasto|porcentaje de past|\bSAR\b|SAOCOM|MOD13Q1|PRECTOTCORR|[*#\n]/i);
  }
}

for (const c of COMUNIDADES) {
  test(`salida determinista de ${c.nombre} en ambos modos`, () => verificar(c, lecturas[c.id]));
}

test("todos los estados y regiones, también sin serie o sin meteorología", () => {
  for (const region of ["puna", "quebrada"] as const) {
    const c = COMUNIDADES.find((c) => c.region === region)!;
    for (const porcentaje of [UMBRAL_DEFICIT_PCT, 0, UMBRAL_SUPERAVIT_PCT, null]) {
      const l = structuredClone(lecturas[c.id]);
      l.meteorologia!.precipitacionMm30d.porcentaje = porcentaje;
      verificar(c, l);
      l.meteorologia!.serie = [];
      verificar(c, l);
    }
    verificar(c, { ...lecturas[c.id], meteorologia: null, ndvi: null });
    const sinAnterior = structuredClone(lecturas[c.id]);
    sinAnterior.ndvi!.compositeAnterior = null;
    verificar(c, sinAnterior);
  }
});

test("el prompt conserva contrato, estructura y límites de evidencia", () => {
  for (const regla of [
    "Dictamen de Decisión Logística y Gatillo Paramétrico", "Diagnóstico:", "Riesgo operativo:",
    "Recomendación:", "estado_hidrico === estado_hidrico_calculado", "recomendacion_base",
    "números solo literalmente presentes en el payload", "sin markdown", "TTS", "WhatsApp",
    "% de pasto", "SAR de SAOCOM", "USD/ARS", "instituciones", "convenios", "sensores",
    "estaciones", "NASA POWER", "MODIS MOD13Q1", "PRECTOTCORR",
    "normal / puna", "normal / quebrada", "sin_dato / puna", "sin_dato / quebrada",
    "formal e impersonal, sin voseo", "El voseo se usa solo en modo comunidad",
  ]) assert.ok(SYSTEM_PROMPT.includes(regla), regla);
});

test("Grok válido conserva fuentes deterministas y número inventado fuerza fallback", async (t) => {
  const key = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = "dummy-test-key";
  t.after(() => {
    if (key === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = key;
  });
  for (const [i, inventado] of [false, true].entries()) {
    const c = COMUNIDADES[i];
    const l = lecturas[c.id];
    const det = alertaDeterminista(c, l, "parametrico");
    let llamadas = 0;
    t.mock.method(globalThis, "fetch", async () => {
      llamadas++;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          ...det,
          resumen_oral: det.resumen_oral + (inventado ? " Costo de 987654321 pesos." : ""),
          fuentes: "NASA POWER y MODIS",
        }) } }],
      }), { status: 200 });
    });
    const alerta = await generarAlerta(c, l, "parametrico");
    assert.equal(alerta.origen, inventado ? "determinista" : "grok");
    assert.equal(alerta.fuentes, det.fuentes);
    assert.equal(alerta.resumen_oral, det.resumen_oral);
    assert.equal(llamadas, inventado ? 2 : 1);
    if (inventado) assert.match(alerta.validacion.motivoFallback!, /987654321/);
    else assert.equal(alerta.validacion.motivoFallback, null);
    t.mock.restoreAll();
  }
});
