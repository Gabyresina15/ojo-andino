/**
 * Prueba retrospectiva de /metodologia: qué habría dicho el sistema el día de un evento conocido.
 * Nada se escribe a mano: las coordenadas salen de BAHRA (IGN/INDEC), la lluvia de NASA POWER y CHIRPS,
 * y los estados de las mismas funciones que usa el tablero.  Correr:  npm run backtest
 */
import { writeFileSync } from "node:fs";
import { estadoHidrico, fetchJson, leerMeteorologia, UMBRAL_30D_PCT, UMBRAL_TEMPORADA_PCT } from "../src/lib/lecturas";
import type { LecturaSatelital } from "../src/lib/types";
import { CHIRPS_VERSION, temporadasChirps } from "./chirps-temporadas";

const EVENTO = {
  fecha: "2026-09-23",
  descripcion: "Entrega de alfalfa de la Provincia en los cinco departamentos puneños por sequía",
};
/** Cabeceras de los cinco departamentos puneños, por código de asentamiento BAHRA. */
const CABECERAS = ["38007020", "38084100", "38112050", "38077100", "38049040"];
const BAHRA = "https://wms.ign.gob.ar/geoserver/ign/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=ign:localidad_bahra&outputFormat=application/json";
const CLIMA = [2001, 2025] as const;

type Bahra = { features: { properties: { cod_ase: string; fna: string; nom_depto: string; lat_gd: string; long_gd: string } }[] };
type Power = { properties: { parameter: { PRECTOTCORR: Record<string, number> } } };

const r1 = (n: number) => Math.round(n * 10) / 10;
const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

function desvio(serie: Record<string, number>, anio: number): number | null {
  const base = Object.entries(serie).filter(([a]) => +a >= CLIMA[0] && +a <= CLIMA[1]).map(([, v]) => v);
  return serie[anio] === undefined || base.length < 20 ? null : r1((serie[anio] / media(base) - 1) * 100);
}

function correlacion(a: Record<string, number>, b: Record<string, number>): number | null {
  const anios = Object.keys(a).filter((k) => b[k] !== undefined);
  if (anios.length < 20) return null;
  const x = anios.map((k) => a[k]);
  const y = anios.map((k) => b[k]);
  const mx = media(x);
  const my = media(y);
  const cov = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const sx = Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0));
  const sy = Math.sqrt(y.reduce((s, v) => s + (v - my) ** 2, 0));
  return Math.round((cov / (sx * sy)) * 100) / 100;
}

async function temporadasNasa(lat: number, lon: number, hasta: number): Promise<Record<string, number>> {
  const d = await fetchJson<Power>(
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&format=JSON&start=20001201&end=${hasta}0430`,
    60000,
  );
  const P = d.properties.parameter.PRECTOTCORR;
  const out: Record<string, number> = {};
  for (let anio = 2001; anio <= hasta; anio++) {
    const dias = Object.entries(P).filter(([f, v]) => f >= `${anio - 1}1201` && f <= `${anio}0430` && v >= 0);
    if (dias.length >= 140) out[anio] = r1(dias.reduce((s, [, v]) => s + v, 0));
  }
  return out;
}

async function main() {
  const anio = Number(EVENTO.fecha.slice(0, 4));
  const filtro = encodeURIComponent(`cod_ase IN (${CABECERAS.map((c) => `'${c}'`).join(",")})`);
  const bahra = await fetchJson<Bahra>(`${BAHRA}&CQL_FILTER=${filtro}`, 60000);
  const filas = [];
  for (const cod of CABECERAS) {
    const p = bahra.features.find((f) => f.properties.cod_ase === cod)?.properties;
    if (!p) throw new Error(`BAHRA no devolvió el asentamiento ${cod}`);
    const lat = Number(p.lat_gd);
    const lon = Number(p.long_gd);
    const m = await leerMeteorologia(lat, lon, new Date(`${EVENTO.fecha}T12:00:00Z`));
    const lectura = { comunidadId: cod, meteorologia: m } as LecturaSatelital;
    const p30 = m.precipitacionMm30d;
    const nasa = await temporadasNasa(lat, lon, anio);
    const chirps = (await temporadasChirps([{ id: cod, lat, lon }], anio))[cod];
    filas.push({
      lugar: p.fna,
      departamento: p.nom_depto,
      codBahra: cod,
      lat,
      lon,
      corteDatos: m.ultimoDiaConDato,
      lluvia30d: { observado: p30.observado, normal: p30.climatologia, porcentaje: p30.porcentaje },
      estadoRegla30d: p30.porcentaje === null ? "sin_dato" : p30.porcentaje <= -UMBRAL_30D_PCT ? "deficit" : p30.porcentaje >= UMBRAL_30D_PCT ? "superavit_reciente" : "normal",
      temporadaNasaPct: m.precipitacionTemporada?.porcentaje ?? null,
      estadoReglaActual: estadoHidrico(lectura),
      chirpsPct: desvio(chirps, anio),
      temporadaAnterior: { nasaPct: desvio(nasa, anio - 1), chirpsPct: desvio(chirps, anio - 1) },
      correlacionTemporadas: correlacion(nasa, chirps),
    });
    console.log(filas[filas.length - 1]);
  }
  writeFileSync(
    new URL("../src/data/backtest.json", import.meta.url),
    JSON.stringify(
      {
        generadoEn: new Date().toISOString(),
        evento: EVENTO,
        umbrales: { temporadaPct: UMBRAL_TEMPORADA_PCT, lluvia30dPct: UMBRAL_30D_PCT },
        fuentes: {
          coordenadas: "Base de Asentamientos Humanos de la República Argentina (BAHRA), IGN/INDEC, vía WFS del IGN",
          lluvia: "NASA POWER (PRECTOTCORR), serie hasta la fecha del evento",
          segundaFuente: `CHIRPS v${CHIRPS_VERSION} (Climate Hazards Center, UCSB), totales mensuales, píxel de ~5 km`,
        },
        nota: `temporadaNasaPct: desvío frente a la climatología mensual de NASA POWER, como en el tablero. chirpsPct, temporadaAnterior y correlacionTemporadas: totales del 1/12 al 30/4 frente al promedio ${CLIMA[0]}–${CLIMA[1]} de cada fuente. CHIRPS: suma de los meses de diciembre a abril.`,
        filas,
      },
      null,
      1,
    ) + "\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
