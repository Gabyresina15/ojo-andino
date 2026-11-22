/**
 * Genera el cache que viaja en el deploy (offline-first).
 *   npm run precache
 * Correlo con red antes del freeze (y otra vez a la tarde si podés).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMUNIDADES } from "../src/lib/comunidades";
import { leerTodo } from "../src/lib/lecturas";
import type { LecturaSatelital } from "../src/lib/types";

const DATA = join(process.cwd(), "src", "data");

async function main() {
  const rutaCache = join(DATA, "cache-lecturas.json");
  const previo = JSON.parse(readFileSync(rutaCache, "utf8")) as Record<string, LecturaSatelital>;
  const nuevo: Record<string, LecturaSatelital> = { ...previo };

  for (const c of COMUNIDADES) {
    const t0 = Date.now();
    const l = await leerTodo(c.id, c.lat, c.lon);
    const okMet = !!l.meteorologia;
    const okNdvi = !!l.ndvi;
    nuevo[c.id] = {
      ...l,
      fuenteCache: true,
      meteorologia: l.meteorologia ?? previo[c.id]?.meteorologia ?? null,
      ndvi: l.ndvi ?? previo[c.id]?.ndvi ?? null,
    };
    const p = l.meteorologia?.precipitacionMm30d;
    console.log(
      `${c.id.padEnd(12)} POWER:${okMet ? "ok" : "FALLA"} NDVI:${okNdvi ? "ok" : "FALLA"} ` +
        `${p ? `lluvia ${p.observado}mm vs ${p.climatologia}mm (${p.porcentaje}%) ult:${l.meteorologia?.ultimoDiaConDato}` : ""} ` +
        `${l.ndvi ? `ndvi ${l.ndvi.ultimoComposite.ndvi} (${l.ndvi.ultimoComposite.fecha})` : ""} ${Date.now() - t0}ms ${l.errores.join(" | ")}`,
    );
  }
  writeFileSync(rutaCache, JSON.stringify(nuevo, null, 2));

  try {
    const r = await fetch("https://celestrak.org/NORAD/elements/gp.php?NAME=SAOCOM&FORMAT=TLE");
    const tle = (await r.text()).trim();
    if (r.ok && tle.includes("SAOCOM")) {
      writeFileSync(join(DATA, "tle-saocom.json"), JSON.stringify({ tle, obtenidoEn: new Date().toISOString() }, null, 2));
      console.log("TLE SAOCOM ok:\n" + tle);
    } else console.log("TLE: respuesta inesperada", r.status);
  } catch (e) {
    console.log("TLE FALLA", (e as Error).message);
  }
}

main();
