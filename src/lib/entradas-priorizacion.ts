export function leerFletes(texto: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) ? numero : null;
}

export function leerCosto(texto: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto)) return null;
  const numero = Number(texto.replace(",", "."));
  return Number.isSafeInteger(Math.round(numero * 100)) ? numero : null;
}
