import type { LecturaSatelital } from "./types";

export function lecturaMasReciente(
  local: LecturaSatelital | null,
  cache: LecturaSatelital | null,
): LecturaSatelital | null {
  if (!local) return cache;
  if (!cache) return { ...local, fuenteCache: true };
  const fechaLocal = local.meteorologia?.ultimoDiaConDato ?? "";
  const fechaCache = cache.meteorologia?.ultimoDiaConDato ?? "";
  const usarLocal = fechaLocal > fechaCache ||
    (fechaLocal === fechaCache && local.generadoEn > cache.generadoEn);
  return usarLocal ? { ...local, fuenteCache: true } : cache;
}
