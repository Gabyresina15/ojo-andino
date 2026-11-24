import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { jsPDF } from "jspdf";
import { alertaDeterminista } from "../src/lib/alerta";
import { lecturaCacheada } from "../src/lib/cache";
import { getComunidad } from "../src/lib/comunidades";
import { descargarPdfExpediente, descargarPdfProvincialConsolidado } from "../src/lib/pdf-expediente";
import type { AlertaRespuesta } from "../src/lib/types";

const volcan = getComunidad("volcan")!;
const lectura = lecturaCacheada(volcan.id)!;

function capturarTexto(t: TestContext, alerta?: AlertaRespuesta, generar?: () => void) {
  const textos: { texto: string; ancho: number; pagina: number; y: number }[] = [];
  const evento = ["initialized", function (this: jsPDF) {
    const dibujar = this.text.bind(this);
    this.text = (texto, x, y, opciones, transformacion) => {
      for (const linea of Array.isArray(texto) ? texto : [texto]) {
        textos.push({
          texto: linea,
          ancho: this.getTextWidth(linea),
          pagina: this.getNumberOfPages(),
          y,
        });
      }
      return dibujar(texto, x, y, opciones, transformacion);
    };
    t.mock.method(this, "save", () => this);
  }];
  jsPDF.API.events.push(evento);
  try {
    if (generar) generar();
    else descargarPdfExpediente(volcan, lectura, alerta);
  } finally {
    jsPDF.API.events.pop();
  }
  return textos;
}

test("el dictamen de Volcán cabe a la fuente con la que se dibuja", (t) => {
  const textos = capturarTexto(t);
  const inicio = textos.findIndex(({ texto }) => texto.startsWith("En Volcán"));
  const fin = textos.findIndex(({ texto }) => texto.startsWith("2. RECOMENDACIÓN"));
  assert.ok(inicio >= 0 && fin > inicio);
  const dictamen = textos.slice(inicio, fin);
  assert.match(dictamen.map(({ texto }) => texto).join(" "), /38,1 mm en la última semana/);
  for (const { texto, ancho } of dictamen) {
    assert.ok(ancho <= 174, `La línea excede el ancho del cuadro: ${texto}`);
  }
  assert.equal(textos.find(({ texto }) => texto === "19/11/2026")?.pagina, 1);
});

test("la bitácora pasa de página si un dictamen largo dejaría poco espacio", (t) => {
  const resumen = "El municipio puede revisar los caminos rurales y drenajes en temporada de lluvia. ".repeat(14).trim();
  const textos = capturarTexto(t, {
    ...alertaDeterminista(volcan, lectura, "comunidad"),
    resumen_oral: resumen,
    generadoEn: lectura.generadoEn,
    comunidadId: volcan.id,
    origen: "grok",
    modo: "comunidad",
    modelo: "grok-4.7",
    validacion: {
      numerosEncontrados: 0,
      numerosVerificados: 0,
      noVerificados: [],
      estadoCorregido: false,
      motivoFallback: null,
    },
  });
  const firma = textos.find(({ texto }) => texto.startsWith("ELABORÓ: OJO ANDINO"));
  assert.ok(firma);
  assert.equal(firma.pagina, 2);
  const dias = textos.filter(({ texto }) => /^\d{2}\/\d{2}\/2026$/.test(texto));
  assert.equal(dias.length, 30);
  assert.ok(dias.every(({ pagina, y }) => pagina === firma.pagina && y < firma.y - 5));
});

test("las recomendaciones del informe consolidado no pasan el margen derecho", (t) => {
  const susques = structuredClone(lecturaCacheada("susques")!);
  susques.meteorologia!.precipitacionMm30d = { observado: 80, climatologia: 40, porcentaje: 100 };
  const textos = capturarTexto(t, undefined, () => descargarPdfProvincialConsolidado({ susques }));
  const recomendaciones = textos.filter(({ texto }) => texto.startsWith("Recomendación: "));
  assert.equal(recomendaciones.length, 10);
  assert.ok(recomendaciones.some(({ texto }) => texto.includes("No requiere envío de forraje")));
  for (const { texto, ancho } of recomendaciones) {
    assert.ok(ancho <= 178, `La recomendación excede el ancho de la fila: ${texto}`);
  }
});
