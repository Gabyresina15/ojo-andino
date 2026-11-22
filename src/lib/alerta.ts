import { z } from "zod";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "./types";
import { estadoHidrico } from "./lecturas";

export const AlertaSchema = z.object({
  resumen_oral: z.string().min(80).max(1600),
  estado_hidrico: z.enum(["deficit", "normal", "superavit_reciente", "sin_dato"]),
  nota_parametrica: z.string().min(15).max(700),
  fuentes: z.string().min(5).max(300),
});
export type AlertaLLM = z.infer<typeof AlertaSchema>;

const JSON_SCHEMA = {
  name: "alerta_ojo_andino",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["resumen_oral", "estado_hidrico", "nota_parametrica", "fuentes"],
    properties: {
      resumen_oral: {
        type: "string",
        description:
          "Prosa sin markdown para voz y WhatsApp. En parametrico: Diagnóstico, Riesgo operativo y Recomendación verificable. En comunidad: explicación directa del agua, pastoreo y cuidados locales. Interpretá racha y concentración sin inventar impactos observados.",
      },
      estado_hidrico: { type: "string", enum: ["deficit", "normal", "superavit_reciente", "sin_dato"] },
      nota_parametrica: {
        type: "string",
        description:
          "Acción anclada en recomendacion_base, sin contradecirla. En parametrico explicitá el gatillo y cómo verificar la decisión logística o presupuestaria; en comunidad indicá qué podés revisar o cuidar.",
      },
      fuentes: { type: "string", description: "Solo NASA POWER y MODIS MOD13Q1 y fechas disponibles en el payload." },
    },
  },
};

export const SYSTEM_PROMPT = `Sos analista de riesgo hídrico de Ojo Andino para Puna y Quebrada de Jujuy. Escribí en castellano argentino, con vos, sin adornos turísticos ni burocracia vacía.

Glosario del JSON de entrada:
pueblo y region ubican el análisis; modo define destinatario; fecha_hoy_art no es la fecha de medición. contexto es contexto local, no evidencia de condiciones actuales ni autorización para citar instituciones.
lluvia contiene ventana, acumulado observado, climatología, anomalía y último día con dato. estado_hidrico_calculado es la clasificación determinista.
patron_diario describe días secos (sin lluvia significativa), días de lluvia de 1 mm o más, racha seca máxima, lluvia reciente, pico diario, fecha y concentración del total en ese día. No permite afirmar intensidad horaria.
temperatura contiene media, referencia y diferencia térmica con signo; no supongas calor si la diferencia es negativa.
ndvi es índice de verdor con fechas de compuestos, no disponibilidad medida de forraje ni agua.
gatillo contiene umbral_deficit_pct, umbral_superavit_pct, estado y activado: déficit o superávit activan una señal del índice, no un pago automático ni una emergencia comprobada.
riesgo_operativo_foco orienta el riesgo territorial; escorrentia_concentrada indica concentración del pico >= 55, no una crecida observada.
recomendacion_base es la acción determinista según modo. Anclá nota_parametrica en ella: podés reformularla, nunca contradecirla.

Salida por modo:
parametrico: redactá un Dictamen de Decisión Logística y Gatillo Paramétrico. resumen_oral lleva las etiquetas en prosa "Diagnóstico: ... Riesgo operativo: ... Recomendación: ... Gatillo: ...". Diagnóstico interpreta estado, racha y concentración disponibles; Riesgo operativo distingue posibilidad de daño observado; Recomendación define una decisión logística/presupuestaria verificable. Después de Recomendación, explicitá en resumen_oral el estado del gatillo y el desvío frente al umbral disponible: ese texto se entrega por voz y WhatsApp sin la nota. nota_parametrica explica el gatillo y cómo verificar en campo o registro la decisión anclada en recomendacion_base, sin montos ni frases idénticas a resumen_oral.
comunidad: resumen_oral son frases claras, directas y respetuosas para familias que cuidan hacienda, pastoreo, vegas y aguadas. Explicá qué significa el patrón de lluvia y qué podés revisar; nota_parametrica da una acción práctica de recomendacion_base, sin lenguaje de expediente.

Tabla de decisión estado × región:
deficit / puna: riesgo de menor agua en aguadas y vegas y falta de forraje; priorizá asistencia de agua y forraje, verificando reservas y entregas.
deficit / quebrada: menor agua disponible; además revisá escorrentía y acceso vial si hay concentración; priorizá asistencia con registro de necesidades y accesos.
superavit_reciente / puna: posible recarga superficial, no garantía de rebrote ni de agua segura; evitá fletes de emergencia innecesarios, verificá aguadas y evolución del verdor.
superavit_reciente / quebrada: sin señal de sequía; riesgo de escorrentía, corte de trazas, badenes y caminos; inspeccioná drenajes y registrá transitabilidad.
normal / puna: balance cercano al histórico, no garantiza pasto; monitoreá aguadas, vegas y reservas sin operativo extraordinario.
normal / quebrada: balance cercano al histórico, no descarta escorrentía concentrada; control habitual de drenajes, badenes y caminos.
sin_dato / puna: no diagnostiques sequía ni normalidad; verificá agua y forraje en campo y recuperá datos antes de decidir.
sin_dato / quebrada: no diagnostiques sequía ni normalidad; verificá drenajes y accesos y recuperá datos antes de decidir.
Si escorrentia_concentrada es verdadero en Quebrada, advertí riesgo vial incluso con balance normal o déficit. Sin serie diaria, declará la limitación sin inventar rachas.

Reglas estrictas:
Respondé SOLO JSON del esquema, sin markdown, listas ni viñetas: resumen_oral se lee por TTS y se manda por WhatsApp.
estado_hidrico === estado_hidrico_calculado.
Usá números solo literalmente presentes en el payload; no calcules números, porcentajes nuevos ni conversiones.
Nunca traduzcas NDVI a "% de pasto" ni a porcentaje de pastura. Nunca afirmes disponer de imágenes SAR de SAOCOM.
No inventes precios USD/ARS, instituciones, convenios, sensores, estaciones ni fuentes. Solo NASA POWER y MODIS MOD13Q1.
No uses siglas como MOD13Q1 o PRECTOTCORR en resumen_oral ni nota_parametrica; las fuentes van en fuentes.
No infieras crecidas, cortes, rebrote o pérdidas comprobadas a partir de promedios o índices.`;

export type PatronDiario = {
  dias_totales: number;
  dias_con_lluvia_significativa: number;
  dias_secos: number;
  racha_seca_maxima_dias: number;
  lluvia_ultimos_7d_mm: number;
  pico_maximo_mm: number;
  pico_maximo_dia: string;
  concentracion_pico_pct: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function calcularPatronDiario(l: LecturaSatelital): PatronDiario | null {
  const serie = l.meteorologia?.serie;
  if (!serie || serie.length === 0) return null;

  let diasConLluvia = 0;
  let rachaActual = 0;
  let rachaMax = 0;
  let totalMm = 0;
  let pico = serie[0];

  for (const d of serie) {
    const mm = d.lluviaMm ?? 0;
    totalMm += mm;
    if (mm >= 1) {
      diasConLluvia++;
      rachaActual = 0;
    } else {
      rachaActual++;
      if (rachaActual > rachaMax) rachaMax = rachaActual;
    }
    if (mm > (pico.lluviaMm ?? 0)) pico = d;
  }

  const ult7 = serie.slice(-7).reduce((acc, d) => acc + (d.lluviaMm ?? 0), 0);
  const picoMm = pico?.lluviaMm ?? 0;
  const concPico = totalMm > 0.1 ? Math.round((picoMm / totalMm) * 100) : 0;
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  return {
    dias_totales: serie.length,
    dias_con_lluvia_significativa: diasConLluvia,
    dias_secos: serie.length - diasConLluvia,
    racha_seca_maxima_dias: rachaMax,
    lluvia_ultimos_7d_mm: r1(ult7),
    pico_maximo_mm: r1(picoMm),
    pico_maximo_dia: pico ? ddmm(pico.fecha) : "s/d",
    concentracion_pico_pct: concPico,
  };
}

export function payloadUsuario(c: Comunidad, l: LecturaSatelital, modo: "comunidad" | "parametrico") {
  const m = l.meteorologia;
  const patron = calcularPatronDiario(l);
  const deltaTemp = m ? r1(m.temperaturaC7d.mediaObservada - m.temperaturaC7d.climatologiaMes) : null;
  const anomaliaPct = m?.precipitacionMm30d.porcentaje != null ? r1(m.precipitacionMm30d.porcentaje) : null;

  const ndviUlt = l.ndvi?.ultimoComposite?.ndvi ?? null;
  const ndviAnt = l.ndvi?.compositeAnterior?.ndvi ?? null;
  const variacionNdviPct =
    ndviUlt != null && ndviAnt != null && Math.abs(ndviAnt) > 0.001
      ? r1(((ndviUlt - ndviAnt) / Math.abs(ndviAnt)) * 100)
      : null;

  return {
    pueblo: c.nombre,
    region: c.region,
    modo,
    fuentes_datos: {
      meteorologia: "NASA POWER, demora oficial 2–3 días",
      vegetacion: "MODIS MOD13Q1, compuesto de 16 días",
    },
    fecha_hoy_art: new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Jujuy" }),
    estado_hidrico_calculado: estadoHidrico(l),
    gatillo: {
      umbral_deficit_pct: -25,
      umbral_superavit_pct: 25,
      estado: estadoHidrico(l),
      activado: estadoHidrico(l) === "deficit" || estadoHidrico(l) === "superavit_reciente",
    },
    riesgo_operativo_foco: c.region === "puna" ? "forraje y agua de aguadas y vegas" : "escorrentía, corte de trazas, badenes y caminos",
    escorrentia_concentrada: patron != null && patron.concentracion_pico_pct >= 55,
    recomendacion_base: modo === "parametrico" ? recomendacionGobierno(c, l) : recomendacionComunidad(c, l),
    lluvia: m
      ? {
          ventana: m.precipitacionMm30d.ventana,
          observado_mm: r1(m.precipitacionMm30d.observado),
          climatologia_mm: r1(m.precipitacionMm30d.climatologia),
          anomalia_pct: anomaliaPct,
          ultimo_dia_con_dato: m.ultimoDiaConDato,
          climatologia_periodo: "2001–2025",
        }
      : null,
    patron_diario: patron,
    temperatura: m
      ? {
          ventana: m.temperaturaC7d.ventana,
          media_7d_c: r1(m.temperaturaC7d.mediaObservada),
          climatologia_mes_c: r1(m.temperaturaC7d.climatologiaMes),
          diferencia_termica_c: deltaTemp,
          mes: m.temperaturaC7d.mesClimatologico,
        }
      : null,
    ndvi: l.ndvi
      ? {
          ultimo: l.ndvi.ultimoComposite,
          anterior: l.ndvi.compositeAnterior,
          mismo_periodo_anio_anterior: l.ndvi.compositeAnioAnterior,
          variacion_vs_anterior_pct: variacionNdviPct,
        }
      : null,
    contexto: c.ficha.resumen,
  };
}

function numerosPermitidos(payload: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      const abs = Math.abs(v);
      out.push(v, abs, Math.round(abs), Math.floor(abs), Math.ceil(abs));
    } else if (typeof v === "string") {
      for (const m of v.matchAll(/\d+(?:[.,]\d+)?/g)) {
        const num = Number(m[0].replace(",", "."));
        if (Number.isFinite(num)) out.push(num, Math.round(num));
      }
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(walk);
    }
  };
  walk(payload);
  for (let i = 0; i <= 31; i++) out.push(i);
  out.push(100, 250, 2001, 2025, 2026, 2003);
  return out;
}

export function validarNumeros(texto: string, payload: unknown) {
  const permitidos = numerosPermitidos(payload);
  const encontrados = [...texto.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0]);
  const noVerificados = encontrados.filter((s) => {
    const n = Number(s.replace(",", "."));
    return !permitidos.some((a) => Math.abs(a - n) <= Math.max(0.11, Math.abs(a) * 0.015));
  });
  return {
    numerosEncontrados: encontrados.length,
    numerosVerificados: encontrados.length - noVerificados.length,
    noVerificados,
  };
}

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt3 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function recomendacionGobierno(c: Comunidad, l: LecturaSatelital): string {
  const est = estadoHidrico(l);
  if (est === "sin_dato") {
    return `Sin datos suficientes para decidir asistencia en ${c.nombre}. Verificar necesidades en campo y recuperar la lectura antes de autorizar un operativo.`;
  }
  if (est === "deficit") {
    return `Priorizar a ${c.nombre} en la asignación provincial de camiones de forraje (alfalfa) y asistencia de agua para productores.`;
  }
  if (est === "superavit_reciente" && c.region === "puna") {
    return `No priorizar envío de forraje de emergencia por este índice; verificar aguadas, reservas y rebrote en campo antes de reasignar fletes a zonas deficitarias.`;
  }
  if (est === "superavit_reciente" && c.region === "quebrada") {
    return `Sin emergencia por sequía. Por picos de lluvia en pendiente, se recomienda al Municipio inspeccionar drenajes urbanos, badenes, obras y caminos.`;
  }
  return `Condición hídrica dentro del promedio histórico. Mantener monitoreo municipal habitual sin operativo de emergencia.`;
}

export function recomendacionComunidad(c: Comunidad, l: LecturaSatelital): string {
  const est = estadoHidrico(l);
  if (est === "sin_dato") {
    return `Faltan datos para ${c.nombre}: revisá las aguadas y la hacienda y avisá si falta agua o forraje; no des por hecho que el campo está bien.`;
  }
  if (est === "deficit") {
    return `Cuidar las aguadas y vegas disponibles en ${c.nombre}, racionar reservas de pasto y coordinar con la comisión municipal el pedido de forraje y agua.`;
  }
  if (est === "superavit_reciente" && c.region === "puna") {
    return `Aprovechar la humedad reciente en los campos de ${c.nombre} para cuidar el rebrote natural del pastizal antes de sobrecargar las vegas.`;
  }
  if (est === "superavit_reciente" && c.region === "quebrada") {
    return `Precaución en ${c.nombre} por crecidas repentinas en quebradas, badenes y acequias tras lluvias fuertes en pocas horas.`;
  }
  return `La lluvia en ${c.nombre} está cerca del promedio; revisá igual las aguadas, las vegas y las reservas de pasto antes de mover la hacienda.`;
}

export function alertaDeterminista(c: Comunidad, l: LecturaSatelital, modo: "comunidad" | "parametrico"): AlertaLLM {
  const m = l.meteorologia;
  const est = estadoHidrico(l);
  const patron = calcularPatronDiario(l);
  const esComunidad = modo === "comunidad";
  const partes: string[] = [];
  if (est === "sin_dato") {
    partes.push(`En ${c.nombre} faltan datos para clasificar el balance de lluvia; no se puede afirmar sequía ni normalidad.`);
  } else if (m) {
    if (est === "superavit_reciente" && c.region === "quebrada" && patron) {
      partes.push(`En ${c.nombre} la lluvia acumulada superó el promedio histórico, con ${patron.dias_con_lluvia_significativa} días de lluvia de 1 mm o más, un pico de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia} (${patron.concentracion_pico_pct} % del total en un solo día) y ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en la última semana.`);
    } else {
      const balance = est === "deficit" ? "quedó por debajo del promedio histórico" : est === "superavit_reciente" ? "superó el promedio histórico" : "estuvo cerca del promedio histórico";
      partes.push(`En ${c.nombre} la lluvia acumulada ${balance}.`);
    }
    if (patron) {
      partes.push(`Hubo ${patron.dias_secos} días sin lluvia de 1 mm o más y una racha seca máxima de ${patron.racha_seca_maxima_dias} días.`);
      if (!(est === "superavit_reciente" && c.region === "quebrada")) {
        partes.push(`El pico fue de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia} (${patron.concentracion_pico_pct} % del total en un solo día), con ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en la última semana.`);
      }
    }
    const delta = r1(m.temperaturaC7d.mediaObservada - m.temperaturaC7d.climatologiaMes);
    partes.push(`La temperatura estuvo ${fmt1(Math.abs(delta))} °C ${delta >= 0 ? "por encima" : "por debajo"} de la referencia.`);
  }
  if (!patron) partes.push("Sin serie diaria suficiente para evaluar rachas y concentración.");
  if (l.ndvi) {
    const actual = l.ndvi.ultimoComposite;
    const anterior = l.ndvi.compositeAnterior;
    partes.push(anterior
      ? `El índice de verdor pasó de ${fmt3(anterior.ndvi)} a ${fmt3(actual.ndvi)} (compuesto al ${actual.fecha}).`
      : `El índice de verdor es ${fmt3(actual.ndvi)} (compuesto al ${actual.fecha}).`);
  }
  const riesgo = c.region === "puna"
    ? est === "deficit"
      ? "Puede faltar forraje y agua en aguadas y vegas; verificá reservas y estado de la hacienda."
      : est === "superavit_reciente"
        ? "La lluvia puede recargar aguadas y vegas, pero no garantiza forraje disponible; cuidá el rebrote antes de aumentar el pastoreo."
        : "Revisá agua de aguadas y vegas y reservas de forraje; el balance de lluvia no alcanza para asegurar su disponibilidad."
    : est === "superavit_reciente" || (patron != null && patron.concentracion_pico_pct >= 55)
      ? "Hay riesgo de escorrentía y corte de trazas, badenes y caminos; verificá accesos antes de trasladar hacienda o insumos, sin dar por comprobadas crecidas."
      : "Revisá drenajes, badenes y caminos antes de trasladar hacienda o insumos; no hay evidencia suficiente para afirmar cortes.";

  const accion = esComunidad ? recomendacionComunidad(c, l) : recomendacionGobierno(c, l);
  const p = m?.precipitacionMm30d;
  const desvioRedondeado = p?.porcentaje != null ? r1(p.porcentaje) : 0;
  const desvio = `${desvioRedondeado >= 0 ? "+" : ""}${fmt1(desvioRedondeado)} %`;
  const gatillo = est === "sin_dato"
    ? "Gatillo no evaluable: sin dato de lluvia."
    : est === "normal"
      ? `Gatillo no activado: desvío ${desvio} dentro de ±25 %.`
      : `Gatillo de ${est === "deficit" ? "déficit" : "exceso hídrico"} activado: desvío ${desvio} frente al umbral de ${est === "deficit" ? "-25" : "+25"} %; señal del índice, no pago automático.`;
  const verificacion = c.region === "puna"
    ? "Verificar en campo aguadas y reservas de forraje y dejar registro."
    : "Verificar drenajes y transitabilidad de badenes y dejar registro.";
  const gatilloOral = est === "sin_dato"
    ? "Gatillo: no se puede evaluar sin dato de lluvia."
    : est === "normal"
      ? `Gatillo: sin activación, con desvío ${desvio} dentro de ±25 %.`
      : `Gatillo: de ${est === "deficit" ? "déficit" : "exceso hídrico"} activado (desvío ${desvio} frente a ${est === "deficit" ? "-25" : "+25"} %).`;
  const nota = esComunidad
    ? accion
    : `${gatillo} ${verificacion}`;

  return {
    resumen_oral: esComunidad
      ? `${partes.join(" ")} ${riesgo}`
      : `Diagnóstico: ${partes.join(" ")} Riesgo operativo: ${riesgo} Recomendación: ${accion} ${gatilloOral}`,
    estado_hidrico: est,
    nota_parametrica: p && est !== "sin_dato"
      ? esComunidad
        ? `${nota} (Ventana: ${p.ventana}, desvío ${desvio} vs serie 2001–2025).`
        : `${nota} (Ventana: ${p.ventana}).`
      : nota,
    fuentes: `NASA POWER (corte ${m?.ultimoDiaConDato ?? "s/d"}, demora oficial 2–3 días) y MODIS MOD13Q1 (compuesto 16 días al ${l.ndvi?.ultimoComposite.fecha ?? "s/d"}).`,
  };
}

// Caché en memoria + deduplicación de requests en vuelo para sobrevivir cortes de Starlink en el tren
const alertaCache = new Map<string, { exp: number; data: AlertaRespuesta }>();
const inflightRequests = new Map<string, Promise<AlertaRespuesta>>();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function llamarGrok(payload: unknown, conSchema: boolean): Promise<{ data: unknown; modelo: string }> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("Falta XAI_API_KEY");
  const modelo = process.env.XAI_MODEL || "grok-4.20-0309-non-reasoning";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9500);
  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.1,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        ...(conSchema ? { response_format: { type: "json_schema", json_schema: JSON_SCHEMA } } : {}),
      }),
    });
    if (!r.ok) throw new Error(`xAI HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const content: string = j.choices?.[0]?.message?.content ?? "";
    const limpio = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return { data: JSON.parse(limpio), modelo: j.model ?? modelo };
  } finally {
    clearTimeout(t);
  }
}

async function ejecutarGeneracion(
  c: Comunidad,
  l: LecturaSatelital,
  modo: "comunidad" | "parametrico",
): Promise<AlertaRespuesta> {
  const payload = payloadUsuario(c, l, modo);
  const estadoReal = estadoHidrico(l);
  let motivo: string | null = null;

  for (const conSchema of [true, false]) {
    try {
      const { data, modelo } = await llamarGrok(payload, conSchema);
      const parsed = AlertaSchema.safeParse(data);
      if (!parsed.success) {
        motivo = `Zod rechazó la salida: ${parsed.error.issues[0]?.message}`;
        continue;
      }
      const det = alertaDeterminista(c, l, modo);
      const notaFinal = parsed.data.nota_parametrica.trim().length >= 20 ? parsed.data.nota_parametrica : det.nota_parametrica;
      const v = validarNumeros(`${parsed.data.resumen_oral} ${notaFinal}`, payload);
      if (v.noVerificados.length > 0) {
        motivo = `Grok usó números que no están en la fuente: ${v.noVerificados.join(", ")}`;
        continue;
      }
      const corregido = parsed.data.estado_hidrico !== estadoReal;
      return {
        comunidadId: c.id,
        modo,
        ...parsed.data,
        nota_parametrica: notaFinal,
        fuentes: det.fuentes,
        estado_hidrico: estadoReal,
        origen: "grok",
        modelo,
        validacion: { ...v, estadoCorregido: corregido, motivoFallback: null },
        generadoEn: new Date().toISOString(),
      };
    } catch (e) {
      const err = e as Error;
      motivo = err.name === "AbortError" ? "Timeout xAI (>9.5s) — fallback determinista activo" : err.message;
      if (
        motivo.includes("Falta XAI_API_KEY") ||
        err.name === "AbortError" ||
        motivo.includes("fetch failed") ||
        motivo.includes("HTTP 401") ||
        motivo.includes("HTTP 429")
      ) {
        break;
      }
    }
  }

  const det = alertaDeterminista(c, l, modo);
  const v = validarNumeros(`${det.resumen_oral} ${det.nota_parametrica}`, payload);
  return {
    comunidadId: c.id,
    modo,
    ...det,
    origen: "determinista",
    modelo: null,
    validacion: { ...v, estadoCorregido: false, motivoFallback: motivo },
    generadoEn: new Date().toISOString(),
  };
}

export async function generarAlerta(
  c: Comunidad,
  l: LecturaSatelital,
  modo: "comunidad" | "parametrico",
): Promise<AlertaRespuesta> {
  const corte = l.meteorologia?.ultimoDiaConDato ?? "sin-corte";
  const cacheKey = `${c.id}:${modo}:${corte}`;

  const hit = alertaCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) {
    return hit.data;
  }

  const pending = inflightRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const promise = ejecutarGeneracion(c, l, modo)
    .then((res) => {
      const ttl = res.origen === "grok" ? CACHE_TTL_MS : 30_000;
      alertaCache.set(cacheKey, { exp: Date.now() + ttl, data: res });
      return res;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, promise);
  return promise;
}
