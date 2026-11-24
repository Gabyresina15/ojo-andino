import { NextResponse } from "next/server";
import { COMUNIDADES, getComunidad } from "@/lib/comunidades";
import { lecturaServidor } from "@/lib/lectura-servidor";
import { excedeLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (excedeLimite(req, "lecturas", 60)) return NextResponse.json({ error: "demasiados pedidos" }, { status: 429 });
  const id = new URL(req.url).searchParams.get("id");
  // Sin id: las 10 localidades, para el mapa, la tabla regional y el parte consolidado.
  if (!id) return NextResponse.json(await Promise.all(COMUNIDADES.map(lecturaServidor)));
  const c = getComunidad(id);
  if (!c) return NextResponse.json({ error: "comunidad desconocida" }, { status: 404 });
  return NextResponse.json(await lecturaServidor(c));
}
