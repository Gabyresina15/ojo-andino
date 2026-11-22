import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { alertaDeterminista } from "../src/lib/alerta";
import { lecturaCacheada } from "../src/lib/cache";
import { getComunidad } from "../src/lib/comunidades";
import { descargarPdfExpediente } from "../src/lib/pdf-expediente";
import type { AlertaRespuesta } from "../src/lib/types";

const volcan = getComunidad("volcan")!;
const lectura = lecturaCacheada(volcan.id)!;

function capturarTexto(t: TestContext, alerta?: AlertaRespuesta) {
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
    descargarPdfExpediente(volcan, lectura, alerta);
  } finally {
    jsPDF.API.events.pop();
  }
  return textos;
}

test("el dictamen de Volcán cabe a la fuente con la que se dibuja", (t) => {
  const textos = capturarTexto(t);
  const inicio = textos.findIndex(({ texto }) => texto.startsWith("En Volcán"));
  const fin = textos.findIndex(({ texto }) => texto.startsWith("2. DIRECTIVA"));
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
  const firma = textos.find(({ texto }) => texto.startsWith("DIRECCIÓN PROVINCIAL"));
  assert.ok(firma);
  assert.equal(firma.pagina, 2);
  const dias = textos.filter(({ texto }) => /^\d{2}\/\d{2}\/2026$/.test(texto));
  assert.equal(dias.length, 30);
  assert.ok(dias.every(({ pagina, y }) => pagina === firma.pagina && y < firma.y - 5));
});

function capturarQr(t: TestContext) {
  const textos: { texto: string; x: number; y: number; ancho: number }[] = [];
  const enlaces: { x: number; y: number; ancho: number; alto: number; url?: string }[] = [];
  const rects: { x: number; y: number; ancho: number; alto: number; estilo?: string | null }[] = [];
  const evento = ["initialized", function (this: jsPDF) {
    const dibujarTexto = this.text.bind(this);
    this.text = (texto, x, y, opciones, transformacion) => {
      for (const linea of Array.isArray(texto) ? texto : [texto]) {
        textos.push({ texto: linea, x, y, ancho: this.getTextWidth(linea) });
      }
      return dibujarTexto(texto, x, y, opciones, transformacion);
    };
    const enlazar = this.link.bind(this);
    this.link = (x, y, ancho, alto, opciones) => {
      enlaces.push({ x, y, ancho, alto, url: "url" in opciones ? opciones.url : undefined });
      return enlazar(x, y, ancho, alto, opciones);
    };
    const dibujarRect = this.rect.bind(this);
    this.rect = (x, y, ancho, alto, estilo) => {
      rects.push({ x, y, ancho, alto, estilo });
      return dibujarRect(x, y, ancho, alto, estilo);
    };
    t.mock.method(this, "save", () => this);
  }];
  jsPDF.API.events.push(evento);
  try {
    descargarPdfExpediente(volcan, lectura);
  } finally {
    jsPDF.API.events.pop();
  }
  return { textos, enlaces, rects };
}

test("el expediente lleva un QR que abre /municipio/[id] en la banda del encabezado", (t) => {
  const url = "https://ojo-andino.vercel.app/municipio/volcan";
  const { textos, enlaces, rects } = capturarQr(t);
  assert.equal(enlaces.length, 1);
  const qr = enlaces[0];
  assert.equal(qr.url, url);
  assert.ok(qr.y > 0 && qr.y + qr.alto < 32 && qr.x + qr.ancho <= 196);

  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const celda = qr.ancho / (modules.size + 4);
  const dibujados = new Set<string>();
  for (const r of rects) {
    if (r.estilo !== "F" || r.x < qr.x || r.y < qr.y || r.x >= qr.x + qr.ancho || r.y >= qr.y + qr.alto) continue;
    const fila = Math.round((r.y - qr.y) / celda) - 2;
    const col = Math.round((r.x - qr.x) / celda) - 2;
    for (let i = 0; i < Math.round(r.ancho / celda); i++) dibujados.add(`${fila},${col + i}`);
  }
  const esperados = new Set<string>();
  for (let fila = 0; fila < modules.size; fila++) {
    for (let col = 0; col < modules.size; col++) if (modules.get(fila, col)) esperados.add(`${fila},${col}`);
  }
  assert.deepEqual(dibujados, esperados);

  for (const { texto, x, y, ancho } of textos.filter(({ y }) => y <= qr.y + qr.alto)) {
    assert.ok(x + ancho < qr.x - 4, `El encabezado pisa el QR: ${texto}`);
  }
  const pie = textos.filter(({ y }) => y > 280);
  assert.ok(pie.some(({ texto }) => texto.includes(url)));
  for (const { texto, x, ancho } of pie) {
    assert.ok(x + ancho <= 196, `El pie excede el margen: ${texto}`);
  }
});
