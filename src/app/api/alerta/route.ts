import { NextResponse } from "next/server";
import { z } from "zod";
import { getComunidad } from "@/lib/comunidades";
import { generarAlerta } from "@/lib/alerta";
import { lecturaCacheada } from "@/lib/cache";
import type { LecturaSatelital } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string(),
  modo: z.enum(["comunidad", "parametrico"]).default("comunidad"),
  lectura: z.unknown().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "body inválido" }, { status: 400 });
  const c = getComunidad(parsed.data.id);
  if (!c) return NextResponse.json({ error: "comunidad desconocida" }, { status: 404 });

  const lectura = (parsed.data.lectura as LecturaSatelital | undefined) ?? lecturaCacheada(c.id);
  if (!lectura || lectura.comunidadId !== c.id) return NextResponse.json({ error: "sin lectura" }, { status: 422 });

  const alerta = await generarAlerta(c, lectura, parsed.data.modo);
  return NextResponse.json(alerta);
}
