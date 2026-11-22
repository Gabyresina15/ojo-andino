"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import { alertaDeterminista, payloadUsuario, recomendacionGobierno, validarNumeros } from "@/lib/alerta";
import { estadoHidrico } from "@/lib/lecturas";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
};

const BARRAS_EQ = [30, 65, 45, 90, 55, 100, 72, 40, 85, 60, 95, 50];
const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const JURISDICCION: Record<string, string> = {
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

export default function PanelAlerta({ comunidad, lectura, modo }: Props) {
  const [alertaGrok, setAlertaGrok] = useState<AlertaRespuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [audioCargando, setAudioCargando] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [vozFallback, setVozFallback] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const alertaBase = useMemo<AlertaRespuesta | null>(() => {
    if (!lectura) return null;
    const det = alertaDeterminista(comunidad, lectura, modo);
    const payload = payloadUsuario(comunidad, lectura, modo);
    const v = validarNumeros(`${det.resumen_oral} ${det.nota_parametrica}`, payload);
    return {
      comunidadId: comunidad.id,
      modo,
      ...det,
      origen: "determinista",
      modelo: null,
      validacion: { ...v, estadoCorregido: false, motivoFallback: null },
      generadoEn: lectura.generadoEn,
    };
  }, [comunidad, lectura, modo]);

  const alerta = alertaGrok ?? alertaBase;
  const m = lectura?.meteorologia;
  const ndvi = lectura?.ndvi;
  const est = lectura ? estadoHidrico(lectura) : "sin_dato";
  const jurisdiccion = JURISDICCION[comunidad.id] ?? `Municipio de ${comunidad.nombre}`;

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const avisarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const detenerAudio = () => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setReproduciendo(false);
  };

  const generarConGrok = async () => {
    if (!lectura) return;
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/alerta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comunidad.id, modo, lectura }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as AlertaRespuesta;
      setAlertaGrok(data);
      avisarToast("✓ Parte oficial redactado con Grok AI");
    } catch {
      setError("Mostrando parte oficial generado con datos locales.");
    } finally {
      setCargando(false);
    }
  };

  const reproducirFallbackNavegador = (texto: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setVozFallback(true);
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-MX";
    u.rate = 0.95;
    const voces = window.speechSynthesis.getVoices();
    const es = voces.find((v) => v.lang.toLowerCase().startsWith("es"));
    if (es) u.voice = es;
    u.onend = () => setReproduciendo(false);
    u.onerror = () => setReproduciendo(false);
    window.speechSynthesis.cancel();
    setReproduciendo(true);
    window.speechSynthesis.speak(u);
  };

  const escuchar = async () => {
    if (!alerta) return;
    if (reproduciendo) {
      detenerAudio();
      return;
    }
    setAudioCargando(true);
    setVozFallback(false);
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: alerta.resumen_oral }),
      });
      if (!r.ok) throw new Error(`TTS HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setReproduciendo(false);
      a.onerror = () => setReproduciendo(false);
      setReproduciendo(true);
      await a.play();
    } catch {
      reproducirFallbackNavegador(alerta.resumen_oral);
    } finally {
      setAudioCargando(false);
    }
  };

  const whatsappUrl = alerta
    ? `https://wa.me/?text=${encodeURIComponent(
        `*Parte Hídrico y Territorial · ${jurisdiccion}*\n\n${alerta.resumen_oral}\n\n_${alerta.fuentes}_\n\nTablero Jujuy: ${
          typeof window !== "undefined" ? `${window.location.origin}/?c=${comunidad.id}` : ""
        }`,
      )}`
    : "#";

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

  const accionDirecta = lectura ? recomendacionGobierno(comunidad, lectura) : "Cargando evaluación satelital…";

  const nivelVerdor = !ndvi
    ? "Sin lectura"
    : ndvi.ultimoComposite.ndvi < 0.11
      ? "Crítico (suelo muy seco)"
      : ndvi.ultimoComposite.ndvi < 0.22
        ? "Bajo (inicio de rebrote)"
        : "Bueno (cobertura activa)";

  return (
    <div className="amc-surface-elevated rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D95D39] via-[#F59E0B] to-[#10B981]" />

      {/* Encabezado Municipal / Provincial */}
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
            🏛️ <strong>Decisión sugerida para Provincia / Municipio:</strong> {accionDirecta}
          </p>
        </div>

        <button
          onClick={generarConGrok}
          disabled={!lectura || cargando}
          className="min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 disabled:opacity-50 text-[#F4F1EA] font-medium text-xs px-3.5 py-2 transition cursor-pointer flex items-center gap-1.5"
        >
          <span className={cargando ? "animate-spin text-[#F59E0B]" : "text-[#F59E0B]"}>✨</span>
          <span>
            {cargando
              ? "Redactando con Grok AI…"
              : alerta?.origen === "grok"
                ? "Actualizar parte con Grok AI"
                : "Redactar parte con Grok AI"}
          </span>
        </button>
      </div>

      {/* 3 Indicadores claros para gestión municipal */}
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
                  ? "Índice superior o igual a noviembre 2025"
                  : "Índice inferior a noviembre 2025"
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

      {toast && (
        <div role="status" className="rounded-xl border border-[#10B981]/50 bg-[#10B981]/15 px-3.5 py-2 text-xs text-[#10B981]">
          {toast}
        </div>
      )}
      {error && <p className="text-xs text-[#F59E0B]">{error}</p>}

      {/* Parte Oficial para el Comisionado Municipal o Equipo Territorial */}
      {alerta && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 sm:p-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#F59E0B]">
                📋 Parte oficial para enviar a {jurisdiccion}:
              </span>
              <div className="flex items-center gap-2">
                {reproduciendo && (
                  <div className="flex items-end gap-0.5 h-4 px-1.5">
                    {BARRAS_EQ.map((h, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-[#F59E0B] amc-eq-bar"
                        style={{ height: `${h}%`, animationDelay: `${i * 0.06}s` }}
                      />
                    ))}
                  </div>
                )}
                <span className="text-[11px] text-[#10B981]">
                  ✓ Verificado ({alerta.origen === "grok" ? "Grok AI" : "Datos NASA/MODIS"})
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-[#F4F1EA]">“{alerta.resumen_oral}”</p>

            <div className="text-[11px] text-[#9CA3AF] pt-1">{alerta.fuentes}</div>

            {vozFallback && (
              <span className="inline-block text-[11px] text-[#F59E0B]">
                Reproduciendo con sintetizador local del dispositivo
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={escuchar}
              disabled={audioCargando}
              className={`min-h-[50px] rounded-2xl font-bold text-sm px-5 py-3.5 transition flex items-center justify-center gap-2.5 shadow-lg cursor-pointer ${
                reproduciendo
                  ? "bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90"
                  : "bg-[#D95D39] text-[#F4F1EA] hover:bg-[#D95D39]/90"
              }`}
            >
              <span className="text-lg">{audioCargando ? "⏳" : reproduciendo ? "⏹" : "🔊"}</span>
              <span>
                {audioCargando
                  ? "Generando audio del parte…"
                  : reproduciendo
                    ? "Detener audio"
                    : "Escuchar parte oficial en voz alta"}
              </span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[50px] rounded-2xl bg-[#10B981] hover:bg-[#10B981]/90 text-[#0B0D10] font-bold text-sm px-5 py-3.5 transition flex items-center justify-center gap-2.5 shadow-lg"
            >
              <span className="text-lg">📲</span>
              <span>Enviar parte por WhatsApp al Municipio</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
