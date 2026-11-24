import { z } from "zod";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "./types";
import { anomaliaDelEstado, baseEstado, estadoHidrico } from "./lecturas";

export const AlertaSchema = z.object({
  resumen_oral: z.string().min(80).max(1200),
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
          "Dictamen de 4 a 5 oraciones adaptado al modo ('comunidad' para productores/pueblo o 'parametrico' para gestión pública/aseguradoras). Analiza distribución diaria (días secos, racha seca máxima, pico diario y concentración) y su impacto real en terreno.",
      },
      estado_hidrico: { type: "string", enum: ["deficit", "normal", "superavit_reciente", "sin_dato"] },
      nota_parametrica: {
        type: "string",
        description:
          "1 a 2 oraciones con recomendación accionable concreta (manejo de agua/forraje para comunidad, o directiva logística/gatillo paramétrico para Gobierno).",
      },
      fuentes: { type: "string", description: "Fuentes satelitales y fecha del último dato." },
    },
  },
};

export const SYSTEM_PROMPT = `Sos el Analista Principal de Riesgo Hídrico, Agroclimático y Territorial de Ojo Andino en Jujuy (Puna y Quebrada de Humahuaca).

Tu trabajo NO es repetir de memoria los promedios que ya muestran las tarjetas superiores. Tu trabajo es interpretar el régimen diario de los últimos 30 días ("patron_diario"), la racha seca consecutiva, la temperatura y la vegetación ("ndvi") según el campo "modo":

1. ADAPTACIÓN POR "modo":
   - Si modo === "comunidad": hablá directo, claro y respetuoso a familias productoras, pastores y referentes comunitarios. Explicá qué significa la lluvia y el estado del pastizal para las aguadas, el ganado (llamas, ovejas, cabras) o los cultivos, integrando de forma natural el contexto cultural local ("contexto") sin jerga burocrática ni menciones a ministerios o expedientes.
   - Si modo === "parametrico": redactá un dictamen técnico de expediente y gatillo paramétrico para el Gobierno de Jujuy (Producción, Recursos Hídricos, Vialidad) y Municipios, justificando asignación de fletes de forraje, alertas viales/drenajes o activación de asistencia.

2. ANÁLISIS HIDROLÓGICO OBLIGATORIO EN "resumen_oral" (4 a 5 oraciones en castellano de Argentina):
   - Citá el comportamiento interno del mes usando "patron_diario": cuántos días estuvieron secos ("dias_secos"), cuál fue la racha seca consecutiva más larga ("racha_seca_maxima_dias"), cuánto cayó en los últimos 7 días ("lluvia_ultimos_7d_mm") y el pico máximo en 24h ("pico_maximo_mm" el "pico_maximo_dia", que representa "concentracion_pico_pct"% del agua del mes).
   - Cruzalo con "region" y "estado_hidrico_calculado":
     * deficit: días secos seguidos + anomalía térmica aceleran evaporación de aguadas y frenan rebrote del pastizal -> urgencia de agua y forraje.
     * superavit_reciente en puna: recarga superficial tras meses secos -> monitorear rebrote natural y evitar gasto innecesario de fardos de emergencia.
     * superavit_reciente en quebrada (o concentracion_pico_pct >= 55% en pendiente): lluvia concentrada en pocas horas genera escorrentía rápida -> alerta de drenajes, badenes, caminos rurales y obras.
     * normal: acompaña el ciclo histórico de inicio de temporada húmeda.
   - Si "estado_basado_en" es "temporada_lluvias" o "epoca_seca_sin_temporada", es época seca: lo normal en 30 días es casi cero y "lluvia.anomalia_pct" NO indica ni sequía ni exceso; no la cites como señal. Con "temporada_lluvias", explicá el estado con "temporada_lluvias" (observado_mm, climatologia_mm, anomalia_pct): de esa lluvia dependen las pasturas y aguadas hasta la próxima temporada.

3. REGLAS ANTI-ALUCINACIÓN (ESTRICTO):
   - Respondé SOLO con el JSON del esquema. Cero markdown.
   - PROHIBIDO meter siglas técnicas como "MOD13Q1" o "PRECTOTCORR" dentro de "resumen_oral" (van solo en "fuentes").
   - PROHIBIDO inventar números o calcular porcentajes nuevos: usá exclusivamente las cifras exactas presentes en el JSON del usuario.
   - "estado_hidrico" DEBE ser idéntico a "estado_hidrico_calculado".`;

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
    fecha_hoy_art: new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Jujuy" }),
    estado_hidrico_calculado: estadoHidrico(l),
    estado_basado_en: baseEstado(l),
    temporada_lluvias: m?.precipitacionTemporada
      ? {
          ventana: m.precipitacionTemporada.ventana,
          en_curso: m.precipitacionTemporada.enCurso,
          observado_mm: r1(m.precipitacionTemporada.observado),
          climatologia_mm: r1(m.precipitacionTemporada.climatologia),
          anomalia_pct: m.precipitacionTemporada.porcentaje,
        }
      : null,
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
  if (est === "deficit") {
    return `Priorizar a ${c.nombre} en la asignación provincial de camiones de forraje (alfalfa) y asistencia de agua para productores.`;
  }
  if (est === "superavit_reciente" && c.region === "puna") {
    return `No requiere envío de forraje de emergencia esta semana: las lluvias recientes permiten esperar el rebrote natural y reasignar fletes a zonas deficitarias.`;
  }
  if (est === "superavit_reciente" && c.region === "quebrada") {
    return `Sin emergencia por sequía. Por picos de lluvia en pendiente, se recomienda al Municipio inspeccionar drenajes urbanos, badenes, obras y caminos.`;
  }
  return `Condición hídrica dentro del promedio histórico. Mantener monitoreo municipal habitual sin operativo de emergencia.`;
}

export function recomendacionComunidad(c: Comunidad, l: LecturaSatelital): string {
  const est = estadoHidrico(l);
  if (est === "deficit") {
    return `Cuidar las aguadas y vegas disponibles en ${c.nombre}, racionar reservas de pasto y coordinar con la comisión municipal el pedido de forraje y agua.`;
  }
  if (est === "superavit_reciente" && c.region === "puna") {
    return `Aprovechar la humedad reciente en los campos de ${c.nombre} para cuidar el rebrote natural del pastizal antes de sobrecargar las vegas.`;
  }
  if (est === "superavit_reciente" && c.region === "quebrada") {
    return `Precaución en ${c.nombre} por crecidas repentinas en quebradas, badenes y acequias tras lluvias fuertes en pocas horas.`;
  }
  return `Las lluvias y pasturas en ${c.nombre} siguen el ritmo esperado para esta época del año; mantener el manejo habitual de aguadas y rodeos.`;
}

export function alertaDeterminista(c: Comunidad, l: LecturaSatelital, modo: "comunidad" | "parametrico"): AlertaLLM {
  const m = l.meteorologia;
  const est = estadoHidrico(l);
  const patron = calcularPatronDiario(l);
  const partes: string[] = [];
  const esComunidad = modo === "comunidad";
  const porTemporada = baseEstado(l) === "temporada_lluvias";
  const t = m?.precipitacionTemporada;

  if (m && patron) {
    const deltaTemp = fmt1(Math.abs(m.temperaturaC7d.mediaObservada - m.temperaturaC7d.climatologiaMes));
    const ndviAct = l.ndvi ? fmt3(l.ndvi.ultimoComposite.ndvi) : null;
    const ndviPrev = l.ndvi?.compositeAnterior ? fmt3(l.ndvi.compositeAnterior.ndvi) : null;

    if (est === "deficit" && porTemporada && t) {
      partes.push(
        `En ${c.nombre} la temporada de lluvias (${t.ventana}) dejó ${fmt1(t.observado)} mm frente a ${fmt1(t.climatologia)} mm de lo normal, un ${fmt1(Math.abs(t.porcentaje ?? 0))} % menos.`,
      );
      partes.push(
        `Ahora es época seca: en los últimos ${patron.dias_totales} días hubo ${patron.dias_secos} días sin lluvia útil y cayeron ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en la última semana, que no alcanzan para recuperar pasturas ni aguadas${ndviAct ? ` (índice verde ${ndviAct})` : ""}.`,
      );
      if (!esComunidad) {
        partes.push(
          `Gatillo operativo: se justifica priorizar a ${c.nombre} en el despacho de alfalfa y agua de emergencia.`,
        );
      }
    } else if (est === "deficit") {
      partes.push(
        esComunidad
          ? `Reporte para ${c.nombre}: en los últimos ${patron.dias_totales} días hubo ${patron.dias_secos} días sin lluvia útil, con una racha seca de ${patron.racha_seca_maxima_dias} días seguidos y apenas ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en la última semana.`
          : `Análisis de régimen diario para ${c.nombre}: de ${patron.dias_totales} días evaluados, ${patron.dias_secos} fueron secos (racha máxima de ${patron.racha_seca_maxima_dias} días seguidos sin lluvia >= 1 mm; máximo diario de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia}).`,
      );
      partes.push(
        `Con ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en 7 días y temperatura ${deltaTemp} °C sobre lo normal, aumenta la evaporación de aguadas y el pastizal sigue bajo${ndviAct ? ` (índice verde ${ndviAct})` : ""}.`,
      );
      if (!esComunidad) {
        partes.push(
          `Gatillo operativo: se justifica priorizar a ${c.nombre} en el despacho de alfalfa y agua de emergencia.`,
        );
      }
    } else if (est === "superavit_reciente" && c.region === "puna") {
      partes.push(
        `En ${c.nombre} se registraron ${patron.dias_con_lluvia_significativa} días con lluvia activa, acumulando ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en los últimos 7 días con un pico de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia}.`,
      );
      partes.push(
        ndviAct && ndviPrev
          ? `Esta recarga de humedad mejora la condición del campo respecto al corte previo (${ndviPrev} a ${ndviAct}).`
          : `Esta recarga de humedad superficial favorece el rebrote natural del pastizal en la Puna.`,
      );
      if (!esComunidad) {
        partes.push(
          `Gatillo operativo: no requiere fardos de emergencia esta semana; conviene reasignar fletes hacia zonas con déficit activo.`,
        );
      }
    } else if (est === "superavit_reciente" && c.region === "quebrada") {
      partes.push(
        `En ${c.nombre} la lluvia acumulada superó el promedio histórico, con ${patron.dias_con_lluvia_significativa} días de lluvia de 1 mm o más, un pico de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia} (${patron.concentracion_pico_pct} % del total en un solo día) y ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en la última semana.`,
      );
      partes.push(
        `En terreno de Quebrada, esa concentración en pocas horas genera escorrentía rápida sobre laderas, badenes y caminos.`,
      );
      if (!esComunidad) {
        partes.push(
          `Gatillo operativo: sin sequía activa; priorizar limpieza preventiva de drenajes pluviales y control vial.`,
        );
      }
    } else {
      partes.push(
        `En ${c.nombre} la lluvia se repartió en ${patron.dias_con_lluvia_significativa} días activos (pico de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia} y ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en los últimos 7 días).`,
      );
      partes.push(
        porTemporada && t
          ? `Es época seca y la última temporada de lluvias (${t.ventana}) dejó ${fmt1(t.observado)} mm frente a ${fmt1(t.climatologia)} mm de lo normal: no hay señal de déficit.`
          : baseEstado(l) === "epoca_seca_sin_temporada"
            ? `Es época seca: con una normal tan baja, la lluvia de 30 días no alcanza para indicar ni sequía ni exceso.`
            : `El balance hídrico acompaña el promedio histórico de los últimos 25 años para el inicio de la temporada húmeda.`,
      );
    }
  } else {
    partes.push(`Sin serie diaria suficiente para ${c.nombre}.`);
  }

  const accion = esComunidad ? recomendacionComunidad(c, l) : recomendacionGobierno(c, l);
  const p = anomaliaDelEstado(l);
  const desvioRedondeado = p?.porcentaje != null ? r1(p.porcentaje) : 0;

  return {
    resumen_oral: partes.join(" "),
    estado_hidrico: est,
    nota_parametrica: p
      ? `${accion} (Ventana: ${p.ventana}, desvío ${desvioRedondeado >= 0 ? "+" : ""}${fmt1(desvioRedondeado)} % vs serie 2001–2025).`
      : accion,
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
