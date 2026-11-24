import { NextResponse } from "next/server";
import { COMUNIDADES } from "@/lib/comunidades";
import { lecturaCacheada } from "@/lib/cache";
import { estadoHidrico } from "@/lib/lecturas";
import { generarAlerta } from "@/lib/alerta";

export const dynamic = "force-dynamic";

export type DespachoMunicipal = {
  comunidadId: string;
  comunidadNombre: string;
  organismoDestino: string;
  region: "puna" | "quebrada";
  lluviaObservadaMm: number;
  lluviaNormalMm: number;
  anomaliaPct: number;
  estado: "deficit" | "normal" | "superavit_reciente" | "sin_dato";
  accionAutomatica: "enviada" | "en_vigilancia";
  canal: "meta_cloud_api" | "webhook" | "cola_institucional";
  mensajeEnviado: string | null;
  ejecutadoEn: string;
};

export type ResultadoBarrido = {
  fechaBarrido: string;
  ejecutadoEn: string;
  totalMunicipios: number;
  alertasDisparadas: number;
  metaCloudConfigurado: boolean;
  despachos: DespachoMunicipal[];
};

const ORGANISMO_POR_ID: Record<string, string> = {
  "susques": "Comisión Municipal de Susques · Área Producción y Agua",
  "abra-pampa": "Municipalidad de Abra Pampa · Secretaría de Desarrollo Productivo",
  "la-quiaca": "Municipalidad de La Quiaca · Dirección de Asuntos Rurales",
  "yavi": "Comisión Municipal de Yavi",
  "humahuaca": "Municipalidad de Humahuaca · Defensa Civil y Agro",
  "tilcara": "Municipalidad de Tilcara · Área Rural y Ambiente",
  "maimara": "Comisión Municipal de Maimará",
  "purmamarca": "Comisión Municipal de Purmamarca",
  "tumbaya": "Comisión Municipal de Tumbaya",
  "volcan": "Comisión Municipal de Volcán",
};

let cacheBarrido: { t: number; res: ResultadoBarrido } | null = null;
const TTL_MS = 15 * 60 * 1000;

async function enviarPorMetaCloudApi(organismo: string, mensaje: string): Promise<boolean> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  const destino = process.env.META_RECIPIENT_PHONE;
  if (!token || !phoneId || !destino) return false;

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "text",
        text: { body: `[Ojo Andino · Alerta Automática]\nDestino: ${organismo}\n\n${mensaje}` },
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function enviarPorWebhook(payload: unknown): Promise<boolean> {
  const url = process.env.ALERTA_WEBHOOK_URL;
  if (!url) return false;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (cacheBarrido && Date.now() - cacheBarrido.t < TTL_MS) {
    return NextResponse.json(cacheBarrido.res);
  }

  const ahora = new Date().toISOString();
  const despachos: DespachoMunicipal[] = [];
  const metaConfigurado = Boolean(
    process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID && process.env.META_RECIPIENT_PHONE,
  );

  for (const c of COMUNIDADES) {
    const l = lecturaCacheada(c.id);
    const p = l?.meteorologia?.precipitacionMm30d;
    const est = l ? estadoHidrico(l) : "sin_dato";
    const organismo = ORGANISMO_POR_ID[c.id] ?? `Municipio de ${c.nombre}`;

    // El motor decide SOLO: si hay déficit hídrico (<= -25%), genera y despacha la alerta sin intervención humana.
    if (l && est === "deficit") {
      const alerta = await generarAlerta(c, l, "comunidad");
      let canal: DespachoMunicipal["canal"] = "cola_institucional";

      const enviadoMeta = await enviarPorMetaCloudApi(organismo, alerta.resumen_oral);
      if (enviadoMeta) {
        canal = "meta_cloud_api";
      } else {
        const enviadoHook = await enviarPorWebhook({
          comunidad: c.nombre,
          organismo,
          anomaliaPct: p?.porcentaje,
          mensaje: alerta.resumen_oral,
          ejecutadoEn: ahora,
        });
        if (enviadoHook) canal = "webhook";
      }

      despachos.push({
        comunidadId: c.id,
        comunidadNombre: c.nombre,
        organismoDestino: organismo,
        region: c.region,
        lluviaObservadaMm: p?.observado ?? 0,
        lluviaNormalMm: p?.climatologia ?? 0,
        anomaliaPct: p?.porcentaje ?? 0,
        estado: est,
        accionAutomatica: "enviada",
        canal,
        mensajeEnviado: alerta.resumen_oral,
        ejecutadoEn: ahora,
      });
    } else {
      despachos.push({
        comunidadId: c.id,
        comunidadNombre: c.nombre,
        organismoDestino: organismo,
        region: c.region,
        lluviaObservadaMm: p?.observado ?? 0,
        lluviaNormalMm: p?.climatologia ?? 0,
        anomaliaPct: p?.porcentaje ?? 0,
        estado: est,
        accionAutomatica: "en_vigilancia",
        canal: "cola_institucional",
        mensajeEnviado: null,
        ejecutadoEn: ahora,
      });
    }
  }

  // Ordenar: primero los que dispararon alerta automática (peor déficit primero)
  despachos.sort((a, b) => a.anomaliaPct - b.anomaliaPct);

  const res: ResultadoBarrido = {
    fechaBarrido: new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Jujuy" }),
    ejecutadoEn: ahora,
    totalMunicipios: despachos.length,
    alertasDisparadas: despachos.filter((d) => d.accionAutomatica === "enviada").length,
    metaCloudConfigurado: metaConfigurado,
    despachos,
  };

  cacheBarrido = { t: Date.now(), res };
  return NextResponse.json(res);
}
