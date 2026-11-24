const ventanas = new Map<string, { inicio: number; n: number }>();

/**
 * Límite por IP en memoria (por instancia serverless: frena ráfagas, no reemplaza un límite distribuido).
 * Devuelve true si el pedido excede `max` en `ventanaMs`.
 */
export function excedeLimite(req: Request, clave: string, max: number, ventanaMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";
  const k = `${clave}:${ip}`;
  const ahora = Date.now();
  const v = ventanas.get(k);
  if (!v || ahora - v.inicio >= ventanaMs) {
    if (ventanas.size > 5000) ventanas.clear();
    ventanas.set(k, { inicio: ahora, n: 1 });
    return false;
  }
  v.n++;
  return v.n > max;
}
