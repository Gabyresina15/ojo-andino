import { NextResponse } from "next/server";
import tleCache from "@/data/tle-saocom.json";

export const dynamic = "force-dynamic";

let memoria: { t: number; tle: string } | null = null;

export async function GET() {
  if (memoria && Date.now() - memoria.t < 2 * 3600 * 1000) {
    return NextResponse.json({ tle: memoria.tle, fuente: "celestrak", obtenidoEn: new Date(memoria.t).toISOString() });
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch("https://celestrak.org/NORAD/elements/gp.php?NAME=SAOCOM&FORMAT=TLE", { signal: ctrl.signal });
    clearTimeout(t);
    const txt = (await r.text()).trim();
    if (!r.ok || !txt.includes("SAOCOM")) throw new Error(`HTTP ${r.status}`);
    memoria = { t: Date.now(), tle: txt };
    return NextResponse.json({ tle: txt, fuente: "celestrak", obtenidoEn: new Date().toISOString() });
  } catch {
    return NextResponse.json({ tle: tleCache.tle, fuente: "cache", obtenidoEn: tleCache.obtenidoEn });
  }
}
