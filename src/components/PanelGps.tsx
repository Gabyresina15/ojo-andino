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

const RECORRIDO_TREN = [
  { id: "volcan", nombre: "Volcán", km: "KM 0", msnm: "2.078m" },
  { id: "tumbaya", nombre: "Tumbaya", km: "KM 8", msnm: "2.094m" },
  { id: "purmamarca", nombre: "Purmamarca", km: "KM 19", msnm: "2.324m" },
  { id: "maimara", nombre: "Hornillos / Maimará", km: "KM 34", msnm: "2.390m" },
  { id: "tilcara", nombre: "Tilcara", km: "KM 42", msnm: "2.465m" },
];

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
            ? "Permiso de GPS denegado. Tocá tu estación arriba para hacer check-in directo."
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
    <div className="amc-surface rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#F59E0B] font-bold">
            🚆 TELEMETRÍA TREN SOLAR · TRAZA 42 KM
          </span>
          <h2 className="font-display text-base font-bold text-[#F4F1EA]">Check-in de Estación &amp; GNSS</h2>
        </div>
        {activo && (
          <button
            onClick={detener}
            className="min-h-[36px] text-xs font-mono px-3 py-1 rounded-lg border border-white/20 text-[#F4F1EA] hover:bg-white/10 transition-all duration-200"
          >
            APAGAR GPS
          </button>
        )}
      </div>

      {/* Traza ferroviaria Volcán -> Tumbaya -> Purmamarca -> Posta de Hornillos / Maimará -> Tilcara */}
      <div className="space-y-2">
        <p className="text-xs text-[#9CA3AF]">
          Tocá la estación por la que va el tren para sincronizar telemetría y sumar tu vagón:
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {RECORRIDO_TREN.map((est, idx) => {
            const esActiva = seleccion === est.id || checkinId === est.id;
            return (
              <button
                key={est.id}
                onClick={() => hacerCheckinEstacion(est.id)}
                className={`min-h-[44px] rounded-xl px-3 py-2 text-left border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] ${
                  esActiva
                    ? "bg-[#D95D39]/25 border-[#D95D39] text-[#F4F1EA] shadow"
                    : "bg-[#0B0D10]/70 border-white/10 text-[#F4F1EA]/85 hover:border-[#F59E0B]/50"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`h-6 w-6 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      esActiva ? "bg-[#D95D39] text-[#F4F1EA]" : "bg-white/10 text-[#9CA3AF]"
                    }`}
                  >
                    0{idx + 1}
                  </span>
                  <span className="text-xs font-semibold truncate">{est.nombre}</span>
                </div>
                <span className="font-mono text-[11px] text-[#F59E0B] shrink-0">
                  {est.km} · {est.msnm}
                </span>
              </button>
            );
          })}
        </div>
        {checkinId && (
          <div className="rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 px-3 py-1.5 text-[11px] font-mono text-[#10B981]">
            ✓ NODO REGISTRADO EN {RECORRIDO_TREN.find((e) => e.id === checkinId)?.nombre.toUpperCase()}
          </div>
        )}
      </div>

      {/* Botón GNSS en vivo */}
      {!activo ? (
        <button
          onClick={activar}
          className="min-h-[44px] w-full rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 active:scale-[0.99] text-[#0B0D10] font-bold text-xs py-2.5 px-3 transition-all duration-200 cursor-pointer shadow"
        >
          📍 Activar GPS en vivo (altitud msnm + velocidad km/h)
        </button>
      ) : !fix ? (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-black/40 p-3 text-xs font-mono text-[#F59E0B] animate-pulse">
          Adquiriendo fix GNSS del dispositivo…
        </div>
      ) : (
        <div className="rounded-xl bg-[#0B0D10] border border-[#10B981]/40 p-3 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <span className="block text-[10px] text-[#9CA3AF]">COORDENADAS WGS84</span>
              <span className="text-[#F4F1EA] font-bold">
                {fix.lat.toFixed(4)}, {fix.lon.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-[#9CA3AF]">ALTITUD / VELOCIDAD</span>
              <span className="text-[#F59E0B] font-bold">
                {fix.altM !== null ? `${Math.round(fix.altM)} msnm` : "~2.400 msnm"} ·{" "}
                {fix.velKmh !== null ? `${fix.velKmh.toFixed(1)} km/h` : "0.0 km/h"}
              </span>
            </div>
          </div>
          {paradaCercana && (
            <p className="text-[11px] font-mono text-[#10B981] border-t border-white/10 pt-1.5">
              ESTACIÓN CERCANA: <strong>{paradaCercana.parada.nombre.toUpperCase()}</strong> ({paradaCercana.km.toFixed(1)} km) ·
              ±{Math.round(fix.precisionM ?? 0)}m
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs font-mono text-[#F59E0B]">{error}</p>}
    </div>
  );
}
