"use client";

import { useEffect, useMemo, useState } from "react";
import { estado, formatoCuenta, parseTle, proximaPasada, type EstadoSat, type Observador, type Pasada } from "@/lib/orbita";
import tleLocal from "@/data/tle-saocom.json";

export type RadarSnapshot = {
  estados: EstadoSat[];
  proxima: Pasada | null;
  fuenteTle: "celestrak" | "cache";
  obtenidoEn: string;
};

type Props = {
  observador: Observador & { etiqueta: string };
  onSnapshot?: (s: RadarSnapshot) => void;
};

export default function RadarOrbital({ observador, onSnapshot }: Props) {
  const [tleTxt, setTleTxt] = useState<string>(tleLocal.tle || "");
  const [fuenteTle, setFuenteTle] = useState<"celestrak" | "cache">("cache");
  const [obtenidoEn, setObtenidoEn] = useState<string>(tleLocal.obtenidoEn || "");
  const [ahora, setAhora] = useState<Date>(() => new Date());

  useEffect(() => {
    fetch("/api/tle")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { tle?: string; fuente?: "celestrak" | "cache"; obtenidoEn?: string } | null) => {
        if (j?.tle) {
          setTleTxt(j.tle);
          setFuenteTle(j.fuente === "celestrak" ? "celestrak" : "cache");
          setObtenidoEn(j.obtenidoEn || "");
        }
      })
      .catch(() => {});
  }, []);

  const sats = useMemo(() => (tleTxt ? parseTle(tleTxt) : []), [tleTxt]);

  // Recalcula la próxima pasada solo cuando cambian los TLEs o el observador.
  const proxima = useMemo(() => {
    if (!sats.length) return null;
    const base = new Date();
    const pasadas = sats
      .map((s) => proximaPasada(s, base, observador, 36, 10))
      .filter((p): p is Pasada => !!p)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    return pasadas[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sats, Math.round(observador.lat * 100), Math.round(observador.lon * 100)]);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const estados = useMemo(
    () => sats.map((s) => estado(s, ahora, observador)).filter((x): x is EstadoSat => !!x),
    [sats, ahora, observador],
  );

  useEffect(() => {
    onSnapshot?.({ estados, proxima, fuenteTle, obtenidoEn });
  }, [estados, proxima, fuenteTle, obtenidoEn, onSnapshot]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-sky-300 font-semibold">
            Telemetría Orbital en Vivo (1 Hz · SGP4)
          </span>
          <h2 className="text-base font-semibold text-white">SAOCOM 1A &amp; 1B (CONAE)</h2>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border ${
            fuenteTle === "celestrak" ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"
          }`}
        >
          TLE: {fuenteTle === "celestrak" ? "CelesTrak" : "Cache local"}
        </span>
      </div>

      {estados.length === 0 ? (
        <p className="text-xs text-slate-400">Sin TLEs cargados todavía. Corré precache o conectá la red.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {estados.map((e) => (
            <div key={e.norad} className="rounded-xl bg-black/40 border border-white/10 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300">
                  🛰️ {e.nombre} <span className="text-slate-500 font-normal">#{e.norad}</span>
                </span>
                <span className={e.elevacion > 0 ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                  {e.elevacion > 0 ? `Visible (${e.elevacion.toFixed(1)}°)` : `Elev ${e.elevacion.toFixed(1)}°`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-300 font-mono">
                <span>
                  {e.lat.toFixed(2)}°, {e.lon.toFixed(2)}°
                </span>
                <span>Alt: {e.altKm.toFixed(0)} km</span>
                <span>Dist: {e.rangoKm.toFixed(0)} km</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {proxima && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-950/30 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sky-300 font-medium">Próxima pasada sobre {observador.etiqueta}</span>
            <span className="font-mono font-bold text-white">
              {formatoCuenta(proxima.inicio.getTime() - ahora.getTime())}
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            {proxima.nombre} · inicio{" "}
            {proxima.inicio.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Argentina/Jujuy",
            })}{" "}
            ART · máx elevación {proxima.maxElev.toFixed(0)}°
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed border-t border-white/10 pt-2">
        <strong>Transparencia técnica:</strong> SAOCOM 1A/1B operan radar SAR Banda L (observa a través de nubes y estima
        humedad del suelo). Aquí mostramos su <strong>telemetría orbital calculada en tu navegador con satellite.js</strong>;
        no se exhibe imagen SAR cruda.
      </p>
    </div>
  );
}
