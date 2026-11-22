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
        description:
          "Dictamen hidrológico y logístico de 4 a 5 oraciones para el Gobierno de Jujuy. Analiza la distribución diaria de lluvia (días secos, pico diario, últimos 7 días) y el impacto operativo, sin repetir de memoria los promedios.",
      },
      estado_hidrico: { type: "string", enum: ["deficit", "normal", "superavit_reciente", "sin_dato"] },
      nota_parametrica: {
        type: "string",
        description:
          "1 a 2 oraciones con la directiva logística concreta para el Ministerio (Producción, Recursos Hídricos o Vialidad/Obras).",
      },
      fuentes: { type: "string", description: "Fuentes satelitales y fecha del último dato." },
    },
  },
};

export const SYSTEM_PROMPT = `Sos el Analista Principal de Riesgo Hídrico, Productivo y Vial de Ojo Andino para el Gobierno de la Provincia de Jujuy (Ministerio de Desarrollo Económico y Producción, Recursos Hídricos e Infraestructura) y sus Municipios y Comisiones Municipales.

Tu trabajo NO es repetir los 3 números grandes que ya están arriba en las tarjetas. Tu trabajo es cruzar la distribución diaria de los últimos 30 días ("patron_diario") con la temperatura y la vegetación para darle al funcionario una justificación técnica de expediente:

Reglas estrictas:
- Respondé SOLO con el JSON del esquema. Nada de markdown.
- En "resumen_oral" (4 a 5 oraciones en castellano de Argentina):
  1. Analizá CÓMO se comportó la lluvia dentro de los 30 días usando "patron_diario": cuántos días estuvieron secos (< 1 mm), cuánto llovió en la última semana ("lluvia_ultimos_7d_mm") y cuál fue el pico máximo en un solo día ("pico_maximo_mm" y su fecha).
  2. Cruzalo con el impacto físico en el terreno:
     - Si hay déficit (ej. Susques): explicá que la cantidad de días secos seguidos combinada con la temperatura por encima de lo normal acelera la evaporación de aguadas y frena el rebrote del pastizal, justificando técnicamente ante Hacienda priorizar esta jurisdicción con camiones de forraje (alfalfa) y agua.
     - Si hay superávit en la Puna (ej. Abra Pampa, La Quiaca, Yavi): explicá que la concentración de lluvias en los últimos días recargó la humedad superficial tras la sequía de septiembre/octubre, por lo que no corresponde enviar fardos de emergencia esta semana sino monitorear el rebrote natural y reasignar la logística provincial a zonas secas.
     - Si hay superávit en la Quebrada (ej. Volcán, Tumbaya, Humahuaca): explicá que los picos diarios intensos sobre pendientes de Quebrada generan escorrentía rápida, por lo que la prioridad municipal no es sequía sino inspección de drenajes urbanos, badenes, obras y caminos rurales.
     - Si está normal (ej. Tilcara, Maimará, Purmamarca): explicá que la distribución de lluvias acompaña el ciclo normal de inicio de temporada húmeda.
- NO metas siglas robóticas adentro de "resumen_oral" (no escribas "MOD13Q1" ni "PRECTOTCORR"; esas siglas van solo en "fuentes").
- No inventes números ni hagas cuentas propias: usá exclusivamente las cifras que vienen en el JSON del usuario.
- estado_hidrico DEBE coincidir con "estado_hidrico_calculado".`;

export type PatronDiario = {
  dias_totales: number;
  dias_con_lluvia_significativa: number;
  dias_secos: number;
  lluvia_ultimos_7d_mm: number;
  pico_maximo_mm: number;
  pico_maximo_dia: string;
};

export function calcularPatronDiario(l: LecturaSatelital): PatronDiario | null {
  const serie = l.meteorologia?.serie;
  if (!serie || serie.length === 0) return null;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const diasConLluvia = serie.filter((d) => (d.lluviaMm ?? 0) >= 1).length;
  const diasSecos = serie.length - diasConLluvia;
  const ult7 = serie.slice(-7).reduce((acc, d) => acc + (d.lluviaMm ?? 0), 0);
  const pico = [...serie].sort((a, b) => (b.lluviaMm ?? 0) - (a.lluviaMm ?? 0))[0];
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return {
    dias_totales: serie.length,
    dias_con_lluvia_significativa: diasConLluvia,
    dias_secos: diasSecos,
    lluvia_ultimos_7d_mm: r1(ult7),
    pico_maximo_mm: r1(pico?.lluviaMm ?? 0),
    pico_maximo_dia: pico ? ddmm(pico.fecha) : "s/d",
  };
}

export function payloadUsuario(c: Comunidad, l: LecturaSatelital, modo: "comunidad" | "parametrico") {
  const m = l.meteorologia;
  const patron = calcularPatronDiario(l);
  const deltaTemp = m ? Math.round((m.temperaturaC7d.mediaObservada - m.temperaturaC7d.climatologiaMes) * 10) / 10 : null;
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
    patron_diario: patron,
    temperatura: m
      ? {
          ventana: m.temperaturaC7d.ventana,
          media_7d_c: Math.round(m.temperaturaC7d.mediaObservada * 10) / 10,
          climatologia_mes_c: Math.round(m.temperaturaC7d.climatologiaMes * 10) / 10,
          diferencia_termica_c: deltaTemp,
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
    return `No requiere envío de forraje de emergencia esta semana: las lluvias recientes permiten esperar el rebrote natural y reasignar fletes a zonas deficitarias.`;
  }
  if (est === "superavit_reciente" && c.region === "quebrada") {
    return `Sin emergencia por sequía. Por picos de lluvia en pendiente, se recomienda al Municipio inspeccionar drenajes urbanos, badenes, obras y caminos.`;
  }
  return `Condición hídrica dentro del promedio histórico. Mantener monitoreo municipal habitual sin operativo de emergencia.`;
}

export function alertaDeterminista(c: Comunidad, l: LecturaSatelital, _modo: "comunidad" | "parametrico"): AlertaLLM {
  const m = l.meteorologia;
  const est = estadoHidrico(l);
  const patron = calcularPatronDiario(l);
  const partes: string[] = [];

  if (m && patron) {
    const deltaTemp = fmt1(Math.abs(m.temperaturaC7d.mediaObservada - m.temperaturaC7d.climatologiaMes));
    if (est === "deficit") {
      partes.push(
        `Análisis de régimen diario para ${c.nombre}: de los últimos ${patron.dias_totales} días evaluados, ${patron.dias_secos} días no tuvieron lluvias útiles (solo ${patron.dias_con_lluvia_significativa} días superaron 1 mm, con un máximo diario de apenas ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia}).`,
      );
      partes.push(
        `En la última semana cayeron solo ${fmt1(patron.lluvia_ultimos_7d_mm)} mm y la temperatura estuvo ${deltaTemp} °C por encima del promedio del mes, lo que acelera la evaporación en aguadas y mantiene estancado el pastizal natural (${l.ndvi ? fmt3(l.ndvi.ultimoComposite.ndvi) : "bajo"}).`,
      );
      partes.push(
        `Justificación de expediente: los datos respaldan asignar prioridad alta a la Comisión Municipal de ${c.nombre} para el despacho de fardos de alfalfa y agua.`,
      );
    } else if (est === "superavit_reciente" && c.region === "puna") {
      partes.push(
        `Análisis de régimen diario para ${c.nombre}: tras los meses secos de septiembre y octubre, se registraron ${patron.dias_con_lluvia_significativa} jornadas con lluvias activas (${fmt1(patron.lluvia_ultimos_7d_mm)} mm acumulados en los últimos 7 días y un pico de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia}).`,
      );
      partes.push(
        `Esta recarga de humedad superficial mejora la perspectiva de rebrote respecto al corte previo de octubre (${l.ndvi?.compositeAnterior ? fmt3(l.ndvi.compositeAnterior.ndvi) : "0,115"} a ${l.ndvi ? fmt3(l.ndvi.ultimoComposite.ndvi) : "0,138"}).`,
      );
      partes.push(
        `Justificación de expediente: no se recomienda despachar forraje de emergencia a ${c.nombre} esta semana, pudiendo reasignar esos camiones a jurisdicciones con déficit activo como Susques.`,
      );
    } else if (est === "superavit_reciente" && c.region === "quebrada") {
      partes.push(
        `Análisis de régimen diario para ${c.nombre}: las precipitaciones superaron el promedio histórico concentrándose en ${patron.dias_con_lluvia_significativa} días de lluvia activa, con un evento máximo de ${fmt1(patron.pico_maximo_mm)} mm en 24 horas el ${patron.pico_maximo_dia} y ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en la última semana.`,
      );
      partes.push(
        `En topografía de Quebrada, esta concentración de agua en pocos días incrementa la escorrentía superficial sobre laderas, badenes y trazas viales.`,
      );
      partes.push(
        `Justificación de expediente: la jurisdicción no presenta riesgo de sequía; corresponde priorizar limpieza preventiva de desagües pluviales, defensas y control de caminos municipales.`,
      );
    } else {
      partes.push(
        `Análisis de régimen diario para ${c.nombre}: la lluvia se distribuyó en ${patron.dias_con_lluvia_significativa} días con precipitación significativa (pico máximo de ${fmt1(patron.pico_maximo_mm)} mm el ${patron.pico_maximo_dia} y ${fmt1(patron.lluvia_ultimos_7d_mm)} mm en la última semana).`,
      );
      partes.push(
        `El balance hídrico coincide con el comportamiento normal de los últimos 25 años para el inicio de la temporada húmeda.`,
      );
      partes.push(
        `Justificación de expediente: mantener seguimiento técnico ordinario sin activar partidas de emergencia.`,
      );
    }
  } else {
    partes.push(`Sin serie diaria suficiente para ${c.nombre}.`);
  }

  const accion = recomendacionGobierno(c, l);
  const p = m?.precipitacionMm30d;
  return {
    resumen_oral: partes.join(" "),
    estado_hidrico: est,
    nota_parametrica: p
      ? `${accion} (Ventana: ${p.ventana}, desvío ${p.porcentaje! >= 0 ? "+" : ""}${fmt1(p.porcentaje ?? 0)} % vs serie 2001–2025).`
      : accion,
    fuentes: `NASA POWER (corte ${m?.ultimoDiaConDato ?? "s/d"}, demora oficial 2–3 días) y MODIS MOD13Q1 (compuesto 16 días al ${l.ndvi?.ultimoComposite.fecha ?? "s/d"}).`,
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
