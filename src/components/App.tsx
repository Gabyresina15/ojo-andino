"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { COMUNIDADES, CENTRO_JUJUY, getComunidad } from "@/lib/comunidades";
import type { LecturaSatelital } from "@/lib/types";
import { lecturaCacheada } from "@/lib/cache";
import RadarOrbital, { type RadarSnapshot } from "./RadarOrbital";
import PanelGps, { type Fix } from "./PanelGps";
import PanelDatos from "./PanelDatos";
import PanelAlerta from "./PanelAlerta";
import FichaCultural from "./FichaCultural";
import Contador from "./Contador";
import QrModal from "./QrModal";
import { registrarEvento } from "@/lib/traccion-cliente";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-slate-400 text-sm">Cargando mapa…</div>,
});

const LS_KEY = (id: string) => `oa:lectura:${id}`;

const sinSuscripcion = () => () => {};

function suscribirRed(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

// ?c=id en la URL (links de WhatsApp y QR)
function leerParametroC(): string | null {
  const c = new URLSearchParams(window.location.search).get("c");
  return c && getComunidad(c) ? c : null;
}

function leerLocal(id: string): LecturaSatelital | null {
  try {
    const s = localStorage.getItem(LS_KEY(id));
    return s ? (JSON.parse(s) as LecturaSatelital) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const parametroC = useSyncExternalStore(sinSuscripcion, leerParametroC, () => null);
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const online = useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true);
  const [elegida, setSeleccion] = useState<string | null>(null);
  const seleccion = elegida ?? parametroC ?? "abra-pampa";
  const [vivas, setVivas] = useState<Record<string, LecturaSatelital>>({});
  const [terminada, setTerminada] = useState<string | null>(null);
  const [modo, setModo] = useState<"comunidad" | "parametrico">("comunidad");
  const [fix, setFix] = useState<Fix | null>(null);
  const [radar, setRadar] = useState<RadarSnapshot | null>(null);
  const [qrAbierto, setQrAbierto] = useState(false);
  const pedido = useRef(0);

  const comunidad = getComunidad(seleccion)!;

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Offline-first: pinta cache al instante (localStorage o bundle), después intenta en vivo.
  const cacheada = useMemo(() => {
    const local = montado ? leerLocal(seleccion) : null;
    return local ? { ...local, fuenteCache: true } : lecturaCacheada(seleccion);
  }, [seleccion, montado]);
  const lectura = vivas[seleccion] ?? cacheada;
  const cargando = terminada !== seleccion;

  useEffect(() => {
    const id = seleccion;
    const n = ++pedido.current;
    registrarEvento("vista", id);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    fetch(`/api/lecturas?id=${id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((l: LecturaSatelital) => {
        if (n !== pedido.current) return;
        setVivas((v) => ({ ...v, [id]: l }));
        if (l.meteorologia && !l.fuenteCache) localStorage.setItem(LS_KEY(id), JSON.stringify(l));
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(t);
        if (n === pedido.current) setTerminada(id);
      });
    return () => ctrl.abort();
  }, [seleccion]);

  const latGps = fix ? Math.round(fix.lat * 100) : null;
  const lonGps = fix ? Math.round(fix.lon * 100) : null;
  const observador = useMemo(
    () =>
      fix
        ? { lat: fix.lat, lon: fix.lon, altKm: (fix.altM ?? 2500) / 1000, etiqueta: "tu GPS" }
        : { lat: comunidad.lat, lon: comunidad.lon, altKm: CENTRO_JUJUY.altKm, etiqueta: comunidad.nombre },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latGps, lonGps, comunidad.id],
  );

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <header className="relative z-[1000] border-b border-white/10 bg-black/40 backdrop-blur sm:sticky sm:top-0">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              <span className="text-amber-400">Ojo Andino</span>{" "}
              <span className="text-slate-300 font-normal">· el satélite que le habla a la Puna</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Telemetría orbital SAOCOM en vivo + lluvia, temperatura y verdor satelital, traducidos a una alerta en voz y WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setQrAbierto(true)}
              className="rounded-full border border-amber-400/50 px-2.5 py-1 font-semibold text-amber-200 transition hover:bg-amber-400/10"
            >
              📱 QR Tren
            </button>
            <Contador />
            <span
              className={`rounded-full px-2 py-1 border ${online ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/50 text-amber-300"}`}
            >
              {online ? "● en línea" : "● sin red · modo offline"}
            </span>
          </div>
        </div>
      </header>

      {qrAbierto && <QrModal seleccion={seleccion} nombre={comunidad.nombre} onClose={() => setQrAbierto(false)} />}

      <main className="mx-auto max-w-7xl px-4 py-4 grid gap-4 lg:grid-cols-[380px_1fr]">
        <section className="space-y-4">
          <RadarOrbital observador={observador} onSnapshot={setRadar} />
          <PanelGps fix={fix} onFix={setFix} />
        </section>

        <section className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-900/40">
            <div className="h-[340px] sm:h-[420px]">
              <Mapa seleccion={seleccion} onSeleccion={setSeleccion} fix={fix} radar={radar} />
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 border-t border-white/10">
              {COMUNIDADES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSeleccion(c.id)}
                  className={`text-xs rounded-full px-2.5 py-1 border transition ${
                    c.id === seleccion
                      ? "bg-amber-400 text-black border-amber-400"
                      : "border-white/15 text-slate-300 hover:border-amber-400/60"
                  }`}
                >
                  {c.paradaTren ? "🚆 " : ""}
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-white/15 p-1 text-sm">
              <button
                onClick={() => setModo("comunidad")}
                className={`px-3 py-1.5 rounded-lg ${modo === "comunidad" ? "bg-emerald-500 text-black font-semibold" : "text-slate-300"}`}
              >
                Comunidad · gratis
              </button>
              <button
                onClick={() => setModo("parametrico")}
                className={`px-3 py-1.5 rounded-lg ${modo === "parametrico" ? "bg-sky-400 text-black font-semibold" : "text-slate-300"}`}
              >
                Cooperativa / Seguro paramétrico · B2B
              </button>
            </div>
            {cargando && <span className="text-xs text-slate-400 animate-pulse">consultando NASA POWER y MODIS…</span>}
          </div>

          <PanelDatos comunidad={comunidad} lectura={lectura} modo={modo} />
          <PanelAlerta key={`${seleccion}-${modo}`} comunidad={comunidad} lectura={lectura} modo={modo} />
          <FichaCultural comunidad={comunidad} />
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-[11px] text-slate-500 space-y-1">
        <p>
          Datos: NASA/POWER (lluvia y temperatura, climatología 2001–2025) · MODIS MOD13Q1 vía ORNL DAAC TESViS (doi:10.3334/ORNLDAAC/1600) ·
          Elementos orbitales: CelesTrak (propagación SGP4 en tu navegador con satellite.js) · Texto y voz: Grok (xAI) · Mapa © OpenStreetMap / Esri.
        </p>
        <p>
          Prototipo de hackathon (Cursor Hackathon Jujuy, Tren Solar, 22/11/2026). No habla en nombre de ninguna comunidad; pensado para co-diseñarse con ellas.
        </p>
      </footer>
    </div>
  );
}
