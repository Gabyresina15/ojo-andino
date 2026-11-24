/**
 * Contraste de la lluvia satelital con una estación en tierra: INTA Abra Pampa (sistema SIGA de INTA).
 * Compara el total de cada temporada de lluvias (1/12 al 30/4) de la estación con NASA POWER y CHIRPS
 * en la coordenada de la estación. Nada se escribe a mano: la coordenada sale del listado de SIGA.
 * El pedido a SIGA es el que hace su visor web; no es un servicio documentado ni tiene licencia publicada.
 * Por eso se usa solo acá, fuera del tablero:  npm run estacion
 */
import { writeFileSync } from "node:fs";
import { CHIRPS_VERSION, temporadasChirps } from "./chirps-temporadas";

const SIGA = "https://siga.inta.gob.ar/MMidUDJTKj6MPyuA.php";
const ID_ESTACION = 516;
const MAX_DIAS_FALTANTES = 0;

type Estacion = { id: number; nombre: string; latitud: number; longitud: number; altura: number };
type Dia = { fechaHora: string; precDiaCrono?: number | null };

async function siga<T>(tipo: string, valor: string): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(`${SIGA}?param_type=${tipo}&param_value=${valor}`, { signal: AbortSignal.timeout(180000) });
      if (!r.ok) throw new Error(`SIGA ${r.status}`);
      const t = await r.text();
      return (t ? JSON.parse(t) : []) as T;
    } catch (e) {
      if (i >= 4) throw e;
    }
  }
}

function diasTemporada(anio: number): string[] {
  const out: string[] = [];
  for (let d = Date.UTC(anio - 1, 11, 1); d <= Date.UTC(anio, 3, 30); d += 86400000) out.push(new Date(d).toISOString().slice(0, 10));
  return out;
}

const corr = (a: number[], b: number[]) => {
  const m = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const [ma, mb] = [m(a), m(b)];
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const r = cov / Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0));
  return Math.round(r * 100) / 100;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

async function main() {
  const hasta = Number(process.argv[2] ?? new Date().getUTCFullYear());
  const est = (await siga<Estacion[]>("estacion", "")).find((e) => e.id === ID_ESTACION);
  if (!est) throw new Error(`SIGA no devolvió la estación ${ID_ESTACION}`);

  const lluvia = new Map<string, number>();
  for (let a = 2013; a <= hasta; a++) {
    for (const d of await siga<Dia[]>("diario", `${ID_ESTACION}/01-01-${a}/31-12-${a}`)) {
      if (typeof d.precDiaCrono === "number") lluvia.set(d.fechaHora.slice(0, 10), d.precDiaCrono);
    }
  }
  const fin = `${hasta}0430`;
  const power = await fetch(
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${est.longitud}&latitude=${est.latitud}&start=20131201&end=${fin}&format=JSON`,
  ).then((r) => r.json());
  const nasaDia = power.properties.parameter.PRECTOTCORR as Record<string, number>;
  const chirps = (await temporadasChirps([{ id: "e", lat: est.latitud, lon: est.longitud }], hasta)).e;

  const temporadas: { temporada: number; estacionMm: number; diasSinDato: number; nasaMm: number; chirpsMm: number }[] = [];
  for (let a = 2014; a <= hasta; a++) {
    const dias = diasTemporada(a);
    const medidos = dias.filter((d) => lluvia.has(d));
    const nasa = dias.map((d) => nasaDia[d.replaceAll("-", "")]);
    if (dias.length - medidos.length > MAX_DIAS_FALTANTES || nasa.some((v) => v === undefined || v < 0) || chirps[a] === undefined) continue;
    temporadas.push({
      temporada: a,
      estacionMm: r1(medidos.reduce((s, d) => s + lluvia.get(d)!, 0)),
      diasSinDato: dias.length - medidos.length,
      nasaMm: r1(nasa.reduce((s, v) => s + v, 0)),
      chirpsMm: chirps[a],
    });
  }
  const col = (k: "estacionMm" | "nasaMm" | "chirpsMm") => temporadas.map((t) => t[k]);
  const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const e = col("estacionMm");
  const resumen = (v: number[]) => ({
    correlacion: corr(e, v),
    excesoPct: Math.round((media(v) / media(e) - 1) * 100),
    ultimaPct: r1((v[v.length - 1] / media(v) - 1) * 100),
  });
  const ultimo = [...lluvia.keys()].sort().pop();
  writeFileSync(
    new URL("../src/data/estacion.json", import.meta.url),
    JSON.stringify(
      {
        generadoEn: new Date().toISOString(),
        estacion: { nombre: est.nombre, organismo: "INTA", lat: est.latitud, lon: est.longitud, alturaM: est.altura, ultimoDiaConDato: ultimo },
        fuentes: {
          estacion: "Sistema de Información y Gestión Agrometeorológica (SIGA) de INTA, precipitación diaria. Acceso por el visor web, sin licencia publicada.",
          nasa: "NASA POWER (PRECTOTCORR) en la coordenada de la estación",
          chirps: `CHIRPS v${CHIRPS_VERSION} (Climate Hazards Center, UCSB), píxel de la estación`,
        },
        nota: `Totales del 1/12 al 30/4. Solo temporadas en que la estación tiene dato todos los días, para que las tres fuentes cubran el mismo período. ultimaPct: última temporada frente al promedio de las temporadas listadas, en cada fuente.`,
        temporadas,
        resumen: { estacionUltimaPct: r1((e[e.length - 1] / media(e) - 1) * 100), nasa: resumen(col("nasaMm")), chirps: resumen(col("chirpsMm")) },
      },
      null,
      1,
    ) + "\n",
  );
  console.log(temporadas, resumen(col("nasaMm")), resumen(col("chirpsMm")));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
