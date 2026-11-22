"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import { alertaDeterminista, payloadUsuario, recomendacionGobierno, validarNumeros } from "@/lib/alerta";
import { estadoHidrico } from "@/lib/lecturas";
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
  const [alertaGrok, setAlertaGrok] = useState<AlertaRespuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const alertaBase = useMemo<AlertaRespuesta | null>(() => {
    if (!lectura) return null;
    const det = alertaDeterminista(comunidad, lectura, "comunidad");
    const payload = payloadUsuario(comunidad, lectura, "comunidad");
    const v = validarNumeros(`${det.resumen_oral} ${det.nota_parametrica}`, payload);
    return {
      comunidadId: comunidad.id,
      modo: "comunidad",
      ...det,
      origen: "determinista",
      modelo: null,
      validacion: { ...v, estadoCorregido: false, motivoFallback: null },
      generadoEn: lectura.generadoEn,
    };
  }, [comunidad, lectura]);

  // Al entrar a una jurisdicción, solicita automáticamente a Grok AI el dictamen oficial actualizado en background
  useEffect(() => {
    if (!lectura) return;
    let cancelado = false;
    setCargando(true);
    fetch("/api/alerta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: comunidad.id, modo: "comunidad", lectura }),
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
  }, [comunidad.id, lectura]);

  const alerta = alertaGrok ?? alertaBase;
  const m = lectura?.meteorologia;
  const ndvi = lectura?.ndvi;
  const est = lectura ? estadoHidrico(lectura) : "sin_dato";
  const jurisdiccion = JURISDICCION_MUNICIPAL[comunidad.id] ?? `Municipio de ${comunidad.nombre}`;

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

  const accionDirecta = lectura ? recomendacionGobierno(comunidad, lectura) : "Evaluando datos satelitales…";

  const nivelVerdor = !ndvi
    ? "Sin lectura"
    : ndvi.ultimoComposite.ndvi < 0.11
      ? "Crítico (suelo muy seco)"
      : ndvi.ultimoComposite.ndvi < 0.22
        ? "Bajo (inicio de rebrote)"
        : "Bueno (cobertura activa)";

  const copiarLinkExpediente = async () => {
    const url = `${window.location.origin}/municipio/${comunidad.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // ignore
    }
  };

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
            <span className="text-xs font-medium text-[#9CA3AF]">{jurisdiccion}</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F1EA]">
            {comunidad.nombre}{" "}
            <span className="text-base font-normal text-[#9CA3AF]">
              · {comunidad.region === "puna" ? "Puna Jujeña" : "Quebrada de Humahuaca"}
            </span>
          </h2>
          <p className="text-sm sm:text-base font-medium text-[#F4F1EA]/95">
            🏛️ <strong>Acción de Gobierno recomendada:</strong> {accionDirecta}
          </p>
        </div>
      </div>

      {/* 3 Indicadores clave de la jurisdicción */}
      {m && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-4">
            <div className="text-xs text-[#9CA3AF]">🌧️ Lluvia acumulada (30 días)</div>
            <div className="font-mono text-2xl font-extrabold text-[#F4F1EA] mt-1">
              {fmt1(m.precipitacionMm30d.observado)} mm
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              Promedio histórico: <strong className="text-[#F4F1EA]">{fmt1(m.precipitacionMm30d.climatologia)} mm</strong> (
              {(m.precipitacionMm30d.porcentaje ?? 0) >= 0 ? "+" : ""}
              {fmt1(m.precipitacionMm30d.porcentaje ?? 0)}%)
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
            <div className="text-xs text-[#9CA3AF]">🌡️ Temperatura media (7 días)</div>
            <div className="font-mono text-2xl font-extrabold text-[#F4F1EA] mt-1">
              {fmt1(m.temperaturaC7d.mediaObservada)} °C
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              Promedio histórico del mes: <strong className="text-[#F4F1EA]">{fmt1(m.temperaturaC7d.climatologiaMes)} °C</strong>
            </div>
          </div>
        </div>
      )}

      {/* Dictamen Técnico Oficial + Acceso al Expediente Histórico y PDF */}
      {alerta && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 sm:p-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#F59E0B] flex items-center gap-1.5">
                <ChakanaIcon className="h-3.5 w-3.5 text-[#D95D39]" />
                <span>Dictamen Técnico Oficial · {jurisdiccion}</span>
              </span>
              <span className="text-[11px] text-[#10B981]">
                {cargando
                  ? "● Actualizando redacción con Grok AI…"
                  : `✓ Datos verificados (${alerta.origen === "grok" ? "Grok AI" : "NASA POWER / MODIS"})`}
              </span>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-[#F4F1EA]">{alerta.resumen_oral}</p>

            <div className="text-[11px] text-[#9CA3AF] pt-1">{alerta.fuentes}</div>
          </div>

          {/* Botones de Expediente Histórico + Link Directo */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <Link
              href={`/municipio/${comunidad.id}`}
              className="min-h-[50px] rounded-2xl bg-[#D95D39] hover:bg-[#D95D39]/90 text-[#F4F1EA] font-bold text-sm px-5 py-3.5 transition flex items-center justify-center gap-2.5 shadow-lg"
            >
              <span>📂</span>
              <span>Abrir Registro Histórico Completo e Informe PDF de {comunidad.nombre} →</span>
            </Link>

            <button
              onClick={copiarLinkExpediente}
              className="min-h-[50px] rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#F4F1EA] font-semibold text-xs px-4 py-3.5 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🔗</span>
              <span>{copiado ? "✓ Link copiado" : "Copiar link del municipio"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
