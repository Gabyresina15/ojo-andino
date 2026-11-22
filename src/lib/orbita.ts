import * as sat from "satellite.js";

export type Observador = { lat: number; lon: number; altKm: number };

export type EstadoSat = {
  nombre: string;
  norad: string;
  lat: number;
  lon: number;
  altKm: number;
  velKms: number;
  azimut: number;
  elevacion: number;
  rangoKm: number;
};

export type Pasada = {
  nombre: string;
  inicio: Date;
  fin: Date;
  maxElev: number;
  tMax: Date;
  /** puntos az/el para el radar polar */
  arco: { az: number; el: number }[];
  /** traza terrestre para el mapa */
  traza: [number, number][];
};

type Sat = { nombre: string; norad: string; satrec: ReturnType<typeof sat.twoline2satrec> };

export function parseTle(texto: string): Sat[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Sat[] = [];
  for (let i = 0; i + 2 < lineas.length + 1; i++) {
    if (lineas[i + 1]?.startsWith("1 ") && lineas[i + 2]?.startsWith("2 ")) {
      out.push({ nombre: lineas[i], norad: lineas[i + 1].slice(2, 7).trim(), satrec: sat.twoline2satrec(lineas[i + 1], lineas[i + 2]) });
      i += 2;
    }
  }
  return out;
}

const DEG = 180 / Math.PI;

function obsGd(o: Observador) {
  return { latitude: o.lat / DEG, longitude: o.lon / DEG, height: o.altKm };
}

export function estado(s: Sat, fecha: Date, o: Observador): EstadoSat | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pv = sat.propagate(s.satrec, fecha) as any;
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const gmst = sat.gstime(fecha);
  const gd = sat.eciToGeodetic(pv.position, gmst);
  const ecf = sat.eciToEcf(pv.position, gmst);
  const look = sat.ecfToLookAngles(obsGd(o), ecf);
  const v = pv.velocity;
  return {
    nombre: s.nombre,
    norad: s.norad,
    lat: sat.degreesLat(gd.latitude),
    lon: sat.degreesLong(gd.longitude),
    altKm: gd.height,
    velKms: v ? Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) : 0,
    azimut: look.azimuth * DEG,
    elevacion: look.elevation * DEG,
    rangoKm: look.rangeSat,
  };
}

/** Busca la próxima pasada sobre el horizonte (elev > minElev) en las próximas `horas`. */
export function proximaPasada(s: Sat, desde: Date, o: Observador, horas = 30, minElev = 10): Pasada | null {
  const paso = 20_000;
  const fin = desde.getTime() + horas * 3600_000;
  let enPasada = false;
  let p: Pasada | null = null;
  for (let t = desde.getTime(); t < fin; t += paso) {
    const f = new Date(t);
    const e = estado(s, f, o);
    if (!e) continue;
    if (e.elevacion > 0) {
      if (!enPasada) {
        enPasada = true;
        p = { nombre: s.nombre, inicio: f, fin: f, maxElev: e.elevacion, tMax: f, arco: [], traza: [] };
      }
      p!.fin = f;
      p!.arco.push({ az: e.azimut, el: e.elevacion });
      p!.traza.push([e.lat, e.lon]);
      if (e.elevacion > p!.maxElev) {
        p!.maxElev = e.elevacion;
        p!.tMax = f;
      }
    } else if (enPasada) {
      if (p!.maxElev >= minElev) return p;
      enPasada = false;
      p = null;
    }
  }
  return null;
}

export function formatoCuenta(ms: number): string {
  if (ms <= 0) return "en curso";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h > 0 ? `${h}h ` : ""}${String(m).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}
