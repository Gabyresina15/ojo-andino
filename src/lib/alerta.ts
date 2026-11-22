import { z } from "zod";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "./types";
import { estadoHidrico } from "./lecturas";

export const AlertaSchema = z.object({
  resumen_oral: z.string().min(80).max(1200),
  estado_hidrico: z.enum(["deficit", "normal", "superavit_reciente", "sin_dato"]),
  nota_parametrica: z.string().max(700),
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
        description: "Parte operativo claro de 4 a 5 oraciones para el Gobierno de Jujuy y la Municipalidad o Comisión Municipal.",
      },
      estado_hidrico: { type: "string", enum: ["deficit", "normal", "superavit_reciente", "sin_dato"] },
      nota_parametrica: {
        type: "string",
        description: "1 a 2 oraciones con la acción operativa recomendada para el Ministerio o Municipio (forraje, agua, drenajes o caminos).",
      },
      fuentes: { type: "string", description: "Fuentes satelitales y fecha del último dato." },
    },
  },
};

export const SYSTEM_PROMPT = `Sos el analista de inteligencia territorial de Ojo Andino para el Gobierno de la Provincia de Jujuy (Ministerio de Desarrollo Económico y Producción, Recursos Hídricos e Infraestructura) y sus Municipios y Comisiones Municipales.

Reglas estrictas:
- Respondé SOLO con el JSON del esquema. Nada de markdown.
- resumen_oral: redactá un parte ejecutivo, claro y natural (4 a 5 oraciones en castellano de Argentina) dirigido a un funcionario provincial o comisionado municipal.
- NO metas códigos técnicos robóticos adentro del texto hablado (no digas "MOD13Q1" ni "PRECTOTCORR"; decí "los datos satelitales de la NASA" y "el índice de vegetación satelital"). Las siglas técnicas dejálas solo en el campo "fuentes".
- No inventes números. Usá solo los que vienen en el JSON del usuario. No calcules restas ni promedios propios.
- No conviertas el NDVI en "porcentaje de pasto". Es un índice de vegetación de 0 a 1 (en la Puna valores de 0,1 a 0,2 son habituales).
- estado_hidrico DEBE coincidir con "estado_hidrico_calculado" del JSON.
- Cerrá el resumen_oral con una recomendación concreta de gestión pública según el estado:
  * Si hay déficit (como en Susques): priorizar a esta Comisión Municipal en el envío de camiones de forraje (alfalfa) y asistencia de agua.
  * Si hay superávit de lluvia en la Puna (como en Abra Pampa o La Quiaca): no requiere envío de forraje de emergencia esta semana porque las lluvias recientes permiten esperar el rebrote natural.
  * Si hay superávit de lluvia en la Quebrada (como en Volcán, Tumbaya o Humahuaca): recomendar al Municipio vigilar escorrentías, drenajes urbanos y estado de caminos rurales.
  * Si está normal (como en Tilcara, Maimará o Purmamarca): mantener seguimiento habitual sin operativo de emergencia.
- Nunca digas "hablá con el municipio", porque quien lee esto ES el Municipio o el Gobierno de Jujuy.`;

export function payloadUsuario(c: Comunidad, l: LecturaSatelital, modo: "comunidad" | "parametrico") {
  const m = l.meteorologia;
  return {
    pueblo: c.nombre,
    region: c.region,
    modo,
    fecha_hoy_art: new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Jujuy" }),
    estado_hidrico_calculado: estadoHidrico(l),
    lluvia: m
      ? {
          ventana: m.precipitacionMm30d.ventana,
          observado_mm: Math.round(m.precipitacionMm30d.observado * 10) / 10,
          climatologia_mm: Math.round(m.precipitacionMm30d.climatologia * 10) / 10,
          anomalia_pct: m.precipitacionMm30d.porcentaje,
          ultimo_dia_con_dato: m.ultimoDiaConDato,
          climatologia_periodo: "2001–2025",
        }
      : null,
    temperatura: m
      ? {
          ventana: m.temperaturaC7d.ventana,
          media_7d_c: Math.round(m.temperaturaC7d.mediaObservada * 10) / 10,
          climatologia_mes_c: Math.round(m.temperaturaC7d.climatologiaMes * 10) / 10,
          mes: m.temperaturaC7d.mesClimatologico,
        }
      : null,
    ndvi: l.ndvi
      ? {
          ultimo: l.ndvi.ultimoComposite,
          anterior: l.ndvi.compositeAnterior,
          mismo_periodo_anio_anterior: l.ndvi.compositeAnioAnterior,
        }
      : null,
    contexto: c.ficha.resumen,
  };
}

function numerosPermitidos(payload: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number") out.push(v, Math.abs(v));
    else if (typeof v === "string") {
      for (const m of v.matchAll(/\d+(?:[.,]\d+)?/g)) out.push(Number(m[0].replace(",", ".")));
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(payload);
  for (let i = 0; i <= 31; i++) out.push(i);
  out.push(250, 2001, 2025, 2026, 2003);
  return out;
}

export function validarNumeros(texto: string, payload: unknown) {
  const permitidos = numerosPermitidos(payload);
  const encontrados = [...texto.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0]);
  const noVerificados = encontrados.filter((s) => {
    const n = Number(s.replace(",", "."));
    return !permitidos.some((a) => Math.abs(a - n) <= Math.max(0.051, Math.abs(a) * 0.006));
  });
  return { numerosEncontrados: encontrados.length, numerosVerificados: encontrados.length - noVerificados.length, noVerificados };
}

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt3 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function recomendacionGobierno(c: Comunidad, l: LecturaSatelital): string {
  const est = estadoHidrico(l);
  if (est === "deficit") {
    return `Priorizar a ${c.nombre} en la asignación provincial de camiones de forraje (alfalfa) y asistencia de agua para productores.`;
  }
  if (est === "superavit_reciente" && c.region === "puna") {
    return `No requiere envío de forraje de emergencia esta semana: las lluvias recientes permiten esperar el rebrote natural y reasignar recursos a zonas deficitarias.`;
  }
  if (est === "superavit_reciente" && c.region === "quebrada") {
    return `Sin emergencia por sequía. Por el exceso de lluvia reciente, se recomienda al Municipio monitorear drenajes, obras urbanas y escorrentía en caminos.`;
  }
  return `Condición hídrica dentro del promedio histórico. Mantener monitoreo municipal habitual sin operativo de emergencia.`;
}

export function alertaDeterminista(c: Comunidad, l: LecturaSatelital, _modo: "comunidad" | "parametrico"): AlertaLLM {
  const m = l.meteorologia;
  const est = estadoHidrico(l);
  const partes: string[] = [];

  if (m) {
    const p = m.precipitacionMm30d;
    const pctAbs = fmt1(Math.abs(p.porcentaje ?? 0));
    if (est === "deficit") {
      partes.push(
        `Informe de situación para ${c.nombre}: en los últimos 30 días cayeron apenas ${fmt1(p.observado)} mm de lluvia, cuando lo normal para esta época es ${fmt1(p.climatologia)} mm (un déficit del ${pctAbs} %).`,
      );
    } else if (est === "superavit_reciente") {
      partes.push(
        `Informe de situación para ${c.nombre}: en los últimos 30 días se registraron ${fmt1(p.observado)} mm de lluvia frente a los ${fmt1(p.climatologia)} mm habituales para la fecha (${pctAbs} % por encima del promedio).`,
      );
    } else {
      partes.push(
        `Informe de situación para ${c.nombre}: en los últimos 30 días llovieron ${fmt1(p.observado)} mm, un valor alineado con el promedio histórico de ${fmt1(p.climatologia)} mm para esta época.`,
      );
    }
    partes.push(
      `La temperatura media de la última semana fue de ${fmt1(m.temperaturaC7d.mediaObservada)} °C (promedio histórico del mes: ${fmt1(m.temperaturaC7d.climatologiaMes)} °C).`,
    );
  } else {
    partes.push(`En ${c.nombre} no hay lectura meteorológica disponible en este momento.`);
  }

  if (l.ndvi) {
    const n = l.ndvi;
    partes.push(
      `El índice satelital de vegetación marca ${fmt3(n.ultimoComposite.ndvi)}${
        n.compositeAnioAnterior ? ` (frente a ${fmt3(n.compositeAnioAnterior.ndvi)} en la misma fecha del año pasado)` : ""
      }.`,
    );
  }

  const accion = recomendacionGobierno(c, l);
  partes.push(`Recomendación operativa: ${accion}`);

  const p = m?.precipitacionMm30d;
  return {
    resumen_oral: partes.join(" "),
    estado_hidrico: est,
    nota_parametrica: p
      ? `${accion} (Ventana evaluada: ${p.ventana}, desvío ${p.porcentaje! >= 0 ? "+" : ""}${fmt1(p.porcentaje ?? 0)} % respecto a climatología 2001–2025).`
      : accion,
    fuentes: `NASA POWER (último dato ${m?.ultimoDiaConDato ?? "s/d"}, demora oficial 2–3 días) y MODIS MOD13Q1 (compuesto de 16 días al ${l.ndvi?.ultimoComposite.fecha ?? "s/d"}).`,
  };
}

async function llamarGrok(payload: unknown, conSchema: boolean): Promise<{ data: unknown; modelo: string }> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("Falta XAI_API_KEY");
  const modelo = process.env.XAI_MODEL || "grok-4.20-0309-non-reasoning";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.2,
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

export async function generarAlerta(c: Comunidad, l: LecturaSatelital, modo: "comunidad" | "parametrico"): Promise<AlertaRespuesta> {
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
        estado_hidrico: estadoReal,
        origen: "grok",
        modelo,
        validacion: { ...v, estadoCorregido: corregido, motivoFallback: null },
        generadoEn: new Date().toISOString(),
      };
    } catch (e) {
      motivo = (e as Error).message;
      if (motivo.includes("Falta XAI_API_KEY") || (e as Error).name === "AbortError") break;
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
