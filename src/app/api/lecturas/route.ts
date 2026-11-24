import { NextResponse } from "next/server";
import { getComunidad } from "@/lib/comunidades";
import { lecturaServidor } from "@/lib/lectura-servidor";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const c = getComunidad(id);
  if (!c) return NextResponse.json({ error: "comunidad desconocida" }, { status: 404 });
  return NextResponse.json(await lecturaServidor(c));
}
