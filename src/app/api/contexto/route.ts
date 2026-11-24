import { NextResponse } from "next/server";
import { getComunidad } from "@/lib/comunidades";
import { contextoServidor } from "@/lib/contexto";
import { excedeLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (excedeLimite(req, "contexto", 60)) return NextResponse.json({ error: "demasiados pedidos" }, { status: 429 });
  const c = getComunidad(new URL(req.url).searchParams.get("id") ?? "");
  if (!c) return NextResponse.json({ error: "comunidad desconocida" }, { status: 404 });
  return NextResponse.json(await contextoServidor(c));
}
