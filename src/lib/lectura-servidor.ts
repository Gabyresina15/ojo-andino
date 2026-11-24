import type { Comunidad, LecturaSatelital } from "./types";
import { leerTodo } from "./lecturas";
import { lecturaCacheada } from "./cache";

const memoria = new Map<string, { t: number; l: LecturaSatelital }>();
const TTL = 30 * 60 * 1000;
const TTL_SIN_DATO = 60 * 1000;
const enVuelo = new Map<string, Promise<LecturaSatelital>>();

/** Lectura obtenida por el servidor: lo que llegó en vivo gana; lo que faltó cae al cache del deploy. */
export async function lecturaServidor(c: Comunidad): Promise<LecturaSatelital> {
  const m = memoria.get(c.id);
  if (m && Date.now() - m.t < (m.l.fuenteCache ? TTL_SIN_DATO : TTL)) return m.l;

  // Pedidos simultáneos comparten una sola consulta a NASA/ORNL.
  let p = enVuelo.get(c.id);
  if (!p) {
    p = consultar(c).finally(() => enVuelo.delete(c.id));
    enVuelo.set(c.id, p);
  }
  return p;
}

async function consultar(c: Comunidad): Promise<LecturaSatelital> {
  const viva = await leerTodo(c.id, c.lat, c.lon);
  const cache = lecturaCacheada(c.id);
  const l: LecturaSatelital = {
    ...viva,
    meteorologia: viva.meteorologia ?? cache?.meteorologia ?? null,
    ndvi: viva.ndvi ?? cache?.ndvi ?? null,
    fuenteCache: !viva.meteorologia && !!cache?.meteorologia,
  };
  // Si la fuente falló también se recuerda, por poco tiempo, para no insistirle en cada pedido.
  memoria.set(c.id, { t: Date.now(), l });
  return l;
}
