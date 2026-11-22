"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import { alertaDeterminista, payloadUsuario, validarNumeros } from "@/lib/alerta";
import { registrarEvento } from "@/lib/traccion-cliente";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
};

export default function PanelAlerta({ comunidad, lectura, modo }: Props) {
  const [alertaGrok, setAlertaGrok] = useState<AlertaRespuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [audioCargando, setAudioCargando] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [vozFallback, setVozFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Alerta instantánea verificada para que NUNCA haya una caja vacía al entrar.
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
    } catch (e) {
      setError(`Usando resumen verificado local (${(e as Error).message})`);
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
        `*Ojo Andino · Reporte Satelital de ${comunidad.nombre}*\n\n${alerta.resumen_oral}\n\n_${alerta.fuentes}_\n\nVer mapa en vivo: ${
          typeof window !== "undefined" ? `${window.location.origin}/?c=${comunidad.id}` : ""
        }`,
      )}`
    : "#";

  const etiquetaEstado =
    alerta?.estado_hidrico === "deficit"
      ? { txt: "⚠️ Alerta de Déficit Hídrico", cls: "bg-rose-500/20 text-rose-200 border-rose-400/50" }
      : alerta?.estado_hidrico === "superavit_reciente"
        ? { txt: "🌧️ Lluvias por encima de lo normal", cls: "bg-sky-500/20 text-sky-200 border-sky-400/50" }
        : { txt: "✅ Condición hídrica normal", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/50" };

  return (
    <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 p-5 sm:p-6 shadow-xl space-y-4">
      {/* Encabezado claro e intuitivo */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-0.5 text-xs font-semibold text-emerald-200">
              PASO 2 · El mensaje listo para el territorio
            </span>
            <span className={`text-xs px-3 py-0.5 rounded-full border font-medium ${etiquetaEstado.cls}`}>
              {etiquetaEstado.txt}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            Traducción satelital para {comunidad.nombre}
          </h3>
          <p className="text-xs text-slate-300">
            Escuchalo en voz alta o reenvialo en 1 toque al grupo de WhatsApp de la comunidad o cooperativa.
          </p>
        </div>

        <button
          onClick={generarConGrok}
          disabled={!lectura || cargando}
          className="rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 transition flex items-center gap-2"
        >
          <span>✨</span>
          <span>
            {cargando
              ? "Redactando con Grok AI…"
              : alerta?.origen === "grok"
                ? "Regenerar redacción con Grok AI"
                : "Redactar con Grok AI (xAI)"}
          </span>
        </button>
      </div>

      {error && <p className="text-xs text-amber-300">{error}</p>}

      {alerta && (
        <div className="space-y-4">
          {/* Tarjeta tipo burbuja de WhatsApp / Audio */}
          <div className="rounded-2xl bg-[#0b141a] border border-emerald-500/30 p-4 sm:p-5 space-y-3 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-black font-bold text-sm">
                  🛰️
                </span>
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    Ojo Andino · {modo === "comunidad" ? "Alerta Comunitaria (Gratis)" : "Reporte Técnico Cooperativa / B2B"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {alerta.origen === "grok" ? `Redactado por Grok (${alerta.modelo})` : "Resumen satelital instantáneo"}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-medium text-emerald-300">
                ✓ {alerta.validacion.numerosVerificados}/{alerta.validacion.numerosEncontrados} cifras verificadas con Zod
              </span>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-slate-100">
              “{alerta.resumen_oral}”
            </p>

            {modo === "parametrico" && (
              <div className="rounded-xl bg-sky-950/50 border border-sky-400/30 p-3 text-xs text-sky-100">
                <strong className="text-sky-300">Índice Paramétrico B2B:</strong> {alerta.nota_parametrica}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
              <span>{alerta.fuentes}</span>
              {vozFallback && (
                <span className="px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-200">
                  Voz del navegador (modo offline)
                </span>
              )}
            </div>
          </div>

          {/* Botones de acción grandes y claros (Mobile-first) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={escuchar}
              disabled={audioCargando}
              className={`rounded-2xl font-bold text-sm px-5 py-3.5 transition flex items-center justify-center gap-2.5 shadow-lg ${
                reproduciendo
                  ? "bg-amber-400 text-black hover:bg-amber-300"
                  : "bg-white text-slate-950 hover:bg-slate-200"
              }`}
            >
              <span className="text-lg">{audioCargando ? "⏳" : reproduciendo ? "⏹️" : "🔊"}</span>
              <span>
                {audioCargando
                  ? "Generando voz natural (xAI)…"
                  : reproduciendo
                    ? "Detener audio en voz alta"
                    : "Escuchar alerta en voz alta"}
              </span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => registrarEvento("whatsapp", comunidad.id)}
              className="rounded-2xl bg-[#25D366] hover:bg-[#22c35e] text-black font-bold text-sm px-5 py-3.5 transition flex items-center justify-center gap-2.5 shadow-lg"
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
