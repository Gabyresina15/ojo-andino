"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { registrarEvento } from "@/lib/traccion-cliente";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-slate-400 text-sm">Cargando mapa…</div>,
});

const LS_KEY = (id: string) => `oa:lectura:${id}`;

function leerLocal(id: string): LecturaSatelital | null {
  try {
    const s = localStorage.getItem(LS_KEY(id));
    return s ? (JSON.parse(s) as LecturaSatelital) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [seleccion, setSeleccion] = useState<string>("abra-pampa");
  const [lectura, setLectura] = useState<LecturaSatelital | null>(() => lecturaCacheada("abra-pampa"));
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<"comunidad" | "parametrico">("comunidad");
  const [fix, setFix] = useState<Fix | null>(null);
  const [radar, setRadar] = useState<RadarSnapshot | null>(null);
  const [online, setOnline] = useState(true);
  const pedido = useRef(0);

  const comunidad = getComunidad(seleccion)!;

  // ?c=id en la URL (links de WhatsApp)
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c && getComunidad(c)) setSeleccion(c);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Offline-first: pinta cache al instante, después intenta en vivo.
  useEffect(() => {
    const id = seleccion;
    const n = ++pedido.current;
    const local = leerLocal(id);
    const bundled = lecturaCacheada(id);
    setLectura(local ? { ...local, fuenteCache: true } : bundled);
    setCargando(true);
    registrarEvento("vista", id);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    fetch(`/api/lecturas?id=${id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((l: LecturaSatelital) => {
        if (n !== pedido.current) return;
        setLectura(l);
        if (l.meteorologia && !l.fuenteCache) localStorage.setItem(LS_KEY(id), JSON.stringify(l));
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(t);
        if (n === pedido.current) setCargando(false);
      });
    return () => ctrl.abort();
  }, [seleccion]);

  const observador = useMemo(
    () =>
      fix
        ? { lat: fix.lat, lon: fix.lon, altKm: (fix.altM ?? 2500) / 1000, etiqueta: "tu GPS" }
        : { lat: comunidad.lat, lon: comunidad.lon, altKm: CENTRO_JUJUY.altKm, etiqueta: comunidad.nombre },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fix ? Math.round(fix.lat * 100) : null, fix ? Math.round(fix.lon * 100) : null, comunidad.id],
  );

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-[1000]">
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
            <Contador />
            <span
              className={`rounded-full px-2 py-1 border ${online ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/50 text-amber-300"}`}
            >
              {online ? "● en línea" : "● sin red · modo offline"}
            </span>
          </div>
        </div>
      </header>

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
          <PanelAlerta comunidad={comunidad} lectura={lectura} modo={modo} />
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
