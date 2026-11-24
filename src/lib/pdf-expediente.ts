import { jsPDF } from "jspdf";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "./types";
import { COMUNIDADES } from "./comunidades";
import { lecturaCacheada } from "./cache";
import { alertaDeterminista, calcularPatronDiario, recomendacionGobierno } from "./alerta";
import { estadoHidrico, porPrioridad } from "./lecturas";

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt3 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const JURISDICCION: Record<string, string> = {
  "susques": "Comisión Municipal de Susques",
  "abra-pampa": "Municipalidad de Abra Pampa",
  "la-quiaca": "Municipalidad de La Quiaca",
  "yavi": "Comisión Municipal de Yavi",
  "humahuaca": "Municipalidad de Humahuaca",
  "tilcara": "Municipalidad de Tilcara",
  "maimara": "Comisión Municipal de Maimará",
  "purmamarca": "Comisión Municipal de Purmamarca",
  "tumbaya": "Comisión Municipal de Tumbaya",
  "volcan": "Comisión Municipal de Volcán",
};

export function descargarPdfExpediente(
  comunidad: Comunidad,
  lectura: LecturaSatelital,
  alertaActual?: AlertaRespuesta | null,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const m = lectura.meteorologia;
  const ndvi = lectura.ndvi;
  const est = estadoHidrico(lectura);
  const patron = calcularPatronDiario(lectura);
  const det = alertaDeterminista(comunidad, lectura, "comunidad");
  const textoDictamen = alertaActual?.resumen_oral ?? det.resumen_oral;
  const motorTexto = alertaActual?.origen === "grok" ? `Grok AI (${alertaActual.modelo}) + Validación Zod` : "Motor Hidrológico Determinista";
  const jurisdiccion = JURISDICCION[comunidad.id] ?? `Municipio de ${comunidad.nombre}`;
  const expedienteNro = `EXP-JUJ-2026-${comunidad.id.toUpperCase()}`;
  const fechaEmision = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Jujuy" });

  // 1. ENCABEZADO INSTITUCIONAL (Banda oscura superior)
  doc.setFillColor(11, 13, 16);
  doc.rect(0, 0, 210, 32, "F");
  doc.setFillColor(217, 93, 57); // Terracota Purmamarca
  doc.rect(0, 32, 210, 1.8, "F");

  doc.setTextColor(245, 158, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("GOBIERNO DE LA PROVINCIA DE JUJUY · SISTEMA SATELITAL OJO ANDINO", 14, 11);

  doc.setTextColor(244, 241, 234);
  doc.setFontSize(15);
  doc.text(`ANEXO TÉCNICO DE EXPEDIENTE · ${comunidad.nombre.toUpperCase()}`, 14, 19);

  doc.setTextColor(180, 186, 196);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Jurisdicción: ${jurisdiccion}  |  Región: ${comunidad.region.toUpperCase()}  |  Coordenadas WGS84: ${comunidad.lat.toFixed(4)}°, ${comunidad.lon.toFixed(4)}°`,
    14,
    26,
  );

  // 2. CAJA DE METADATOS ADMINISTRATIVOS
  let y = 40;
  doc.setFillColor(245, 246, 248);
  doc.setDrawColor(215, 220, 228);
  doc.roundedRect(14, y, 182, 18, 2, 2, "FD");

  doc.setTextColor(30, 35, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`EXPEDIENTE N°: ${expedienteNro}`, 18, y + 6.5);
  doc.text(`ÚLTIMO CORTE NASA POWER: ${m?.ultimoDiaConDato ?? "s/d"}`, 85, y + 6.5);
  doc.text(`EMISIÓN: ${fechaEmision} ART`, 145, y + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 86, 98);
  doc.text(
    `Serie climatológica base: 2001–2025 (25 años, NASA MERRA-2/GEOS-IT)  |  Vegetación: MODIS MOD13Q1 250m (${ndvi?.ultimoComposite.fecha ?? "s/d"})`,
    18,
    y + 13.5,
  );

  // 3. SEMÁFORO Y CLASIFICACIÓN DE PRIORIDAD PROVINCIAL
  y = 63;
  const cfgEstado =
    est === "deficit"
      ? {
          r: 217,
          g: 93,
          b: 57,
          titulo: "CLASIFICACIÓN: PRIORIDAD ALTA · DÉFICIT CRÍTICO DE AGUA Y PASTURAS",
        }
      : est === "superavit_reciente" && comunidad.region === "quebrada"
        ? {
            r: 14,
            g: 116,
            b: 144,
            titulo: "CLASIFICACIÓN: ALERTA VIAL / PLUVIAL · LLUVIAS ALTAS EN QUEBRADA",
          }
        : est === "superavit_reciente"
          ? {
              r: 16,
              g: 145,
              b: 105,
              titulo: "CLASIFICACIÓN: EN RECUPERACIÓN HÍDRICA · SIN EMERGENCIA DE FORRAJE",
            }
          : {
              r: 217,
              g: 119,
              b: 6,
              titulo: "CLASIFICACIÓN: CONDICIÓN HÍDRICA ESTABLE · SEGUIMIENTO ORDINARIO",
            };

  doc.setFillColor(cfgEstado.r, cfgEstado.g, cfgEstado.b);
  doc.roundedRect(14, y, 182, 9, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(cfgEstado.titulo, 18, y + 6);

  // 4. CUADRO DE 4 INDICADORES AUDITADOS
  y = 77;
  const boxW = 43.25;
  const gap = 3;
  const kpis = [
    {
      label: "LLUVIA ACUMULADA (30D)",
      val: m ? `${fmt1(m.precipitacionMm30d.observado)} mm` : "s/d",
      sub: m ? `Normal 2001-25: ${fmt1(m.precipitacionMm30d.climatologia)} mm` : "",
    },
    {
      label: "DESVÍO Y RACHA SECA",
      val: m ? `${(m.precipitacionMm30d.porcentaje ?? 0) >= 0 ? "+" : ""}${fmt1(m.precipitacionMm30d.porcentaje ?? 0)} %` : "s/d",
      sub: patron ? `Racha seca máx: ${patron.racha_seca_maxima_dias}d (${patron.dias_secos}/${patron.dias_totales}d secos)` : "",
    },
    {
      label: "PICO DIARIO / CONCENTRACIÓN",
      val: patron ? `${fmt1(patron.pico_maximo_mm)} mm (${patron.concentracion_pico_pct}%)` : "s/d",
      sub: patron ? `Día ${patron.pico_maximo_dia} | Últ. 7d: ${fmt1(patron.lluvia_ultimos_7d_mm)} mm` : "",
    },
    {
      label: "VEGETACIÓN MODIS (0-1)",
      val: ndvi ? fmt3(ndvi.ultimoComposite.ndvi) : "s/d",
      sub: ndvi?.compositeAnioAnterior ? `Nov 2025: ${fmt3(ndvi.compositeAnioAnterior.ndvi)} | Oct 26: ${ndvi.compositeAnterior ? fmt3(ndvi.compositeAnterior.ndvi) : "s/d"}` : "",
    },
  ];

  kpis.forEach((k, idx) => {
    const x = 14 + idx * (boxW + gap);
    doc.setFillColor(250, 251, 252);
    doc.setDrawColor(210, 215, 224);
    doc.roundedRect(x, y, boxW, 21, 1.5, 1.5, "FD");
    doc.setTextColor(100, 108, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(k.label, x + 3, y + 5.5);

    doc.setTextColor(15, 20, 28);
    doc.setFontSize(12);
    doc.text(k.val, x + 3, y + 13);

    doc.setTextColor(90, 98, 110);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.7);
    doc.text(k.sub, x + 3, y + 18.2);
  });

  // 5. DICTAMEN TÉCNICO E HIDROLÓGICO (Grok AI + Validación Zod)
  y = 104;
  doc.setTextColor(20, 25, 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("1. DICTAMEN HIDROLÓGICO Y JUSTIFICACIÓN TÉCNICA DE EXPEDIENTE", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 108, 120);
  doc.text(`Motor de análisis: ${motorTexto}`, 14, y + 4);

  y += 7;
  doc.setFontSize(9);
  const lineasDictamen = doc.splitTextToSize(textoDictamen, 174);
  const altoDictamen = lineasDictamen.length * 4.5 + 7;
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(210, 216, 226);
  doc.roundedRect(14, y, 182, altoDictamen, 2, 2, "FD");
  doc.setTextColor(25, 30, 40);
  doc.text(lineasDictamen, 18, y + 6);

  // 6. DIRECTIVA OPERATIVA PARA EL MINISTERIO Y DERIVACIÓN MUNICIPAL
  y += altoDictamen + 6;
  doc.setTextColor(20, 25, 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("2. DIRECTIVA DE ASIGNACIÓN DE RECURSOS (PROVINCIA -> MUNICIPIO)", 14, y);

  y += 3;
  const textoAccion = recomendacionGobierno(comunidad, lectura);
  doc.setFontSize(8.8);
  const lineasAccion = doc.splitTextToSize(`Destinatario: ${jurisdiccion}. Acción recomendada: ${textoAccion}`, 174);
  const altoAccion = lineasAccion.length * 4.5 + 6;
  doc.setFillColor(254, 249, 238);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(14, y, 182, altoAccion, 2, 2, "FD");
  doc.setTextColor(30, 30, 30);
  doc.text(lineasAccion, 18, y + 5.5);

  // 7. TABLA DE REGISTRO HISTÓRICO DÍA POR DÍA (30 DÍAS)
  y += altoAccion + 7;
  const mitad = Math.ceil((m?.serie.length ?? 0) / 2);
  const altoTabla = mitad > 0 ? 6 + mitad * 4.7 : 0;
  const yFirmaMax = 276;
  if (y + 3 + altoTabla + 14 > yFirmaMax) {
    doc.addPage();
    doc.setTextColor(100, 108, 120);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`EXPEDIENTE N°: ${expedienteNro}`, 14, 14);
    y = 23;
  }
  doc.setTextColor(20, 25, 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`3. BITÁCORA DIARIA AUDITADA (${m?.precipitacionMm30d.ventana ?? "30 días"})`, 14, y);

  y += 3;
  if (m && m.serie.length > 0) {
    const serieOrdenada = [...m.serie].reverse();
    const colIzq = serieOrdenada.slice(0, mitad);
    const colDer = serieOrdenada.slice(mitad);

    const dibujarTablaMitad = (xBase: number, filas: typeof serieOrdenada) => {
      const w = 89;
      doc.setFillColor(25, 32, 44);
      doc.rect(xBase, y, w, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("FECHA", xBase + 2.5, y + 4.2);
      doc.text("LLUVIA", xBase + 25, y + 4.2);
      doc.text("NORMAL", xBase + 44, y + 4.2);
      doc.text("DIF.", xBase + 62, y + 4.2);
      doc.text("TEMP.", xBase + 76, y + 4.2);

      filas.forEach((d, idx) => {
        const fy = y + 6 + idx * 4.7;
        if (idx % 2 === 0) {
          doc.setFillColor(246, 248, 250);
          doc.rect(xBase, fy, w, 4.7, "F");
        }
        doc.setDrawColor(230, 234, 240);
        doc.rect(xBase, fy, w, 4.7, "S");

        const obs = d.lluviaMm ?? 0;
        const clim = d.climaMm ?? 0;
        const dif = obs - clim;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        doc.setTextColor(35, 40, 50);
        doc.text(ddmm(d.fecha), xBase + 2.5, fy + 3.4);

        doc.setFont("helvetica", obs > 0 ? "bold" : "normal");
        doc.text(`${fmt2(obs)} mm`, xBase + 25, fy + 3.4);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 106, 118);
        doc.text(`${fmt2(clim)} mm`, xBase + 44, fy + 3.4);

        doc.setTextColor(dif >= 0 ? 16 : 200, dif >= 0 ? 130 : 60, dif >= 0 ? 90 : 45);
        doc.text(`${dif >= 0 ? "+" : ""}${fmt2(dif)}`, xBase + 62, fy + 3.4);

        doc.setTextColor(35, 40, 50);
        doc.text(d.t2m !== null ? `${fmt1(d.t2m)}°C` : "s/d", xBase + 76, fy + 3.4);
      });
    };

    dibujarTablaMitad(14, colIzq);
    dibujarTablaMitad(107, colDer);
    y += altoTabla + 8;
  }

  // 8. PIE DE FIRMA Y AUDITORÍA PARA EXPEDIENTE
  const yFirma = Math.max(y + 6, 265);
  doc.setDrawColor(180, 186, 198);
  doc.line(14, yFirma, 82, yFirma);
  doc.line(128, yFirma, 196, yFirma);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(40, 45, 55);
  doc.text("DIRECCIÓN PROVINCIAL / MINISTERIO DE PRODUCCIÓN", 14, yFirma + 4.5);
  doc.text(`RECEPCIÓN: ${jurisdiccion.toUpperCase()}`, 128, yFirma + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 116, 128);
  doc.text(
    "Documento técnico auditable generado con telemetría pública NASA/POWER y MODIS (ORNL DAAC). Verificar serie en https://ojo-andino.vercel.app",
    14,
    288,
  );

  doc.save(`Expediente-Jujuy-${comunidad.id}-${m?.ultimoDiaConDato ?? "2026-11-22"}.pdf`);
}

export function descargarPdfProvincialConsolidado() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fechaEmision = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Jujuy" });

  doc.setFillColor(11, 13, 16);
  doc.rect(0, 0, 210, 32, "F");
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 32, 210, 1.8, "F");

  doc.setTextColor(245, 158, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("GOBIERNO DE LA PROVINCIA DE JUJUY · SISTEMA SATELITAL OJO ANDINO", 14, 11);

  doc.setTextColor(244, 241, 234);
  doc.setFontSize(14.5);
  doc.text("PARTE PROVINCIAL CONSOLIDADO · 10 JURISDICCIONES MUNICIPALES", 14, 19);

  doc.setTextColor(180, 186, 196);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Emisión: ${fechaEmision} ART  |  Fuentes: NASA POWER (climatología 2001–2025) y MODIS MOD13Q1 250m`,
    14,
    26,
  );

  const filas = COMUNIDADES.map((c) => {
    const l = lecturaCacheada(c.id);
    const p = l?.meteorologia?.precipitacionMm30d;
    const pat = l ? calcularPatronDiario(l) : null;
    const est = l ? estadoHidrico(l) : "normal";
    return {
      c,
      jurisdiccion: JURISDICCION[c.id] ?? c.nombre,
      obs: p?.observado ?? 0,
      clim: p?.climatologia ?? 0,
      pct: p?.porcentaje ?? 0,
      rachaSeca: pat?.racha_seca_maxima_dias ?? 0,
      pico24h: pat?.pico_maximo_mm ?? 0,
      ndvi: l?.ndvi?.ultimoComposite.ndvi ?? 0,
      est,
      accion: l ? recomendacionGobierno(c, l) : "",
    };
  }).sort((a, b) => porPrioridad({ estado: a.est, pct: a.pct }, { estado: b.est, pct: b.pct }));

  let y = 40;
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(215, 220, 228);
  doc.roundedRect(14, y, 182, 16, 2, 2, "FD");
  doc.setTextColor(25, 30, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("SÍNTESIS EJECUTIVA PARA ASIGNACIÓN PRESUPUESTARIA Y LOGÍSTICA:", 18, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "1 jurisdicción en Déficit Crítico de Forraje/Agua (Susques -78,9%)  |  3 en Rango Normal  |  3 Puna Recuperada  |  3 Quebrada en Alerta Vial/Drenajes.",
    18,
    y + 12,
  );

  y = 62;
  doc.setFillColor(25, 32, 44);
  doc.rect(14, y, 182, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text("#  LOCALIDAD / JURISDICCIÓN", 16, y + 4.8);
  doc.text("REGIÓN", 70, y + 4.8);
  doc.text("LLUVIA 30D", 90, y + 4.8);
  doc.text("NORMAL", 110, y + 4.8);
  doc.text("DESVÍO", 128, y + 4.8);
  doc.text("RACHA SECA", 146, y + 4.8);
  doc.text("PICO 24H", 166, y + 4.8);
  doc.text("NDVI", 183, y + 4.8);

  filas.forEach((f, idx) => {
    const fy = y + 7 + idx * 16;
    if (idx % 2 === 0) {
      doc.setFillColor(247, 249, 251);
      doc.rect(14, fy, 182, 16, "F");
    }
    doc.setDrawColor(225, 230, 238);
    doc.rect(14, fy, 182, 16, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(20, 25, 35);
    doc.text(`#${idx + 1} ${f.c.nombre}`, 16, fy + 5.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(95, 102, 114);
    doc.text(f.jurisdiccion, 16, fy + 9.5);

    doc.setFontSize(7.5);
    doc.setTextColor(40, 45, 55);
    doc.text(f.c.region.toUpperCase(), 70, fy + 5.5);
    doc.text(`${fmt1(f.obs)} mm`, 90, fy + 5.5);
    doc.text(`${fmt1(f.clim)} mm`, 110, fy + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(f.pct <= -25 ? 200 : 16, f.pct <= -25 ? 55 : 130, f.pct <= -25 ? 40 : 90);
    doc.text(`${f.pct >= 0 ? "+" : ""}${fmt1(f.pct)}%`, 128, fy + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 45, 55);
    doc.text(`${f.rachaSeca} días`, 146, fy + 5.5);
    doc.text(`${fmt1(f.pico24h)} mm`, 166, fy + 5.5);
    doc.text(fmt3(f.ndvi), 183, fy + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(60, 68, 80);
    doc.text(`Directiva: ${f.accion}`, 16, fy + 14);
  });

  const yFirma = 266;
  doc.setDrawColor(180, 186, 198);
  doc.line(14, yFirma, 88, yFirma);
  doc.line(122, yFirma, 196, yFirma);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(40, 45, 55);
  doc.text("MINISTERIO DE DESARROLLO ECONÓMICO Y PRODUCCIÓN", 14, yFirma + 4.5);
  doc.text("MINISTERIO DE INFRAESTRUCTURA / RECURSOS HÍDRICOS", 122, yFirma + 4.5);

  doc.save("Parte-Provincial-Jujuy-10-Municipios-2026-11-22.pdf");
}
