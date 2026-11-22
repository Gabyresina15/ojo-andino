import { NextResponse } from "next/server";
import { getComunidad } from "@/lib/comunidades";
import { leerTodo } from "@/lib/lecturas";
import { lecturaCacheada } from "@/lib/cache";
import type { LecturaSatelital } from "@/lib/types";

export const dynamic = "force-dynamic";

const memoria = new Map<string, { t: number; l: LecturaSatelital }>();
const TTL = 30 * 60 * 1000;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const c = getComunidad(id);
  if (!c) return NextResponse.json({ error: "comunidad desconocida" }, { status: 404 });

  const m = memoria.get(c.id);
  if (m && Date.now() - m.t < TTL) return NextResponse.json(m.l);

  const viva = await leerTodo(c.id, c.lat, c.lon);
  const cache = lecturaCacheada(c.id);

  // Mezcla: lo que llegó en vivo gana; lo que faltó cae al cache del deploy.
  const l: LecturaSatelital = {
    ...viva,
    meteorologia: viva.meteorologia ?? cache?.meteorologia ?? null,
    ndvi: viva.ndvi ?? cache?.ndvi ?? null,
    fuenteCache: !viva.meteorologia && !!cache?.meteorologia,
  };
  if (viva.meteorologia) memoria.set(c.id, { t: Date.now(), l });
  return NextResponse.json(l);
}
