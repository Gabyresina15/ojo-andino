import { recomendacionGobierno } from "./alerta";
import { anomaliaDelEstado, baseEstado, estadoHidrico } from "./lecturas";
import type { Comunidad, EstadoHidrico, LecturaSatelital } from "./types";

const ESTADOS: Record<EstadoHidrico, string> = {
  deficit: "Déficit hídrico",
  normal: "Dentro del rango climatológico",
  superavit_reciente: "Superávit de lluvia reciente",
  sin_dato: "Sin datos suficientes",
};

const decimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const indice = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function urlWhatsAppInformeTecnico(comunidad: Comunidad, lectura: LecturaSatelital, origen: string): string {
  const { meteorologia, ndvi } = lectura;
  const estado = estadoHidrico(lectura);
  const base = baseEstado(lectura);
  const lluvia = anomaliaDelEstado(lectura);
  const sinTemporada = base === "epoca_seca_sin_temporada";
  const expediente = new URL(`/municipio/${encodeURIComponent(comunidad.id)}`, origen);
  const lineas = [
    `*Ojo Andino · Informe técnico — ${comunidad.nombre}*`,
    `*Estado hídrico:* ${estado === "normal" && sinTemporada ? "Sin señal de déficit o superávit (época seca sin datos de temporada)" : ESTADOS[estado]}`,
  ];

  if (meteorologia && lluvia) {
    const indicador = base === "temporada_lluvias"
      ? `Temporada de lluvias${meteorologia.precipitacionTemporada?.enCurso ? " (en curso)" : ""}`
      : "Lluvia de 30 días";
    const desvio = lluvia.porcentaje;
    const desvioTexto = desvio === null ? "" : ` (${desvio > 0 ? "+" : ""}${decimal.format(desvio)} %)`;
    lineas.push(
      `*${indicador} — ${meteorologia.fuente}:* ${decimal.format(lluvia.observado)} mm vs. ${decimal.format(lluvia.climatologia)} mm de referencia${desvioTexto}. Período: ${lluvia.ventana}.`,
    );
  }

  if (ndvi) {
    const ultimo = ndvi.ultimoComposite;
    lineas.push(`*Índice de verdor (NDVI):* ${indice.format(ultimo.ndvi)} (compuesto del ${ultimo.fecha}, ${ndvi.fuente}).`);
  }

  if (estado !== "sin_dato" && !sinTemporada) {
    lineas.push(`\n*Acción recomendada:* ${recomendacionGobierno(comunidad, lectura)}`);
  }

  lineas.push(`\n*Informe completo:* ${expediente.href}`);
  return `https://wa.me/?text=${encodeURIComponent(lineas.join("\n"))}`;
}
