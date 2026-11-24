import { z } from "zod";
import { excedeLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().min(1).max(2000) });

export async function POST(req: Request) {
  if (excedeLimite(req, "tts", 10)) return new Response("demasiados pedidos", { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("body inválido", { status: 400 });
  const key = process.env.XAI_API_KEY;
  if (!key) return new Response("Falta XAI_API_KEY", { status: 503 });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: parsed.data.text,
        voice_id: process.env.XAI_TTS_VOICE || "eve",
        language: process.env.XAI_TTS_LANGUAGE || "es-MX",
        text_normalization: true,
      }),
    });
    if (!r.ok) return new Response(`xAI TTS HTTP ${r.status}`, { status: 502 });
    const audio = await r.arrayBuffer();
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(`TTS falló: ${(e as Error).message}`, { status: 504 });
  } finally {
    clearTimeout(t);
  }
}
