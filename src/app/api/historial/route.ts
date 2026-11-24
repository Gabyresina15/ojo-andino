import { NextResponse } from "next/server";
import { z } from "zod";
import { getComunidad } from "@/lib/comunidades";
import { aCsv, leerHistorial } from "@/lib/historial";
import { excedeLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";

const Consulta = z.object({
  id: z.string().max(40).optional(),
  dias: z.coerce.number().int().min(1).max(366).default(90),
  formato: z.enum(["json", "csv"]).default("json"),
});

/** Qué registró el barrido diario: ?id=susques&dias=90&formato=csv */
export async function GET(req: Request) {
  if (excedeLimite(req, "historial", 30)) return NextResponse.json({ error: "demasiados pedidos" }, { status: 429 });
  const p = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success || (p.data.id && !getComunidad(p.data.id))) {
    return NextResponse.json({ error: "consulta inválida" }, { status: 400 });
  }
  try {
    const filas = await leerHistorial({ comunidadId: p.data.id, dias: p.data.dias });
    if (!filas) return NextResponse.json({ habilitado: false });
    if (p.data.formato === "csv") {
      return new Response(aCsv(filas), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="ojo-andino-historial.csv"',
        },
      });
    }
    return NextResponse.json({ habilitado: true, filas });
  } catch {
    return NextResponse.json({ habilitado: true, error: "el historial no responde" }, { status: 502 });
  }
}
