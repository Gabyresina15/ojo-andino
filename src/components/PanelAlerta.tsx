"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import { alertaDeterminista, payloadUsuario, validarNumeros } from "@/lib/alerta";
import { estadoHidrico } from "@/lib/lecturas";
import { registrarEvento } from "@/lib/traccion-cliente";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
};

const BARRAS_EQ = [30, 65, 45, 90, 55, 100, 72, 40, 85, 60, 95, 50];
const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
      registrarEvento("alerta", comunidad.id);
      avisarToast("✓ Mensaje actualizado con Grok AI");
    } catch {
      setError("Mostrando recomendación verificada con datos locales.");
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
    registrarEvento("audio", comunidad.id);
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
        `*Ojo Andino · Estado de Agua y Pasturas en ${comunidad.nombre}*\n\n${alerta.resumen_oral}\n\nVer mapa: ${
          typeof window !== "undefined" ? `${window.location.origin}/?c=${comunidad.id}` : ""
        }`,
      )}`
    : "#";

  const diagnostico =
    est === "deficit"
      ? {
          semaforo: "🔴 URGENCIA ALTA · FALTA AGUA",
          colorCaja: "border-[#D95D39]/60 bg-[#D95D39]/15 text-[#F4F1EA]",
          decision: "Priorizar asistencia de forraje y revisar aguadas antes de mover la hacienda.",
        }
      : est === "superavit_reciente"
        ? {
            semaforo: "🟢 EN RECUPERACIÓN · BUENA LLUVIA RECIENTE",
            colorCaja: "border-[#10B981]/50 bg-[#10B981]/15 text-[#F4F1EA]",
            decision: "Aprovechar la humedad de noviembre para seguir el rebrote natural antes de comprar más fardos.",
          }
        : {
            semaforo: "🟡 CONDICIÓN ESTABLE · LLUVIA NORMAL",
            colorCaja: "border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#F4F1EA]",
            decision: "Lluvias dentro de lo habitual para la época. Mantener manejo regular de pasturas.",
          };

  const nivelVerdor = !ndvi
    ? "Sin lectura"
    : ndvi.ultimoComposite.ndvi < 0.11
      ? "Muy bajo (suelo seco)"
      : ndvi.ultimoComposite.ndvi < 0.22
        ? "Bajo (inicio de rebrote)"
        : "Moderado a bueno";

  return (
    <div className="amc-surface-elevated rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D95D39] via-[#F59E0B] to-[#10B981]" />

      {/* Encabezado limpio: Pueblo + Decisión concreta */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${diagnostico.colorCaja}`}>
            {diagnostico.semaforo}
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F1EA]">
            {comunidad.nombre} <span className="text-base font-normal text-[#9CA3AF]">({comunidad.region === "puna" ? "Puna" : "Quebrada"})</span>
          </h2>
          <p className="text-sm sm:text-base font-medium text-[#F4F1EA]/95">
            👉 <strong>Qué hacer hoy:</strong> {diagnostico.decision}
          </p>
        </div>

        <button
          onClick={generarConGrok}
          disabled={!lectura || cargando}
          className="min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 disabled:opacity-50 text-[#F4F1EA] font-medium text-xs px-3.5 py-2 transition cursor-pointer flex items-center gap-1.5"
        >
          <span className={cargando ? "animate-spin text-[#F59E0B]" : "text-[#F59E0B]"}>✨</span>
          <span>{cargando ? "Redactando con Grok…" : alerta?.origen === "grok" ? "Regenerar texto con IA" : "Redactar con Grok AI"}</span>
        </button>
      </div>

      {/* 3 Indicadores en lenguaje humano (cero siglas técnicas en crudo) */}
      {m && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-4">
            <div className="text-xs text-[#9CA3AF]">🌧️ Agua caída (últimos 30 días)</div>
            <div className="font-mono text-2xl font-extrabold text-[#F4F1EA] mt-1">
              {fmt1(m.precipitacionMm30d.observado)} mm
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              Lo normal para la fecha: <strong className="text-[#F4F1EA]">{fmt1(m.precipitacionMm30d.climatologia)} mm</strong>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-4">
            <div className="text-xs text-[#9CA3AF]">🌱 Estado del pasto y vegetación</div>
            <div className="font-display text-xl font-extrabold text-[#10B981] mt-1">
              {nivelVerdor}
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              {ndvi?.compositeAnioAnterior
                ? ndvi.ultimoComposite.ndvi >= ndvi.compositeAnioAnterior.ndvi
                  ? "Levemente mejor que en noviembre 2025"
                  : "Más seco que en noviembre 2025"
                : "Medición satelital cada 16 días"}
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-4">
            <div className="text-xs text-[#9CA3AF]">🌡️ Clima de la última semana</div>
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

      {/* Mensaje listo para escuchar y reenviar por WhatsApp */}
      {alerta && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#F59E0B]">
                💬 Mensaje listo para el productor o técnico municipal:
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
                  ✓ Datos verificados ({alerta.origen === "grok" ? "Grok AI" : "Satélite NASA/MODIS"})
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-[#F4F1EA]">
              “{alerta.resumen_oral}”
            </p>

            {vozFallback && (
              <span className="inline-block text-[11px] text-[#F59E0B]">
                Reproduciendo con voz local del dispositivo (modo sin conexión)
              </span>
            )}
          </div>

          {/* 2 Botones Principales Grandes y Claros */}
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
                  ? "Preparando audio…"
                  : reproduciendo
                    ? "Detener audio"
                    : "Escuchar recomendación en voz alta"}
              </span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => registrarEvento("whatsapp", comunidad.id)}
              className="min-h-[50px] rounded-2xl bg-[#10B981] hover:bg-[#10B981]/90 text-[#0B0D10] font-bold text-sm px-5 py-3.5 transition flex items-center justify-center gap-2.5 shadow-lg"
            >
              <span className="text-lg">📲</span>
              <span>Enviar alerta por WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
