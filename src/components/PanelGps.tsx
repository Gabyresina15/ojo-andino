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
};

export default function PanelGps({ fix, onFix }: Props) {
  const [activo, setActivo] = useState(false);
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
        setError(err.code === 1 ? "Permiso de ubicación denegado." : `GPS no disponible: ${err.message}`);
        setActivo(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
  };

  const paradaCercana = fix
    ? PARADAS_TREN.map((p) => ({ parada: p, km: distanciaKm(fix, p) })).sort((a, b) => a.km - b.km)[0]
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
            Telemetría a Bordo · Tren Solar
          </span>
          <h2 className="text-base font-semibold text-white">GPS en el vagón</h2>
        </div>
        {activo && (
          <button
            onClick={detener}
            className="text-xs px-2.5 py-1 rounded-lg border border-white/20 text-slate-300 hover:bg-white/10"
          >
            Apagar
          </button>
        )}
      </div>

      {!activo ? (
        <button
          onClick={activar}
          className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs py-2.5 px-3 transition"
        >
          📍 Activar mi GPS en el Tren Solar (anónimo, solo en tu navegador)
        </button>
      ) : !fix ? (
        <p className="text-xs text-slate-300 animate-pulse">Buscando señal GNSS del celular…</p>
      ) : (
        <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <span className="block text-[10px] text-slate-400">Coordenadas</span>
              <span>
                {fix.lat.toFixed(4)}, {fix.lon.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">Altitud / Velocidad</span>
              <span>
                {fix.altM !== null ? `${Math.round(fix.altM)} msnm` : "s/d"} ·{" "}
                {fix.velKmh !== null ? `${fix.velKmh.toFixed(1)} km/h` : "0 km/h"}
              </span>
            </div>
          </div>
          {paradaCercana && (
            <p className="text-[11px] text-emerald-300 border-t border-white/10 pt-1.5">
              Estación del Tren Solar más cercana: <strong>{paradaCercana.parada.nombre}</strong> (
              {paradaCercana.km.toFixed(1)} km) · precisión ±{Math.round(fix.precisionM ?? 0)} m
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}

      <p className="text-[11px] text-slate-400">
        Se activa solo con tu permiso explícito (HTTPS requerido). Sirve de observador móvil para calcular el próximo paso de SAOCOM.
      </p>
    </div>
  );
}
