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
      resumen_oral: { type: "string", description: "Mensaje oral de 4 a 6 oraciones, castellano rioplatense simple." },
      estado_hidrico: { type: "string", enum: ["deficit", "normal", "superavit_reciente", "sin_dato"] },
      nota_parametrica: {
        type: "string",
        description: "1 a 3 oraciones para una cooperativa o aseguradora: índice, ventana y desvío vs climatología. Sin prometer pólizas.",
      },
      fuentes: { type: "string", description: "Fuentes y fechas de los datos usados." },
    },
  },
};

export const SYSTEM_PROMPT = `Sos el redactor de alertas de Ojo Andino, un servicio que traduce datos satelitales a un mensaje oral para familias pastoriles, municipios, cooperativas y aseguradoras de la Puna y la Quebrada de Jujuy, Argentina.

Reglas:
- Respondé SOLO con el JSON del esquema. Nada de markdown.
- resumen_oral: castellano simple, rioplatense, de 4 a 6 oraciones. Trato de vos. Sin jerga de teledetección salvo el nombre de la fuente.
- No inventes números. Usá solo los que vienen en el JSON del usuario. Si un campo viene null, no lo menciones o decí que no está disponible. No calcules números nuevos (ni diferencias ni promedios propios).
- No conviertas el NDVI en "porcentaje de pasto" ni en predicción de mortandad. Es un índice de verdor (0 a 1). En la Puna valores cerca de 0,1–0,2 pueden ser normales: comparalo con el composite del año anterior si viene.
- estado_hidrico DEBE ser igual a "estado_hidrico_calculado" del JSON. No afirmes sequía si la anomalía de lluvia es positiva. Podés recordar que la zona venía de meses secos (contexto), sin contradecir el dato actual.
- Incluí: el pueblo, la ventana de fechas y las fuentes (NASA POWER para lluvia y temperatura, MODIS MOD13Q1 para el verdor). Aclará que el último dato meteorológico tiene 2 a 3 días de demora y que el NDVI es un compuesto de 16 días.
- Un decimal para mm, °C y porcentajes; tres decimales para NDVI. Evitá "exactamente", "sin duda", "el ganado va a morir".
- No hables en nombre de una comunidad, no cites personas reales, no des órdenes. Como máximo una sugerencia prudente (por ejemplo, consultar con el municipio o con extensión rural antes de mover la hacienda).
- Si modo = "parametrico", el resumen_oral se dirige a una cooperativa o aseguradora: índice, ventana, desvío y limitaciones (riesgo de base), sin prometer pólizas ni decir que el índice está homologado.
- nota_parametrica: 1 a 3 oraciones técnicas sobre el índice (ventana, desvío vs climatología 2001–2025) aclarando que es un insumo, no una póliza.`;

/** Construye el payload compacto que ve Grok (solo números que existen en la fuente). */
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

/** Números permitidos: los que existen en el payload (con redondeos) + enteros de fecha. */
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

/** Texto determinista (sin LLM) con el mismo esquema. Es el respaldo y también la "verdad" de referencia. */
export function alertaDeterminista(c: Comunidad, l: LecturaSatelital, modo: "comunidad" | "parametrico"): AlertaLLM {
  const m = l.meteorologia;
  const est = estadoHidrico(l);
  const partes: string[] = [];
  if (m) {
    const p = m.precipitacionMm30d;
    const signo = (p.porcentaje ?? 0) >= 0 ? "por encima" : "por debajo";
    partes.push(
      `En ${c.nombre}, entre el ${p.ventana.split(" (")[0]}, NASA POWER registra ${fmt1(p.observado)} mm de lluvia, contra ${fmt1(p.climatologia)} mm del promedio 2001–2025 para esas fechas: ${fmt1(Math.abs(p.porcentaje ?? 0))} % ${signo} de lo normal.`,
    );
    partes.push(
      `La temperatura media de los últimos 7 días con dato fue de ${fmt1(m.temperaturaC7d.mediaObservada)} °C, contra ${fmt1(m.temperaturaC7d.climatologiaMes)} °C del promedio del mes.`,
    );
  } else {
    partes.push(`En ${c.nombre} no hay dato meteorológico disponible en este momento.`);
  }
  if (l.ndvi) {
    const n = l.ndvi;
    partes.push(
      `El verdor medido por MODIS MOD13Q1 en el compuesto del ${n.ultimoComposite.fecha} es ${fmt3(n.ultimoComposite.ndvi)}${n.compositeAnioAnterior ? `, frente a ${fmt3(n.compositeAnioAnterior.ndvi)} en el mismo período del año pasado` : ""}.`,
    );
  }
  if (est === "superavit_reciente")
    partes.push("La zona venía de meses secos, pero el dato reciente muestra lluvias por encima del promedio; puede ser momento de seguir el rebrote antes de comprar más forraje.");
  else if (est === "deficit")
    partes.push("La lluvia viene por debajo del promedio; puede convenir hablar con el municipio o con extensión rural para anticipar agua y forraje.");
  else if (est === "normal") partes.push("La lluvia está cerca de lo normal para la época.");
  partes.push("El último dato de lluvia tiene 2 a 3 días de demora y el verdor es un compuesto de 16 días.");

  const p = m?.precipitacionMm30d;
  return {
    resumen_oral: partes.join(" "),
    estado_hidrico: est,
    nota_parametrica: p
      ? `Índice de lluvia acumulada ${p.ventana}: ${fmt1(p.observado)} mm vs ${fmt1(p.climatologia)} mm climatológicos (desvío ${p.porcentaje! >= 0 ? "+" : ""}${fmt1(p.porcentaje ?? 0)} %). Insumo de datos para coberturas por índice; no es una póliza ni un índice homologado.`
      : "Sin serie meteorológica disponible para construir el índice.",
    fuentes: `NASA POWER (último dato ${m?.ultimoDiaConDato ?? "s/d"}) y MODIS MOD13Q1 vía ORNL (composite ${l.ndvi?.ultimoComposite.fecha ?? "s/d"}).`,
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
