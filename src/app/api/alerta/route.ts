import { NextResponse } from "next/server";
import { z } from "zod";
import { getComunidad } from "@/lib/comunidades";
import { generarAlerta } from "@/lib/alerta";
import { lecturaServidor } from "@/lib/lectura-servidor";
import { excedeLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string(),
  modo: z.enum(["comunidad", "parametrico"]).default("comunidad"),
});

export async function POST(req: Request) {
  if (excedeLimite(req, "alerta", 30)) return NextResponse.json({ error: "demasiados pedidos" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "body inválido" }, { status: 400 });
  const c = getComunidad(parsed.data.id);
  if (!c) return NextResponse.json({ error: "comunidad desconocida" }, { status: 404 });

  // El dictamen se redacta solo con datos que obtuvo el servidor, nunca con los que manda el cliente.
  const lectura = await lecturaServidor(c);

  const alerta = await generarAlerta(c, lectura, parsed.data.modo);
  return NextResponse.json(alerta);
}
