/**
 * Acumulado CHIRPS v3 de cada temporada de lluvias (1/12 al 30/4) por localidad, leído de los
 * totales mensuales que publica el Climate Hazards Center (UCSB) como GeoTIFF optimizado para la nube.
 * Solo se pide el píxel de cada localidad, no el archivo entero.
 * CHIRPS llega con semanas de demora, así que no se consulta en vivo: una temporada cerrada no cambia.
 * Correr una vez por año, cuando CHIRPS ya cubre hasta abril:  npm run chirps
 */
import { writeFileSync } from "node:fs";
import { fromUrl } from "geotiff";
import { COMUNIDADES } from "../src/lib/comunidades";

export const CHIRPS_VERSION = "3.0";
const BASE = `https://data.chc.ucsb.edu/products/CHIRPS/v${CHIRPS_VERSION}/monthly/global/cogs/`;
const MESES_TEMPORADA = [12, 1, 2, 3, 4];
const DESDE = 2001;
const INTENTOS = 8;

export type Punto = { id: string; lat: number; lon: number };

/** mm del mes en el píxel de cada punto; null si el píxel no tiene dato. El servidor rechaza conexiones de a ratos: se reintenta. */
async function mesChirps(anio: number, mes: number, puntos: Punto[]): Promise<Record<string, number | null>> {
  const url = `${BASE}chirps-v${CHIRPS_VERSION}.${anio}.${String(mes).padStart(2, "0")}.cog`;
  for (let i = 1; ; i++) {
    try {
      const img = await (await fromUrl(url)).getImage();
      const [x0, y0] = img.getOrigin();
      const [dx, dy] = img.getResolution();
      const out: Record<string, number | null> = {};
      for (const p of puntos) {
        const x = Math.floor((p.lon - x0) / dx);
        const y = Math.floor((p.lat - y0) / dy);
        const [banda] = (await img.readRasters({ window: [x, y, x + 1, y + 1] })) as unknown as number[][];
        out[p.id] = banda[0] >= 0 ? banda[0] : null;
      }
      return out;
    } catch (e) {
      if (i >= INTENTOS) throw new Error(`CHIRPS v${CHIRPS_VERSION} ${anio}-${mes}: ${e instanceof Error ? e.message : e}`);
      await new Promise((ok) => setTimeout(ok, 2000 * i));
    }
  }
}

/** mm de cada temporada de lluvias (1/12 al 30/4) desde 2001 por punto; la clave es el año en que termina. */
export async function temporadasChirps(puntos: Punto[], hasta: number): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = Object.fromEntries(puntos.map((p) => [p.id, {}]));
  for (let anio = DESDE; anio <= hasta; anio++) {
    const meses = [];
    for (const m of MESES_TEMPORADA) meses.push(await mesChirps(m === 12 ? anio - 1 : anio, m, puntos));
    for (const p of puntos) {
      const mm = meses.map((x) => x[p.id]);
      if (mm.every((v): v is number => v !== null)) out[p.id][anio] = Math.round(mm.reduce((s, v) => s + v, 0) * 10) / 10;
    }
  }
  return out;
}

async function main() {
  const hasta = Number(process.argv[2] ?? new Date().getUTCFullYear());
  const destino = process.argv[3] ?? new URL("../src/data/chirps-temporadas.json", import.meta.url);
  const temporadas = await temporadasChirps(COMUNIDADES, hasta);
  for (const c of COMUNIDADES) {
    console.log(c.id, Object.keys(temporadas[c.id]).length, "temporadas; última:", temporadas[c.id][hasta] ?? "sin dato");
  }
  writeFileSync(
    destino,
    JSON.stringify(
      {
        fuente: `CHIRPS v${CHIRPS_VERSION} (Climate Hazards Center, UCSB), totales mensuales`,
        generadoEn: new Date().toISOString(),
        nota: "mm acumulados de diciembre a abril; la clave es el año en que termina la temporada. Valor del píxel de ~5 km que contiene a la localidad.",
        temporadas,
      },
      null,
      1,
    ) + "\n",
  );
}

if (process.argv[1]?.endsWith("chirps-temporadas.ts")) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
