import { NextResponse } from "next/server";
import { getComunidad } from "@/lib/comunidades";
import { excedeLimite } from "@/lib/limite";
import { pronosticoServidor } from "@/lib/pronostico";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: Request) {
  if (excedeLimite(req, "pronostico", 60)) return NextResponse.json({ error: "demasiados pedidos" }, { status: 429 });
  const c = getComunidad(new URL(req.url).searchParams.get("id") ?? "");
  if (!c) return NextResponse.json({ error: "comunidad desconocida" }, { status: 404 });
  const p = await pronosticoServidor(c);
  if (!p) return NextResponse.json({ error: "pronóstico no disponible" }, { status: 502 });
  return NextResponse.json(p);
}
