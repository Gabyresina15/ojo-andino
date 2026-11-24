"use client";

import { useEffect, useMemo, useState } from "react";
import { estado, formatoCuenta, parseTle, proximaPasada, type EstadoSat, type Observador, type Pasada } from "@/lib/orbita";
import { CENTRO_JUJUY, COMUNIDADES } from "@/lib/comunidades";
import tleLocal from "@/data/tle-saocom.json";
import { ChakanaIcon } from "./AndeanMotifs";

export type RadarSnapshot = {
  estados: EstadoSat[];
  proxima: Pasada | null;
  fuenteTle: "celestrak" | "cache";
  obtenidoEn: string;
};

type Props = {
  observador: Observador & { etiqueta: string };
  onSnapshot?: (s: RadarSnapshot) => void;
  seleccion?: string;
  onSeleccion?: (id: string) => void;
};

const HORAS_BUSQUEDA = 36;
const ELEV_MINIMA = 10;
const fechaHora = (d: Date) =>
  d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Jujuy",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

function puntoPolar(azDeg: number, elDeg: number, rMax = 48, cx = 64, cy = 64) {
  const elClamped = Math.max(0, Math.min(90, elDeg));
  const r = ((90 - elClamped) / 90) * rMax;
  const rad = ((azDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function RadarOrbital({ observador, onSnapshot, seleccion, onSeleccion }: Props) {
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

  const latObs = Math.round(observador.lat * 100);
  const lonObs = Math.round(observador.lon * 100);
  const proxima = useMemo(() => {
    if (!sats.length) return null;
    const base = new Date();
    const pasadas = sats
      .map((s) => proximaPasada(s, base, observador, HORAS_BUSQUEDA, ELEV_MINIMA))
      .filter((p): p is Pasada => !!p)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    return pasadas[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sats, latObs, lonObs]);

  // Próxima pasada de cualquiera de los dos satélites sobre cada localidad del tablero.
  const porLocalidad = useMemo(() => {
    if (!sats.length) return [];
    const base = new Date();
    return COMUNIDADES.map((c) => {
      const o = { lat: c.lat, lon: c.lon, altKm: CENTRO_JUJUY.altKm };
      const p = sats
        .map((s) => proximaPasada(s, base, o, HORAS_BUSQUEDA, ELEV_MINIMA))
        .filter((x): x is Pasada => !!x)
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
      return { id: c.id, nombre: c.nombre, pasada: p ?? null };
    });
  }, [sats]);

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

  const pathArco = useMemo(() => {
    if (!proxima?.arco.length) return "";
    return proxima.arco
      .map((pt, i) => {
        const { x, y } = puntoPolar(pt.az, pt.el);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [proxima]);

  const picoPt = useMemo(() => {
    if (!proxima?.arco.length) return null;
    const mejor = [...proxima.arco].sort((a, b) => b.el - a.el)[0];
    return mejor ? puntoPolar(mejor.az, mejor.el) : null;
  }, [proxima]);

  return (
    <div className="amc-surface rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#2DD4BF] font-bold">
            <ChakanaIcon className="h-3.5 w-3.5 text-[#F59E0B]" />
            ÓRBITA CALCULADA (SGP4) · NO ES FUENTE DE DATOS
          </span>
          <h2 className="font-display text-base font-bold text-[#F4F1EA]">Constelación SAOCOM 1A &amp; 1B (CONAE)</h2>
        </div>
        <span
          className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border font-bold ${
            fuenteTle === "celestrak"
              ? "border-[#10B981]/40 text-[#10B981] bg-[#10B981]/10"
              : "border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10"
          }`}
        >
          TLE: {fuenteTle === "celestrak" ? "CELESTRAK LIVE" : "CACHE LOCAL"}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F4F1EA] px-3 py-2">
        <strong>Solo muestra cuándo pasan los satélites.</strong> Ojo Andino no usa imágenes ni datos de SAOCOM: la lluvia sale de
        NASA POWER y la vegetación de MODIS. Que el satélite pase no significa que haya tomado una imagen de la zona.
      </p>

      {/* Domo Polar SVG (Sky-Plot) + Próxima pasada */}
      <div className="grid grid-cols-[128px_1fr] gap-3 items-center rounded-xl bg-[#0B0D10]/85 border border-white/10 p-3">
        <svg viewBox="0 0 128 128" className="h-28 w-28 mx-auto" aria-label="Domo celeste SAOCOM sobre Jujuy">
          <circle cx="64" cy="64" r="48" fill="rgba(19,23,30,0.9)" stroke="rgba(244,241,234,0.18)" strokeWidth="1.2" />
          <circle cx="64" cy="64" r="24" fill="none" stroke="rgba(244,241,234,0.12)" strokeDasharray="3 3" strokeWidth="1" />
          <line x1="64" y1="16" x2="64" y2="112" stroke="rgba(244,241,234,0.1)" strokeWidth="1" />
          <line x1="16" y1="64" x2="112" y2="64" stroke="rgba(244,241,234,0.1)" strokeWidth="1" />
          <text x="64" y="12" textAnchor="middle" className="fill-[#F59E0B] text-[9px] font-mono font-bold">
            N
          </text>
          <text x="118" y="67" textAnchor="middle" className="fill-[#9CA3AF] text-[8px] font-mono">
            E
          </text>
          <text x="64" y="123" textAnchor="middle" className="fill-[#9CA3AF] text-[8px] font-mono">
            S
          </text>
          <text x="10" y="67" textAnchor="middle" className="fill-[#9CA3AF] text-[8px] font-mono">
            O
          </text>

          {pathArco && (
            <path d={pathArco} fill="none" stroke="#2DD4BF" strokeWidth="2" strokeDasharray="3 2" />
          )}
          {picoPt && (
            <circle cx={picoPt.x} cy={picoPt.y} r="3.5" fill="#F59E0B" stroke="#0B0D10" strokeWidth="1" />
          )}
          {estados
            .filter((e) => e.elevacion > 0)
            .map((e) => {
              const p = puntoPolar(e.azimut, e.elevacion);
              return <circle key={e.norad} cx={p.x} cy={p.y} r="4" fill="#10B981" />;
            })}
        </svg>

        <div className="space-y-1.5 text-xs">
          <div className="text-[11px] font-mono uppercase text-[#2DD4BF] font-bold">
            Próxima pasada sobre {observador.etiqueta}
          </div>
          {proxima ? (
            <>
              <div className="font-mono text-xl font-extrabold text-[#F4F1EA]">
                {formatoCuenta(proxima.inicio.getTime() - ahora.getTime())}
              </div>
              <p className="text-[11px] text-[#9CA3AF] leading-snug">
                <strong className="text-[#F59E0B]">{proxima.nombre}</strong> ·{" "}
                {proxima.inicio.toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                  timeZone: "America/Argentina/Jujuy",
                })}{" "}
                ART · Elev. máx <strong className="text-[#F4F1EA]">{proxima.maxElev.toFixed(0)}°</strong>
              </p>
            </>
          ) : (
            <p className="text-xs text-[#9CA3AF]">Calculando ventana orbital…</p>
          )}
        </div>
      </div>

      {/* Coordenadas actuales de los 2 satélites */}
      <div className="grid grid-cols-1 gap-2">
        {estados.map((e) => (
          <div key={e.norad} className="rounded-xl bg-[#0B0D10]/85 border border-white/10 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#F59E0B]">
                🛰️ {e.nombre} <span className="text-[#9CA3AF] font-mono font-normal">#{e.norad}</span>
              </span>
              <span className={`font-mono text-[11px] ${e.elevacion > 0 ? "text-[#10B981] font-bold" : "text-[#9CA3AF]"}`}>
                {e.elevacion > 0 ? `EN HORIZONTE (${e.elevacion.toFixed(1)}°)` : `Elev ${e.elevacion.toFixed(1)}°`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px] text-[#F4F1EA]/90 font-mono">
              <span>
                {e.lat.toFixed(2)}°, {e.lon.toFixed(2)}°
              </span>
              <span>Alt: {e.altKm.toFixed(0)} km</span>
              <span>Dist: {e.rangoKm.toFixed(0)} km</span>
            </div>
          </div>
        ))}
      </div>

      {/* Próxima pasada sobre cada localidad */}
      <div className="rounded-xl bg-[#0B0D10]/85 border border-white/10 overflow-hidden">
        <div className="px-3 py-2 text-[11px] font-mono uppercase text-[#2DD4BF] font-bold border-b border-white/10">
          Próxima pasada por localidad
        </div>
        <table className="w-full text-[11px]">
          <thead className="text-[#9CA3AF] text-left">
            <tr>
              <th className="px-3 py-1.5 font-medium">Localidad</th>
              <th className="px-2 py-1.5 font-medium">Satélite</th>
              <th className="px-2 py-1.5 font-medium">Cuándo</th>
              <th className="px-3 py-1.5 font-medium text-right">Elev. máx</th>
            </tr>
          </thead>
          <tbody>
            {porLocalidad.map((f) => (
              <tr
                key={f.id}
                onClick={() => onSeleccion?.(f.id)}
                className={`border-t border-white/5 ${onSeleccion ? "cursor-pointer hover:bg-white/5" : ""} ${
                  f.id === seleccion ? "bg-[#2DD4BF]/10" : ""
                }`}
              >
                <td className="px-3 py-1.5 font-bold text-[#F4F1EA] whitespace-nowrap">{f.nombre}</td>
                {f.pasada ? (
                  <>
                    <td className="px-2 py-1.5 text-[#F59E0B] whitespace-nowrap">{f.pasada.nombre}</td>
                    <td className="px-2 py-1.5 font-mono text-[#F4F1EA]/90 whitespace-nowrap">{fechaHora(f.pasada.inicio)}</td>
                    <td className="px-3 py-1.5 font-mono text-[#F4F1EA]/90 text-right">{f.pasada.maxElev.toFixed(0)}°</td>
                  </>
                ) : (
                  <td colSpan={3} className="px-2 py-1.5 text-[#9CA3AF]">
                    Sin pasada en las próximas {HORAS_BUSQUEDA} h
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 text-[10px] text-[#9CA3AF] border-t border-white/10">
          Hora de Argentina. Pasadas a más de {ELEV_MINIMA}° sobre el horizonte, calculadas con <code className="font-mono">satellite.js</code>{" "}
          a partir de los elementos orbitales públicos de CelesTrak. Las localidades vecinas comparten casi la misma pasada.
        </div>
      </div>
    </div>
  );
}
