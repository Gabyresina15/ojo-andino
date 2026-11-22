import cache from "../data/cache-lecturas.json";
import type { LecturaSatelital } from "./types";

const CACHE = cache as unknown as Record<string, LecturaSatelital>;

export function lecturaCacheada(id: string): LecturaSatelital | null {
  const l = CACHE[id];
  return l ? { ...l, fuenteCache: true } : null;
}

export function idsConCache(): string[] {
  return Object.keys(CACHE);
}
