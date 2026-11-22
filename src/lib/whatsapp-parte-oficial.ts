import { recomendacionGobierno } from "./alerta";
import { estadoHidrico } from "./lecturas";
import type { Comunidad, EstadoHidrico, LecturaSatelital } from "./types";

const ESTADOS: Record<EstadoHidrico, string> = {
  deficit: "Déficit hídrico",
  normal: "Dentro del rango climatológico",
  superavit_reciente: "Superávit de lluvia reciente",
  sin_dato: "Sin datos suficientes",
};

const decimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const indice = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function urlWhatsAppParteOficial(comunidad: Comunidad, lectura: LecturaSatelital, origen: string): string {
  const { meteorologia, ndvi } = lectura;
  const estado = estadoHidrico(lectura);
  const expediente = new URL(`/municipio/${encodeURIComponent(comunidad.id)}`, origen);
  const lineas = [
    `*Ojo Andino · Parte Oficial — ${comunidad.nombre}*`,
    `*Estado hídrico:* ${ESTADOS[estado]}`,
  ];

  if (meteorologia) {
    const lluvia = meteorologia.precipitacionMm30d;
    const desvio = lluvia.porcentaje;
    const desvioTexto = desvio === null ? "" : ` (${desvio > 0 ? "+" : ""}${decimal.format(desvio)} %)`;
    lineas.push(
      `*Lluvia — ${meteorologia.fuente}:* ${decimal.format(lluvia.observado)} mm vs. ${decimal.format(lluvia.climatologia)} mm de referencia${desvioTexto}. Período: ${lluvia.ventana}.`,
    );
  }

  if (ndvi) {
    const ultimo = ndvi.ultimoComposite;
    lineas.push(`*Índice de verdor (NDVI):* ${indice.format(ultimo.ndvi)} (compuesto del ${ultimo.fecha}, ${ndvi.fuente}).`);
  }

  if (estado !== "sin_dato") {
    lineas.push(`\n*Acción recomendada:* ${recomendacionGobierno(comunidad, lectura)}`);
  }

  lineas.push(`\n*Expediente oficial:* ${expediente.href}`);
  return `https://wa.me/?text=${encodeURIComponent(lineas.join("\n"))}`;
}
