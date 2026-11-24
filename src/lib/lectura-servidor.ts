import type { Comunidad, LecturaSatelital } from "./types";
import { leerTodo } from "./lecturas";
import { lecturaCacheada } from "./cache";

const memoria = new Map<string, { t: number; l: LecturaSatelital }>();
const TTL = 30 * 60 * 1000;

/** Lectura obtenida por el servidor: lo que llegó en vivo gana; lo que faltó cae al cache del deploy. */
export async function lecturaServidor(c: Comunidad): Promise<LecturaSatelital> {
  const m = memoria.get(c.id);
  if (m && Date.now() - m.t < TTL) return m.l;

  const viva = await leerTodo(c.id, c.lat, c.lon);
  const cache = lecturaCacheada(c.id);
  const l: LecturaSatelital = {
    ...viva,
    meteorologia: viva.meteorologia ?? cache?.meteorologia ?? null,
    ndvi: viva.ndvi ?? cache?.ndvi ?? null,
    fuenteCache: !viva.meteorologia && !!cache?.meteorologia,
  };
  if (viva.meteorologia) memoria.set(c.id, { t: Date.now(), l });
  return l;
}
