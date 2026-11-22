"use client";

import { useEffect, useRef, useState } from "react";
import { PARADAS_TREN, distanciaKm } from "@/lib/comunidades";
import { registrarEvento } from "@/lib/traccion-cliente";

export type Fix = {
  lat: number;
  lon: number;
  altM: number | null;
  velKmh: number | null;
  precisionM: number | null;
  hora: number;
};

type Props = {
  fix: Fix | null;
  onFix: (f: Fix | null) => void;
  seleccion?: string;
  onSeleccionEstacion?: (id: string) => void;
};

export default function PanelGps({ fix, onFix, seleccion, onSeleccionEstacion }: Props) {
  const [activo, setActivo] = useState(false);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const registrado = useRef(false);

  const detener = () => {
    if (watchId.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setActivo(false);
    onFix(null);
  };

  useEffect(() => () => detener(), []);

  const activar = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }
    setError(null);
    setActivo(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Fix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          altM: pos.coords.altitude,
          velKmh: pos.coords.speed !== null && !Number.isNaN(pos.coords.speed) ? pos.coords.speed * 3.6 : null,
          precisionM: pos.coords.accuracy,
          hora: pos.timestamp,
        };
        onFix(next);
        if (!registrado.current) {
          registrado.current = true;
          const cerca = PARADAS_TREN.map((p) => ({ p, d: distanciaKm(next, p) })).sort((a, b) => a.d - b.d)[0];
          registrarEvento("gps", cerca?.p.id);
        }
      },
      (err) => {
        setError(
          err.code === 1
            ? "Permiso de GPS denegado. Podés elegir tu estación con 1 toque arriba."
            : `GPS no disponible: ${err.message}`,
        );
        setActivo(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
  };

  const hacerCheckinEstacion = (id: string) => {
    setCheckinId(id);
    onSeleccionEstacion?.(id);
    registrarEvento("gps", id);
  };

  const paradaCercana = fix
    ? PARADAS_TREN.map((p) => ({ parada: p, km: distanciaKm(fix, p) })).sort((a, b) => a.km - b.km)[0]
    : null;

  return (
    <div className="rounded-3xl border border-amber-400/25 bg-slate-900/75 p-4 sm:p-5 space-y-3.5 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
            🚆 A Bordo del Tren Solar de la Quebrada
          </span>
          <h2 className="text-base font-bold text-white">¿Por qué estación vas ahora?</h2>
        </div>
        {activo && (
          <button
            onClick={detener}
            className="text-xs px-2.5 py-1 rounded-lg border border-white/20 text-slate-300 hover:bg-white/10"
          >
            Apagar GPS
          </button>
        )}
      </div>

      {/* Check-in rápido de estación en 1 toque (cero fricción de permisos) */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-300">
          Tocá tu estación actual para ver su estado satelital y sumar tu vagón al mapa en vivo:
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {PARADAS_TREN.map((p, idx) => {
            const esActiva = seleccion === p.id || checkinId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => hacerCheckinEstacion(p.id)}
                className={`rounded-xl p-2 text-center border transition flex flex-col items-center gap-0.5 ${
                  esActiva
                    ? "bg-amber-400 text-black border-amber-300 font-bold shadow"
                    : "bg-black/40 border-white/10 text-slate-200 hover:border-amber-400/50"
                }`}
              >
                <span className="text-[10px] opacity-75">#{idx + 1}</span>
                <span className="text-[11px] leading-tight truncate w-full">{p.nombre}</span>
              </button>
            );
          })}
        </div>
        {checkinId && (
          <p className="text-[11px] text-emerald-300 font-medium">
            ✓ Check-in registrado en {PARADAS_TREN.find((p) => p.id === checkinId)?.nombre} · sumado al contador del tren
          </p>
        )}
      </div>

      {/* GPS en vivo con consentimiento explícito */}
      {!activo ? (
        <button
          onClick={activar}
          className="w-full rounded-2xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-200 font-semibold text-xs py-2.5 px-3 transition"
        >
          📍 O activá tu GPS en vivo (altitud msnm + velocidad del tren)
        </button>
      ) : !fix ? (
        <p className="text-xs text-slate-300 animate-pulse">Buscando señal GNSS de tu celular…</p>
      ) : (
        <div className="rounded-2xl bg-black/50 border border-emerald-500/30 p-3 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <span className="block text-[10px] text-slate-400">Posición GPS</span>
              <span className="text-white">
                {fix.lat.toFixed(4)}, {fix.lon.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">Altitud / Velocidad</span>
              <span className="text-amber-300 font-bold">
                {fix.altM !== null ? `${Math.round(fix.altM)} msnm` : "~2.400 msnm"} ·{" "}
                {fix.velKmh !== null ? `${fix.velKmh.toFixed(1)} km/h` : "0 km/h"}
              </span>
            </div>
          </div>
          {paradaCercana && (
            <p className="text-[11px] text-emerald-300 border-t border-white/10 pt-1.5">
              Estación más cercana: <strong>{paradaCercana.parada.nombre}</strong> ({paradaCercana.km.toFixed(1)} km) ·
              precisión ±{Math.round(fix.precisionM ?? 0)} m
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-amber-300">{error}</p>}
    </div>
  );
}
