"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import { alertaDeterminista, payloadUsuario, validarNumeros } from "@/lib/alerta";
import { registrarEvento } from "@/lib/traccion-cliente";
import { ChakanaIcon } from "./AndeanMotifs";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
};

const BARRAS_EQ = [28, 65, 45, 90, 55, 100, 72, 40, 85, 60, 95, 50, 75, 35];

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
    setTimeout(() => setToast(null), 3200);
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
      avisarToast(`✓ Alerta validada (${data.validacion.numerosVerificados}/${data.validacion.numerosEncontrados} cifras verificadas)`);
    } catch (e) {
      setError(`Respaldo determinista activo (${(e as Error).message})`);
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
        `*Ojo Andino · Reporte Satelital de ${comunidad.nombre}*\n\n${alerta.resumen_oral}\n\n_${alerta.fuentes}_\n\nTablero en vivo: ${
          typeof window !== "undefined" ? `${window.location.origin}/?c=${comunidad.id}` : ""
        }`,
      )}`
    : "#";

  const etiquetaEstado =
    alerta?.estado_hidrico === "deficit"
      ? { txt: "DÉFICIT HÍDRICO ACTIVO", cls: "bg-[#D95D39]/20 text-[#F4F1EA] border-[#D95D39]/60" }
      : alerta?.estado_hidrico === "superavit_reciente"
        ? { txt: "SUPERÁVIT DE LLUVIA RECIENTE", cls: "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/50" }
        : { txt: "CONDICIÓN HÍDRICA NORMAL", cls: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/50" };

  return (
    <div className="amc-surface-elevated rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl relative overflow-hidden">
      {/* Barra superior de acento terracota + oro solar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D95D39] via-[#F59E0B] to-[#10B981]" />

      <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#D95D39]/20 border border-[#D95D39]/50 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-[#F4F1EA]">
              <ChakanaIcon className="h-3.5 w-3.5 text-[#D95D39]" />
              PASO 02 · SÍNTESIS DE VOZ Y WHATSAPP
            </span>
            <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${etiquetaEstado.cls}`}>
              {etiquetaEstado.txt}
            </span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-[#F4F1EA]">
            Alerta territorial para {comunidad.nombre}
          </h3>
          <p className="text-xs text-[#9CA3AF]">
            Traducción validada con Zod a castellano simple, lista para escuchar o reenviar al territorio.
          </p>
        </div>

        <button
          onClick={generarConGrok}
          disabled={!lectura || cargando}
          className="min-h-[44px] rounded-xl bg-[#13171E] hover:bg-white/10 active:scale-[0.99] border border-[#F59E0B]/50 disabled:opacity-50 text-[#F4F1EA] font-semibold text-xs px-4 py-2.5 transition-all duration-200 flex items-center gap-2 cursor-pointer"
        >
          <span className={cargando ? "animate-spin" : "text-[#F59E0B]"}>✦</span>
          <span>
            {cargando
              ? "Validando con Grok + Zod…"
              : alerta?.origen === "grok"
                ? "Regenerar con Grok AI"
                : "Sintetizar con Grok AI (xAI)"}
          </span>
        </button>
      </div>

      {toast && (
        <div className="rounded-xl border border-[#10B981]/50 bg-[#10B981]/15 px-3.5 py-2 text-xs font-mono text-[#10B981]">
          {toast}
        </div>
      )}

      {error && <p className="text-xs font-mono text-[#F59E0B]">{error}</p>}

      {cargando && (
        <div className="rounded-xl border border-[#F59E0B]/30 bg-black/40 p-3.5 flex items-center gap-3 text-xs font-mono text-[#F59E0B]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] animate-ping shrink-0" />
          <span>Verificando serie NASA POWER + MODIS contra esquema Zod sin alucinación numérica…</span>
        </div>
      )}

      {alerta && (
        <div className="space-y-4">
          {/* Consola del mensaje + Ecualizador de voz */}
          <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#D95D39]/20 border border-[#D95D39]/50 flex items-center justify-center text-[#D95D39]">
                  <ChakanaIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F4F1EA]">
                    {modo === "comunidad" ? "Canal Comunitario · Freemium ($0)" : "Canal Cooperativa & Seguro Paramétrico · B2B"}
                  </div>
                  <div className="text-[11px] font-mono text-[#9CA3AF]">
                    ENGINE: {alerta.origen === "grok" ? `xAI ${alerta.modelo}` : "DETERMINISTIC_SAFE_ENGINE"}
                  </div>
                </div>
              </div>

              {/* Ecualizador animado + Badge de validación */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-end gap-0.5 h-5 px-2 py-1 rounded-md bg-white/5 border border-white/10"
                  title={reproduciendo ? "Reproduciendo audio" : "Audio listo"}
                >
                  {BARRAS_EQ.map((h, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all ${
                        reproduciendo ? "bg-[#F59E0B] amc-eq-bar" : "bg-[#9CA3AF]/40"
                      }`}
                      style={{
                        height: reproduciendo ? `${Math.max(25, h)}%` : "30%",
                        animationDelay: `${i * 0.06}s`,
                      }}
                    />
                  ))}
                </div>

                <span className="px-2.5 py-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[11px] font-mono font-bold text-[#10B981]">
                  ✓ {alerta.validacion.numerosVerificados}/{alerta.validacion.numerosEncontrados} CIFRAS OK
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-[#F4F1EA]">
              “{alerta.resumen_oral}”
            </p>

            {modo === "parametrico" && (
              <div className="rounded-xl bg-[#13171E] border border-[#F59E0B]/35 p-3.5 text-xs text-[#F4F1EA] space-y-1">
                <div className="font-mono text-[11px] uppercase font-bold text-[#F59E0B]">
                  Dictamen de Índice Paramétrico (B2B)
                </div>
                <p className="text-[#F4F1EA]/90 leading-relaxed">{alerta.nota_parametrica}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-[#9CA3AF]">
              <span>FUENTES: {alerta.fuentes}</span>
              {vozFallback && (
                <span className="px-2 py-0.5 rounded bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B]">
                  WEB_SPEECH_FALLBACK
                </span>
              )}
            </div>
          </div>

          {/* Botonera thumb-zone >= 48px de alto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={escuchar}
              disabled={audioCargando}
              className={`min-h-[48px] rounded-xl font-bold text-sm px-5 py-3 transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg cursor-pointer active:scale-[0.99] ${
                reproduciendo
                  ? "bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90"
                  : "bg-[#D95D39] text-[#F4F1EA] hover:bg-[#D95D39]/90"
              }`}
            >
              <span className="text-base">{audioCargando ? "⏳" : reproduciendo ? "⏹" : "🔊"}</span>
              <span>
                {audioCargando
                  ? "Sintetizando voz (xAI TTS)…"
                  : reproduciendo
                    ? "Detener transmisión de voz"
                    : "Escuchar alerta en voz alta"}
              </span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                registrarEvento("whatsapp", comunidad.id);
                avisarToast("✓ Abriendo WhatsApp con reporte precargado");
              }}
              className="min-h-[48px] rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 active:scale-[0.99] text-[#0B0D10] font-bold text-sm px-5 py-3 transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg"
            >
              <span className="text-base">📲</span>
              <span>Enviar alerta por WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
