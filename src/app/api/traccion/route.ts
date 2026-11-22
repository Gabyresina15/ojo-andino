import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Contador de tracción vía Supabase REST (PostgREST), sin SDK.
 * Si faltan las env vars, responde { habilitado: false } y la UI oculta el contador.
 */
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY_SB =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const Evento = z.object({
  tipo: z.enum(["vista", "alerta", "whatsapp", "gps", "audio"]),
  comunidad_id: z.string().max(40).optional(),
  sesion: z.string().max(64).optional(),
});

function headers(extra: Record<string, string> = {}) {
  return { apikey: KEY_SB!, Authorization: `Bearer ${KEY_SB}`, "Content-Type": "application/json", ...extra };
}

export async function POST(req: Request) {
  if (!URL_SB || !KEY_SB) return NextResponse.json({ habilitado: false });
  const p = Evento.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "evento inválido" }, { status: 400 });
  const r = await fetch(`${URL_SB}/rest/v1/eventos`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(p.data),
  }).catch(() => null);
  return NextResponse.json({ habilitado: true, ok: !!r?.ok });
}

export async function GET() {
  if (!URL_SB || !KEY_SB) return NextResponse.json({ habilitado: false });
  const desde = new Date(Date.now() - 18 * 3600 * 1000).toISOString();
  const contar = async (filtro: string) => {
    const r = await fetch(`${URL_SB}/rest/v1/eventos?select=id&created_at=gte.${desde}${filtro}`, {
      headers: headers({ Prefer: "count=exact", Range: "0-0" }),
      cache: "no-store",
    });
    const cr = r.headers.get("content-range");
    return cr ? Number(cr.split("/")[1]) : 0;
  };
  try {
    const [total, gps, alertas] = await Promise.all([contar(""), contar("&tipo=eq.gps"), contar("&tipo=eq.alerta")]);
    // sesiones únicas
    const rs = await fetch(`${URL_SB}/rest/v1/eventos?select=sesion&created_at=gte.${desde}&limit=5000`, {
      headers: headers(),
      cache: "no-store",
    });
    const filas: { sesion: string | null }[] = rs.ok ? await rs.json() : [];
    const personas = new Set(filas.map((f) => f.sesion).filter(Boolean)).size;
    return NextResponse.json({ habilitado: true, total, gps, alertas, personas });
  } catch {
    return NextResponse.json({ habilitado: true, error: "supabase no responde" });
  }
}
