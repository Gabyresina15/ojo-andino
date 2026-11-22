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

const CIELO = { c: 60, r: 50 };

/** Proyección polar: horizonte (0°) en el borde, cénit (90°) en el centro, norte arriba. */
function aPlano(az: number, el: number) {
  const r = (CIELO.r * (90 - Math.max(0, Math.min(90, el)))) / 90;
  const a = (az * Math.PI) / 180;
  return { x: CIELO.c + r * Math.sin(a), y: CIELO.c - r * Math.cos(a) };
}

function CieloPolar({ arco, visibles }: { arco: Pasada["arco"]; visibles: EstadoSat[] }) {
  const puntos = arco.map((p) => aPlano(p.az, p.el));
  const trayecto = puntos.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const cumbre = arco.length ? arco.reduce((m, p) => (p.el > m.el ? p : m)) : null;
  const pico = cumbre ? aPlano(cumbre.az, cumbre.el) : null;
  const { c, r } = CIELO;
  const cardinales = [
    { t: "N", x: c, y: c - r - 4 },
    { t: "E", x: c + r + 5, y: c },
    { t: "S", x: c, y: c + r + 5 },
    { t: "O", x: c - r - 5, y: c },
  ];

  return (
    <svg
      viewBox="0 0 120 120"
      className="w-32 h-32 shrink-0"
      role="img"
      aria-label={`Cielo polar: trayectoria de la próxima pasada${
        cumbre ? ` con máxima elevación ${cumbre.el.toFixed(0)}°` : ""
      }${visibles.length ? `; ${visibles.length} satélite(s) sobre el horizonte` : ""}`}
    >
      <circle cx={c} cy={c} r={r} fill="rgba(2,6,23,0.6)" stroke="rgba(148,163,184,0.45)" strokeWidth={0.8} />
      <circle cx={c} cy={c} r={r / 2} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth={0.6} strokeDasharray="2 2" />
      <line x1={c - r} y1={c} x2={c + r} y2={c} stroke="rgba(148,163,184,0.15)" strokeWidth={0.5} />
      <line x1={c} y1={c - r} x2={c} y2={c + r} stroke="rgba(148,163,184,0.15)" strokeWidth={0.5} />
      <circle cx={c} cy={c} r={0.9} fill="rgba(148,163,184,0.7)" />
      <text x={c + r / 2 + 1.5} y={c - 1.5} fontSize={5} fill="rgba(148,163,184,0.75)">
        45°
      </text>
      {cardinales.map((k) => (
        <text
          key={k.t}
          x={k.x}
          y={k.y}
          fontSize={7}
          fontWeight={600}
          fill="rgba(203,213,225,0.9)"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {k.t}
        </text>
      ))}
      {puntos.length > 1 && (
        <path d={trayecto} fill="none" stroke="#38bdf8" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {puntos[0] && <circle cx={puntos[0].x} cy={puntos[0].y} r={1.4} fill="#38bdf8" />}
      {pico && cumbre && (
        <g>
          <circle cx={pico.x} cy={pico.y} r={3.2} fill="#38bdf8" fillOpacity={0.25} stroke="#7dd3fc" strokeWidth={0.8} />
          <circle cx={pico.x} cy={pico.y} r={1.4} fill="#e0f2fe" />
        </g>
      )}
      {visibles.map((e) => {
        const p = aPlano(e.azimut, e.elevacion);
        return (
          <g key={e.norad}>
            <circle cx={p.x} cy={p.y} r={4} fill="#fbbf24" fillOpacity={0.25} />
            <circle cx={p.x} cy={p.y} r={2} fill="#fbbf24" stroke="#0f172a" strokeWidth={0.5} />
          </g>
        );
      })}
    </svg>
  );
}

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

  // Recalcula la próxima pasada solo cuando cambian los TLEs o el observador (~1 km).
  const latObs = Math.round(observador.lat * 100);
  const lonObs = Math.round(observador.lon * 100);
  const proxima = useMemo(() => {
    if (!sats.length) return null;
    const base = new Date();
    const pasadas = sats
      .map((s) => proximaPasada(s, base, observador, 36, 10))
      .filter((p): p is Pasada => !!p)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    return pasadas[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sats, latObs, lonObs]);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const estados = useMemo(
    () => sats.map((s) => estado(s, ahora, observador)).filter((x): x is EstadoSat => !!x),
    [sats, ahora, observador],
  );

  const visibles = useMemo(() => estados.filter((e) => e.elevacion > 0), [estados]);

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

      {(proxima || visibles.length > 0) && (
        <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/10 p-2.5">
          <CieloPolar arco={proxima?.arco ?? []} visibles={visibles} />
          <ul className="space-y-1.5 text-[11px] text-slate-300">
            {proxima && (
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded bg-sky-400" />
                Trayectoria próxima pasada · {proxima.nombre.trim()}
              </li>
            )}
            {proxima && (
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-100 ring-2 ring-sky-400/50" />
                Máx. elevación {proxima.maxElev.toFixed(0)}°
              </li>
            )}
            {visibles.map((e) => (
              <li key={e.norad} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                {e.nombre.trim()} ahora · {e.elevacion.toFixed(0)}°
              </li>
            ))}
            <li className="text-[10px] text-slate-500">Borde 0° · anillo 45° · centro cénit</li>
          </ul>
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
