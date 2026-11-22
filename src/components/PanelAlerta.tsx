"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import {
  alertaDeterminista,
  calcularPatronDiario,
  payloadUsuario,
  recomendacionComunidad,
  recomendacionGobierno,
  validarNumeros,
} from "@/lib/alerta";
import { estadoHidrico } from "@/lib/lecturas";
import { descargarPdfExpediente } from "@/lib/pdf-expediente";
import { ChakanaIcon } from "./AndeanMotifs";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
};

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const JURISDICCION_MUNICIPAL: Record<string, string> = {
  "susques": "Comisión Municipal de Susques",
  "abra-pampa": "Municipalidad de Abra Pampa",
  "la-quiaca": "Municipalidad de La Quiaca",
  "yavi": "Comisión Municipal de Yavi",
  "humahuaca": "Municipalidad de Humahuaca",
  "tilcara": "Municipalidad de Tilcara",
  "maimara": "Comisión Municipal de Maimará",
  "purmamarca": "Comisión Municipal de Purmamarca",
  "tumbaya": "Comisión Municipal de Tumbaya",
  "volcan": "Comisión Municipal de Volcán",
};

export default function PanelAlerta({ comunidad, lectura }: Props) {
  const [modoDictamen, setModoDictamen] = useState<"parametrico" | "comunidad">("parametrico");
  const [alertaGrok, setAlertaGrok] = useState<AlertaRespuesta | null>(null);
  const [cargando, setCargando] = useState(false);

  const alertaBase = useMemo<AlertaRespuesta | null>(() => {
    if (!lectura) return null;
    const det = alertaDeterminista(comunidad, lectura, modoDictamen);
    const payload = payloadUsuario(comunidad, lectura, modoDictamen);
    const v = validarNumeros(`${det.resumen_oral} ${det.nota_parametrica}`, payload);
    return {
      comunidadId: comunidad.id,
      modo: modoDictamen,
      ...det,
      origen: "determinista",
      modelo: null,
      validacion: { ...v, estadoCorregido: false, motivoFallback: null },
      generadoEn: lectura.generadoEn,
    };
  }, [comunidad, lectura, modoDictamen]);

  useEffect(() => {
    if (!lectura) return;
    let cancelado = false;
    setAlertaGrok(null);
    setCargando(true);
    fetch("/api/alerta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: comunidad.id, modo: modoDictamen, lectura }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AlertaRespuesta | null) => {
        if (!cancelado && data) setAlertaGrok(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [comunidad.id, lectura, modoDictamen]);

  const alerta = alertaGrok ?? alertaBase;
  const m = lectura?.meteorologia;
  const ndvi = lectura?.ndvi;
  const patron = lectura ? calcularPatronDiario(lectura) : null;
  const est = lectura ? estadoHidrico(lectura) : "sin_dato";
  const jurisdiccion = JURISDICCION_MUNICIPAL[comunidad.id] ?? `Municipio de ${comunidad.nombre}`;
  const expedienteNro = `EXP-JUJ-2026-${comunidad.id.toUpperCase()}`;

  const diagnostico =
    est === "deficit"
      ? {
          semaforo: "🔴 PRIORIDAD ALTA · DÉFICIT DE AGUA Y PASTURAS",
          colorCaja: "border-[#D95D39]/60 bg-[#D95D39]/15 text-[#F4F1EA]",
        }
      : est === "superavit_reciente" && comunidad.region === "quebrada"
        ? {
            semaforo: "🔵 LLUVIAS ALTAS · VIGILAR DRENAJES Y CAMINOS",
            colorCaja: "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#F4F1EA]",
          }
        : est === "superavit_reciente"
          ? {
              semaforo: "🟢 EN RECUPERACIÓN HÍDRICA · SIN EMERGENCIA DE FORRAJE",
              colorCaja: "border-[#10B981]/50 bg-[#10B981]/15 text-[#F4F1EA]",
            }
          : {
              semaforo: "🟡 CONDICIÓN ESTABLE · SEGUIMIENTO HABITUAL",
              colorCaja: "border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#F4F1EA]",
            };

  const accionDirecta = !lectura
    ? "Evaluando datos satelitales…"
    : modoDictamen === "comunidad"
      ? recomendacionComunidad(comunidad, lectura)
      : recomendacionGobierno(comunidad, lectura);

  const nivelVerdor = !ndvi
    ? "Sin lectura"
    : ndvi.ultimoComposite.ndvi < 0.11
      ? "Crítico (suelo muy seco)"
      : ndvi.ultimoComposite.ndvi < 0.22
        ? "Bajo (inicio de rebrote)"
        : "Bueno (cobertura activa)";

  const urlDerivacion = alerta
    ? `https://wa.me/?text=${encodeURIComponent(
        `*GOBIERNO DE JUJUY · DERIVACIÓN DE EXPEDIENTE ${expedienteNro}*\n*Destino:* ${jurisdiccion}\n\n*Directiva Provincial:* ${accionDirecta}\n\n*Dictamen Técnico:* ${alerta.resumen_oral}\n\n*Expediente completo y serie histórica:* ${
          typeof window !== "undefined" ? `${window.location.origin}/municipio/${comunidad.id}` : ""
        }`,
      )}`
    : "#";

  return (
    <div className="amc-surface-elevated rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D95D39] via-[#F59E0B] to-[#10B981]" />

      {/* Encabezado de la Jurisdicción Municipal */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${diagnostico.colorCaja}`}>
              {diagnostico.semaforo}
            </span>
            <span className="font-mono text-xs text-[#9CA3AF]">
              {expedienteNro} · {jurisdiccion}
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F1EA]">
            {comunidad.nombre}{" "}
            <span className="text-base font-normal text-[#9CA3AF]">
              · {comunidad.region === "puna" ? "Puna Jujeña" : "Quebrada de Humahuaca"}
            </span>
          </h2>
          <p className="text-sm sm:text-base font-medium text-[#F4F1EA]/95">
            🏛️{" "}
            <strong>
              {modoDictamen === "parametrico" ? "Directiva Provincial → Municipio:" : "Recomendación para el Productor:"}
            </strong>{" "}
            {accionDirecta}
          </p>
        </div>
      </div>

      {/* 3 Indicadores resumen + Racha seca / Concentración */}
      {m && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-4">
            <div className="text-xs text-[#9CA3AF]">🌧️ Lluvia acumulada (30 días)</div>
            <div className="font-mono text-2xl font-extrabold text-[#F4F1EA] mt-1">
              {fmt1(m.precipitacionMm30d.observado)} mm
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              Normal: <strong className="text-[#F4F1EA]">{fmt1(m.precipitacionMm30d.climatologia)} mm</strong> (
              {(m.precipitacionMm30d.porcentaje ?? 0) >= 0 ? "+" : ""}
              {fmt1(m.precipitacionMm30d.porcentaje ?? 0)}%)
              {patron ? ` · Racha seca: ${patron.racha_seca_maxima_dias}d` : ""}
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-4">
            <div className="text-xs text-[#9CA3AF]">🌱 Estado de pasturas y suelo</div>
            <div className="font-display text-xl font-extrabold text-[#10B981] mt-1">{nivelVerdor}</div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              {ndvi?.compositeAnioAnterior
                ? ndvi.ultimoComposite.ndvi >= ndvi.compositeAnioAnterior.ndvi
                  ? "Igual o superior a noviembre 2025"
                  : "Inferior a noviembre 2025"
                : "Relevamiento satelital cada 16 días"}
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-4">
            <div className="text-xs text-[#9CA3AF]">🌡️ Temperatura y pico diario</div>
            <div className="font-mono text-2xl font-extrabold text-[#F4F1EA] mt-1">
              {fmt1(m.temperaturaC7d.mediaObservada)} °C
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              Normal mes: <strong className="text-[#F4F1EA]">{fmt1(m.temperaturaC7d.climatologiaMes)} °C</strong>
              {patron ? ` · Pico 24h: ${fmt1(patron.pico_maximo_mm)} mm (${patron.concentracion_pico_pct}%)` : ""}
            </div>
          </div>
        </div>
      )}

      {/* Dictamen Hidrológico con Switch Gobierno vs Productor + Badge Firewall Numérico */}
      {alerta && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="inline-flex rounded-xl bg-white/5 p-1 border border-white/10 text-xs">
                <button
                  onClick={() => setModoDictamen("parametrico")}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    modoDictamen === "parametrico"
                      ? "bg-[#F59E0B] text-[#0B0D10]"
                      : "text-[#9CA3AF] hover:text-[#F4F1EA]"
                  }`}
                >
                  🏛️ Dictamen Gobierno / Municipio
                </button>
                <button
                  onClick={() => setModoDictamen("comunidad")}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    modoDictamen === "comunidad"
                      ? "bg-[#D95D39] text-[#F4F1EA]"
                      : "text-[#9CA3AF] hover:text-[#F4F1EA]"
                  }`}
                >
                  👨‍🌾 Mensaje al Productor
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-mono px-2.5 py-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] font-bold">
                  ✓ {alerta.validacion.numerosVerificados}/{alerta.validacion.numerosEncontrados} cifras verificadas (Zod)
                </span>
                <span className="text-[#9CA3AF]">
                  {cargando
                    ? "● Analizando con Grok AI…"
                    : alerta.origen === "grok"
                      ? `Grok AI (${alerta.modelo})`
                      : "Motor Hidrológico"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-[#F59E0B]">
              <ChakanaIcon className="h-3.5 w-3.5 text-[#D95D39]" />
              <span>
                {modoDictamen === "parametrico"
                  ? "Justificación Técnica de Expediente (Régimen de 30 días, racha seca y concentración)"
                  : "Traducción directa para productores y familias de la jurisdicción"}
              </span>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-[#F4F1EA]">{alerta.resumen_oral}</p>

            <div className="text-[11px] text-[#9CA3AF] pt-1">{alerta.fuentes}</div>
          </div>

          {/* 3 Acciones de Comando Provincial -> Derivación Municipal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => lectura && descargarPdfExpediente(comunidad, lectura, alerta)}
              disabled={!lectura}
              className="min-h-[48px] rounded-2xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#0B0D10] font-bold text-xs px-4 py-3 transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <span>📄</span>
              <span>Descargar Anexo Oficial (.PDF)</span>
            </button>

            <a
              href={urlDerivacion}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] rounded-2xl bg-[#10B981] hover:bg-[#10B981]/90 text-[#0B0D10] font-bold text-xs px-4 py-3 transition flex items-center justify-center gap-2 shadow-lg"
            >
              <span>📨</span>
              <span>Derivar Orden al Municipio</span>
            </a>

            <Link
              href={`/municipio/${comunidad.id}`}
              className="min-h-[48px] rounded-2xl bg-[#D95D39] hover:bg-[#D95D39]/90 text-[#F4F1EA] font-bold text-xs px-4 py-3 transition flex items-center justify-center gap-2 shadow-lg"
            >
              <span>📂</span>
              <span>Ver Historial Completo (30 días) →</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
