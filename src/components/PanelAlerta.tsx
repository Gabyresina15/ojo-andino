"use client";

import { useEffect, useRef, useState } from "react";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import { registrarEvento } from "@/lib/traccion-cliente";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
};

export default function PanelAlerta({ comunidad, lectura, modo }: Props) {
  const [alerta, setAlerta] = useState<AlertaRespuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [audioCargando, setAudioCargando] = useState(false);
  const [vozFallback, setVozFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Al cambiar de localidad o modo el panel se remonta: cortar el audio en curso.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const generar = async () => {
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
      setAlerta(data);
      registrarEvento("alerta", comunidad.id);
    } catch (e) {
      setError(`No se pudo generar la alerta: ${(e as Error).message}`);
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
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const escuchar = async () => {
    if (!alerta) return;
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
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
    } catch {
      reproducirFallbackNavegador(alerta.resumen_oral);
    } finally {
      setAudioCargando(false);
    }
  };

  const whatsappUrl = alerta
    ? `https://wa.me/?text=${encodeURIComponent(
        `${alerta.resumen_oral}\n\n${alerta.fuentes}\n\nVer tablero: ${
          typeof window !== "undefined" ? `${window.location.origin}/?c=${comunidad.id}` : ""
        }`,
      )}`
    : "#";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
            Grok + Validación Determinista (Zod)
          </span>
          <h3 className="text-base font-semibold text-white">Alerta en castellano simple, voz y WhatsApp</h3>
        </div>
        <button
          onClick={generar}
          disabled={!lectura || cargando}
          className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-xs px-4 py-2 transition"
        >
          {cargando ? "Generando y validando…" : "✨ Generar alerta"}
        </button>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      {alerta && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-full border border-white/15 text-slate-200">
              Motor: {alerta.origen === "grok" ? `Grok (${alerta.modelo})` : "Redactor determinista (respaldo)"}
            </span>
            <span className="px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-300">
              ✓ {alerta.validacion.numerosVerificados}/{alerta.validacion.numerosEncontrados} números verificados
            </span>
            {alerta.validacion.motivoFallback && (
              <span className="px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-200">
                Fallback: {alerta.validacion.motivoFallback}
              </span>
            )}
          </div>

          <p className="rounded-xl bg-black/40 border border-white/10 p-3.5 text-sm leading-relaxed text-slate-100">
            {alerta.resumen_oral}
          </p>

          {modo === "parametrico" && (
            <p className="rounded-xl bg-sky-950/30 border border-sky-400/30 p-3 text-xs text-sky-100">
              <strong>Nota paramétrica B2B:</strong> {alerta.nota_parametrica}
            </p>
          )}

          <p className="text-[11px] text-slate-400">{alerta.fuentes}</p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={escuchar}
              disabled={audioCargando}
              className="rounded-xl border border-white/20 hover:bg-white/10 text-white text-xs font-medium px-3.5 py-2 transition"
            >
              {audioCargando ? "Sintetizando voz…" : "🔊 Escuchar audio"}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => registrarEvento("whatsapp", comunidad.id)}
              className="rounded-xl bg-[#25D366] hover:bg-[#22c35e] text-black text-xs font-semibold px-3.5 py-2 transition"
            >
              📲 Enviar por WhatsApp
            </a>
            {vozFallback && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-200">
                Voz del navegador (respaldo)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
