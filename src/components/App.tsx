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
  loading: () => <div className="h-full grid place-items-center text-slate-400 text-sm">Cargando mapa satelital…</div>,
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
  const seleccion = elegida ?? parametroC ?? "susques";
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

  const pueblosPuna = COMUNIDADES.filter((c) => c.region === "puna");
  const pueblosQuebrada = COMUNIDADES.filter((c) => c.region === "quebrada");

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      {/* Barra superior pegajosa */}
      <header className="relative z-[1000] border-b border-white/10 bg-black/70 backdrop-blur-md sm:sticky sm:top-0">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-black font-black text-lg shadow">
              🛰️
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                <span className="text-amber-400">Ojo Andino</span>{" "}
                <span className="text-slate-300 font-medium">· Inteligencia Satelital para Jujuy</span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Órbitas SAOCOM en vivo + agua, clima y verdor satelital traducidos a voz y WhatsApp
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setQrAbierto(true)}
              className="rounded-full bg-amber-400 hover:bg-amber-300 px-3 py-1.5 font-bold text-black transition shadow"
            >
              📱 Compartir QR en el Tren
            </button>
            <Contador />
            <span
              className={`rounded-full px-2.5 py-1 border font-medium ${
                online ? "border-emerald-500/40 text-emerald-300 bg-emerald-950/30" : "border-amber-500/50 text-amber-300"
              }`}
            >
              {online ? "● Satélites en línea" : "● Modo Offline Activo"}
            </span>
          </div>
        </div>
      </header>

      {qrAbierto && <QrModal seleccion={seleccion} nombre={comunidad.nombre} onClose={() => setQrAbierto(false)} />}

      {/* HERO VISUAL DE PRODUCTO — Pensado para que el jurado entienda el valor en 3 segundos */}
      <section className="border-b border-white/10 bg-gradient-to-b from-amber-500/10 via-sky-500/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-300">
                🚆 Cursor Hackathon Jujuy · A bordo del Tren Solar de la Quebrada
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                El satélite que le habla a la Puna y a la Quebrada.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                En septiembre la Provincia asistió con camiones de alfalfa a la Puna por sequía. Hoy cruzamos{" "}
                <strong className="text-white">NASA POWER</strong>, <strong className="text-white">MODIS</strong> y la órbita de{" "}
                <strong className="text-white">SAOCOM 1A/1B</strong> para saber en segundos dónde falta agua hoy y enviar la alerta
                en <strong className="text-emerald-300">voz y por WhatsApp</strong>.
              </p>
            </div>

            {/* Selector claro de modelo de negocio: Gratis para Comunidad vs Pago B2B */}
            <div className="rounded-2xl border border-white/15 bg-slate-900/90 p-2 flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-2">
                Elegí el perfil de usuario:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  onClick={() => setModo("comunidad")}
                  className={`px-3.5 py-2.5 rounded-xl text-left transition ${
                    modo === "comunidad"
                      ? "bg-emerald-500 text-black font-bold shadow"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold">👨‍🌾 Comunidad / Pastor</div>
                  <div className={`text-[10px] ${modo === "comunidad" ? "text-black/80" : "text-slate-400"}`}>
                    100% Gratis · Voz + WhatsApp
                  </div>
                </button>
                <button
                  onClick={() => setModo("parametrico")}
                  className={`px-3.5 py-2.5 rounded-xl text-left transition ${
                    modo === "parametrico"
                      ? "bg-sky-400 text-black font-bold shadow"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold">🏢 Cooperativa / Seguro B2B</div>
                  <div className={`text-[10px] ${modo === "parametrico" ? "text-black/80" : "text-slate-400"}`}>
                    Ranking + Índice Paramétrico CSV
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* 3 Accesos Rápidos de Impacto (El contraste real que encontró el satélite hoy) */}
          <div className="grid gap-2.5 sm:grid-cols-3 pt-1">
            <button
              onClick={() => setSeleccion("susques")}
              className={`rounded-2xl p-3.5 text-left border transition flex items-center justify-between gap-3 ${
                seleccion === "susques"
                  ? "bg-rose-950/60 border-rose-400 ring-2 ring-rose-400/40"
                  : "bg-slate-900/70 border-white/10 hover:border-rose-400/50"
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-rose-300">⚠️ Caso real hoy · Déficit Crítico</span>
                <div className="text-base font-extrabold text-white">Susques (Puna)</div>
                <div className="text-xs text-slate-300">Solo 8,7 mm vs 41,1 mm normales</div>
              </div>
              <span className="text-lg font-black text-rose-300 font-mono">-78,9%</span>
            </button>

            <button
              onClick={() => setSeleccion("abra-pampa")}
              className={`rounded-2xl p-3.5 text-left border transition flex items-center justify-between gap-3 ${
                seleccion === "abra-pampa"
                  ? "bg-sky-950/60 border-sky-400 ring-2 ring-sky-400/40"
                  : "bg-slate-900/70 border-white/10 hover:border-sky-400/50"
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-sky-300">🌧️ Caso real hoy · Recuperación Nov</span>
                <div className="text-base font-extrabold text-white">Abra Pampa (Puna)</div>
                <div className="text-xs text-slate-300">82,1 mm vs 42,6 mm normales</div>
              </div>
              <span className="text-lg font-black text-sky-300 font-mono">+92,7%</span>
            </button>

            <button
              onClick={() => setSeleccion("purmamarca")}
              className={`rounded-2xl p-3.5 text-left border transition flex items-center justify-between gap-3 ${
                seleccion === "purmamarca"
                  ? "bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/40"
                  : "bg-slate-900/70 border-white/10 hover:border-amber-400/50"
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-300">🚆 Parada Tren Solar · Equilibrio</span>
                <div className="text-base font-extrabold text-white">Purmamarca (Quebrada)</div>
                <div className="text-xs text-slate-300">52,1 mm vs 51,4 mm normales</div>
              </div>
              <span className="text-lg font-black text-emerald-300 font-mono">+1,3%</span>
            </button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-5 grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Columna izquierda: Tren Solar + Telemetría SAOCOM */}
        <section className="space-y-5">
          <PanelGps fix={fix} onFix={setFix} seleccion={seleccion} onSeleccionEstacion={setSeleccion} />
          <RadarOrbital observador={observador} onSnapshot={setRadar} />
        </section>

        {/* Columna principal: Paso 1 (Mapa) -> Paso 2 (Alerta Voz/WhatsApp) -> Paso 3 (Datos + Matriz B2B) */}
        <section className="space-y-5 min-w-0">
          {/* PASO 1: MAPA Y SELECTOR DE COMUNIDAD */}
          <div className="rounded-3xl border border-white/15 overflow-hidden bg-slate-900/70 shadow-xl">
            <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                  PASO 1 · Elegí localidad en el mapa
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Seleccionada: <strong className="text-white">{comunidad.nombre}</strong>
                </span>
              </div>
              {cargando && <span className="text-xs text-sky-300 animate-pulse">● Actualizando satélite…</span>}
            </div>

            <div className="h-[290px] sm:h-[360px]">
              <Mapa seleccion={seleccion} onSeleccion={setSeleccion} fix={fix} radar={radar} />
            </div>

            <div className="p-3.5 border-t border-white/10 space-y-2.5 bg-black/30">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-emerald-300 mr-1">🏔️ Puna:</span>
                {pueblosPuna.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSeleccion(c.id)}
                    className={`text-xs rounded-full px-3 py-1 border font-medium transition ${
                      c.id === seleccion
                        ? "bg-emerald-400 text-black border-emerald-300 font-bold shadow"
                        : "border-white/15 text-slate-200 hover:border-emerald-400/60"
                    }`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-amber-300 mr-1">🚆 Quebrada y Tren Solar:</span>
                {pueblosQuebrada.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSeleccion(c.id)}
                    className={`text-xs rounded-full px-3 py-1 border font-medium transition ${
                      c.id === seleccion
                        ? "bg-amber-400 text-black border-amber-300 font-bold shadow"
                        : "border-white/15 text-slate-200 hover:border-amber-400/60"
                    }`}
                  >
                    {c.paradaTren ? "🚆 " : ""}
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PASO 2: LA ALERTA EN VOZ Y WHATSAPP (Protagonista inmediata) */}
          <PanelAlerta key={`${seleccion}-${modo}`} comunidad={comunidad} lectura={lectura} modo={modo} />

          {/* PASO 3: DATOS SATELITALES + GRÁFICO + TABLERO B2B */}
          <PanelDatos comunidad={comunidad} lectura={lectura} modo={modo} onSeleccion={setSeleccion} />

          {/* CAPA CULTURAL */}
          <FichaCultural comunidad={comunidad} />
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-[11px] text-slate-500 space-y-1">
        <p>
          Datos públicos verificables: NASA/POWER (lluvia y temperatura, climatología 2001–2025) · MODIS MOD13Q1 vía ORNL DAAC
          TESViS (doi:10.3334/ORNLDAAC/1600) · Elementos orbitales SAOCOM 1A/1B: CelesTrak (propagación SGP4 en navegador con
          satellite.js) · Redacción y voz: Grok (xAI) con validación determinista Zod · Mapa © OpenStreetMap.
        </p>
        <p>
          Cursor Hackathon Jujuy · Tren Solar de la Quebrada (22/11/2026). Prototipo pensado para co-diseñarse junto a las
          comunidades, cooperativas y municipios.
        </p>
      </footer>
    </div>
  );
}
