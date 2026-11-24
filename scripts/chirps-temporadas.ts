/**
 * Acumulado CHIRPS de cada temporada de lluvias (1/12 al 30/4) por localidad, vía ClimateSERV (SERVIR).
 * CHIRPS llega con semanas de demora, así que no se consulta en vivo: una temporada cerrada no cambia.
 * Correr una vez por año, cuando CHIRPS ya cubre hasta el 30/4:  npm run chirps
 */
import { writeFileSync } from "node:fs";
import { COMUNIDADES } from "../src/lib/comunidades";

const API = "https://climateserv.servirglobal.net/api/";
const CHIRPS = 0;
const PROMEDIO = 5;
const MIN_DIAS = 140;
const MEDIA_CELDA = 0.025;

async function get(ruta: string, params: Record<string, string | number>) {
  const url = new URL(ruta, API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ClimateSERV ${ruta} ${r.status}`);
  return r.json();
}

async function serieDiaria(lat: number, lon: number, desde: string, hasta: string): Promise<Record<string, number>> {
  const d = MEDIA_CELDA;
  const geometry = JSON.stringify({
    type: "Polygon",
    coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]],
  });
  const [id] = await get("submitDataRequest/", {
    datatype: CHIRPS,
    begintime: desde,
    endtime: hasta,
    intervaltype: 0,
    operationtype: PROMEDIO,
    dateType_Category: "default",
    isZip_CurrentDataType: "false",
    geometry,
  });
  for (let i = 0; ; i++) {
    const [avance] = await get("getDataRequestProgress/", { id });
    if (avance === 100) break;
    if (avance === -1 || i > 300) throw new Error(`ClimateSERV no completó el pedido ${id}`);
    await new Promise((ok) => setTimeout(ok, 4000));
  }
  const { data } = (await get("getDataFromRequest/", { id })) as { data: { date: string; value: { avg: number } }[] };
  return Object.fromEntries(
    data.map((x) => {
      const [m, dia, a] = x.date.split("/");
      return [`${a}${m}${dia}`, x.value.avg];
    }),
  );
}

/** mm de cada temporada de lluvias (1/12 al 30/4) desde 2001; la clave es el año en que termina. */
export async function temporadasChirps(lat: number, lon: number, hasta: number): Promise<Record<string, number>> {
  const tramos = [
    ["12/01/2000", "04/30/2009"],
    ["05/01/2009", "04/30/2018"],
    ["05/01/2018", `04/30/${hasta}`],
  ];
  const serie: Record<string, number> = {};
  for (const [a, b] of tramos) Object.assign(serie, await serieDiaria(lat, lon, a, b));
  const out: Record<string, number> = {};
  for (let anio = 2001; anio <= hasta; anio++) {
    const dias = Object.entries(serie).filter(([f, v]) => f >= `${anio - 1}1201` && f <= `${anio}0430` && v >= 0);
    if (dias.length >= MIN_DIAS) out[anio] = Math.round(dias.reduce((s, [, v]) => s + v, 0) * 10) / 10;
  }
  return out;
}

async function main() {
  const hasta = Number(process.argv[2] ?? new Date().getUTCFullYear());
  const temporadas: Record<string, Record<string, number>> = {};
  for (const c of COMUNIDADES) {
    temporadas[c.id] = await temporadasChirps(c.lat, c.lon, hasta);
    console.log(c.id, Object.keys(temporadas[c.id]).length, "temporadas; última:", temporadas[c.id][hasta] ?? "sin dato");
  }
  writeFileSync(
    new URL("../src/data/chirps-temporadas.json", import.meta.url),
    JSON.stringify(
      {
        fuente: "CHIRPS (Climate Hazards Center, UCSB) vía ClimateSERV (SERVIR)",
        generadoEn: new Date().toISOString(),
        nota: "mm acumulados del 1/12 al 30/4; la clave es el año en que termina la temporada. Promedio de una celda de ~5 km centrada en la localidad.",
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
