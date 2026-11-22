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
import { ChakanaIcon, GuardaAndinaDivider } from "./AndeanMotifs";
import { registrarEvento } from "@/lib/traccion-cliente";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => (
    <div className="h-full grid place-items-center text-[#9CA3AF] font-mono text-xs animate-pulse">
      INICIALIZANDO CARTOGRAFÍA SATELITAL…
    </div>
  ),
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

const ESTACIONES_CORREDOR = [
  { id: "volcan", label: "Volcán" },
  { id: "tumbaya", label: "Tumbaya" },
  { id: "purmamarca", label: "Purmamarca" },
  { id: "maimara", label: "Posta de Hornillos · Maimará" },
  { id: "tilcara", label: "Tilcara" },
];

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
    <div className="min-h-screen amc-grid-bg text-[#F4F1EA]">
      {/* TOP BAR · ANDEAN MISSION CONTROL */}
      <header className="relative z-[1000] border-b border-white/10 bg-[#0B0D10]/90 backdrop-blur-md sm:sticky sm:top-0">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#D95D39] to-[#F59E0B] text-[#0B0D10] flex items-center justify-center shadow-lg">
              <ChakanaIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#F4F1EA]">
                  OJO ANDINO
                </h1>
                <span className="hidden md:inline-block font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#9CA3AF]">
                  ANDEAN MISSION CONTROL · JUJUY
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] hidden sm:block">
                Telemetría SAOCOM 1A/1B + NASA POWER + MODIS traducida a voz y WhatsApp
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Contador />
            <button
              onClick={() => setQrAbierto(true)}
              className="min-h-[40px] rounded-xl bg-[#D95D39] hover:bg-[#D95D39]/90 active:scale-[0.99] px-3.5 py-2 font-bold text-[#F4F1EA] transition-all duration-200 shadow cursor-pointer"
            >
              📱 QR TREN
            </button>
            <span
              className={`font-mono text-[11px] rounded-xl px-3 py-2 border font-bold ${
                online
                  ? "border-[#10B981]/40 text-[#10B981] bg-[#10B981]/10"
                  : "border-[#F59E0B]/50 text-[#F59E0B] bg-[#F59E0B]/10"
              }`}
            >
              {online ? "● STARLINK LIVE · CACHE READY" : "● OFFLINE CACHE READY"}
            </span>
          </div>
        </div>

        {/* Cinta del corredor del Tren Solar: Volcán -> Tumbaya -> Purmamarca -> Posta de Hornillos -> Maimará -> Tilcara */}
        <div className="border-t border-white/5 bg-[#13171E]/90 px-4 py-1.5 overflow-x-auto">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 text-[11px] font-mono whitespace-nowrap">
            <span className="text-[#F59E0B] font-bold">🚆 CORREDOR TREN SOLAR (2.078–2.465 MSNM):</span>
            <div className="flex items-center gap-1.5">
              {ESTACIONES_CORREDOR.map((e, i) => (
                <span key={e.id} className="inline-flex items-center gap-1.5">
                  <button
                    onClick={() => setSeleccion(e.id)}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      seleccion === e.id
                        ? "bg-[#F59E0B] text-[#0B0D10] font-bold"
                        : "text-[#F4F1EA]/80 hover:text-[#F59E0B]"
                    }`}
                  >
                    {e.label}
                  </button>
                  {i < ESTACIONES_CORREDOR.length - 1 && <span className="text-[#D95D39]">──</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {qrAbierto && <QrModal seleccion={seleccion} nombre={comunidad.nombre} onClose={() => setQrAbierto(false)} />}

      {/* HERO EDITORIAL & TARJETAS DE CONTRASTE EN 1 TOQUE */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-lg bg-[#D95D39]/15 border border-[#D95D39]/40 px-3 py-1 text-xs font-mono font-bold text-[#D95D39]">
                CURSOR HACKATHON JUJUY · 22/11/2026 · TELEMETRÍA + CULTURA
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F4F1EA]">
                El satélite que le habla a la Puna y a la Quebrada.
              </h2>
              <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                En septiembre la Provincia asistió con camiones de alfalfa a la Puna por sequía. Ojo Andino cruza{" "}
                <strong className="text-[#F4F1EA]">NASA POWER</strong>, <strong className="text-[#F4F1EA]">MODIS</strong> y la
                órbita de <strong className="text-[#F4F1EA]">SAOCOM 1A/1B</strong> para detectar dónde falta agua hoy y enviar la
                alerta en <strong className="text-[#10B981]">voz y por WhatsApp</strong>.
              </p>
            </div>

            {/* Selector de modo: Comunidad (Gratis) vs Cooperativa / Seguro Paramétrico (B2B) */}
            <div className="amc-surface rounded-2xl p-2 flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] font-bold px-2">
                MODO DE OPERACIÓN / MODELO DE NEGOCIO:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  onClick={() => setModo("comunidad")}
                  className={`min-h-[48px] px-3.5 py-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                    modo === "comunidad"
                      ? "bg-[#D95D39] text-[#F4F1EA] font-bold shadow-lg"
                      : "text-[#9CA3AF] hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold">👨‍🌾 Comunidad / Pastor</div>
                  <div className={`text-[10px] font-mono ${modo === "comunidad" ? "text-[#F4F1EA]/90" : "text-[#9CA3AF]"}`}>
                    FREEMIUM $0 · VOZ + WA.ME
                  </div>
                </button>
                <button
                  onClick={() => setModo("parametrico")}
                  className={`min-h-[48px] px-3.5 py-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                    modo === "parametrico"
                      ? "bg-[#F59E0B] text-[#0B0D10] font-bold shadow-lg"
                      : "text-[#9CA3AF] hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold">🏢 Cooperativa / Seguro B2B</div>
                  <div className={`text-[10px] font-mono ${modo === "parametrico" ? "text-[#0B0D10]/85" : "text-[#9CA3AF]"}`}>
                    MATRIZ 10 NODOS + CSV
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* 3 Tarjetas de Telemetría Rápida (Jerarquía: Dato duro en mono arriba -> Etiqueta -> Acción) */}
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={() => setSeleccion("susques")}
              className={`min-h-[88px] rounded-2xl p-4 text-left border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                seleccion === "susques"
                  ? "bg-[#D95D39]/20 border-[#D95D39] ring-1 ring-[#D95D39]/50"
                  : "amc-surface hover:border-[#D95D39]/50"
              }`}
            >
              <div>
                <div className="font-mono text-2xl font-extrabold text-[#D95D39]">-78,9%</div>
                <div className="font-display text-sm font-bold text-[#F4F1EA]">Susques · Puna Occidental</div>
                <div className="text-[11px] font-mono text-[#9CA3AF]">8,7 mm vs 41,1 mm · PRIORIDAD FORRAJE</div>
              </div>
              <span className="font-mono text-[10px] px-2 py-1 rounded bg-[#D95D39]/25 text-[#F4F1EA] border border-[#D95D39]/40">
                DÉFICIT
              </span>
            </button>

            <button
              onClick={() => setSeleccion("abra-pampa")}
              className={`min-h-[88px] rounded-2xl p-4 text-left border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                seleccion === "abra-pampa"
                  ? "bg-[#2DD4BF]/15 border-[#2DD4BF] ring-1 ring-[#2DD4BF]/40"
                  : "amc-surface hover:border-[#2DD4BF]/50"
              }`}
            >
              <div>
                <div className="font-mono text-2xl font-extrabold text-[#2DD4BF]">+92,7%</div>
                <div className="font-display text-sm font-bold text-[#F4F1EA]">Abra Pampa · Puna Central</div>
                <div className="text-[11px] font-mono text-[#9CA3AF]">82,1 mm vs 42,6 mm · REBROTE EN NOV</div>
              </div>
              <span className="font-mono text-[10px] px-2 py-1 rounded bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/40">
                SUPERÁVIT
              </span>
            </button>

            <button
              onClick={() => setSeleccion("purmamarca")}
              className={`min-h-[88px] rounded-2xl p-4 text-left border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                seleccion === "purmamarca"
                  ? "bg-[#F59E0B]/15 border-[#F59E0B] ring-1 ring-[#F59E0B]/40"
                  : "amc-surface hover:border-[#F59E0B]/50"
              }`}
            >
              <div>
                <div className="font-mono text-2xl font-extrabold text-[#10B981]">+1,3%</div>
                <div className="font-display text-sm font-bold text-[#F4F1EA]">Purmamarca · Tren Solar</div>
                <div className="text-[11px] font-mono text-[#9CA3AF]">52,1 mm vs 51,4 mm · EQUILIBRIO</div>
              </div>
              <span className="font-mono text-[10px] px-2 py-1 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                NORMAL
              </span>
            </button>
          </div>

          <GuardaAndinaDivider />
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-5 grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Columna Izquierda: Check-in del Tren Solar + Telemetría SAOCOM 1A/1B */}
        <section className="space-y-5">
          <PanelGps fix={fix} onFix={setFix} seleccion={seleccion} onSeleccionEstacion={setSeleccion} />
          <RadarOrbital observador={observador} onSnapshot={setRadar} />
        </section>

        {/* Columna Derecha: Paso 01 (Mapa) -> Paso 02 (Síntesis Voz/WhatsApp) -> Paso 03 (Datos + Matriz B2B) */}
        <section className="space-y-5 min-w-0">
          {/* PASO 01: MAPA */}
          <div className="amc-surface rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 px-2.5 py-1 text-[11px] font-mono font-bold text-[#F59E0B]">
                  <ChakanaIcon className="h-3.5 w-3.5" />
                  PASO 01 · SELECCIÓN DE NODO TERRITORIAL
                </span>
                <span className="text-xs font-mono text-[#9CA3AF]">
                  ACTIVO: <strong className="text-[#F4F1EA]">{comunidad.nombre.toUpperCase()}</strong>
                </span>
              </div>
              {cargando && <span className="text-xs font-mono text-[#2DD4BF] animate-pulse">● SYNC NASA/MODIS…</span>}
            </div>

            <div className="h-[290px] sm:h-[360px]">
              <Mapa seleccion={seleccion} onSeleccion={setSeleccion} fix={fix} radar={radar} />
            </div>

            <div className="p-3.5 border-t border-white/10 space-y-2.5 bg-[#0B0D10]/75">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold text-[#10B981] mr-1">🏔️ PUNA:</span>
                {pueblosPuna.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSeleccion(c.id)}
                    className={`min-h-[38px] text-xs rounded-xl px-3 py-1.5 border font-medium transition-all duration-200 cursor-pointer ${
                      c.id === seleccion
                        ? "bg-[#D95D39] text-[#F4F1EA] border-[#D95D39] font-bold shadow"
                        : "border-white/15 text-[#F4F1EA]/85 hover:border-[#D95D39]/60"
                    }`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold text-[#F59E0B] mr-1">🚆 QUEBRADA / TREN SOLAR:</span>
                {pueblosQuebrada.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSeleccion(c.id)}
                    className={`min-h-[38px] text-xs rounded-xl px-3 py-1.5 border font-medium transition-all duration-200 cursor-pointer ${
                      c.id === seleccion
                        ? "bg-[#F59E0B] text-[#0B0D10] border-[#F59E0B] font-bold shadow"
                        : "border-white/15 text-[#F4F1EA]/85 hover:border-[#F59E0B]/60"
                    }`}
                  >
                    {c.paradaTren ? "🚆 " : ""}
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PASO 02: CONSOLA DE VOZ Y WHATSAPP */}
          <PanelAlerta key={`${seleccion}-${modo}`} comunidad={comunidad} lectura={lectura} modo={modo} />

          {/* PASO 03: TELEMETRÍA DE SUPERFICIE + MATRIZ B2B */}
          <PanelDatos comunidad={comunidad} lectura={lectura} modo={modo} onSeleccion={setSeleccion} />

          {/* CAPA CULTURAL */}
          <FichaCultural comunidad={comunidad} />
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-[11px] font-mono text-[#9CA3AF] space-y-1">
        <GuardaAndinaDivider className="pb-3" />
        <p>
          FUENTES: NASA/POWER (PRECTOTCORR, T2M · CLIMATOLOGÍA 2001–2025) · MODIS MOD13Q1 VÍA ORNL DAAC TESViS
          (doi:10.3334/ORNLDAAC/1600) · CELESTRAK SGP4 (SAOCOM 1A/1B) · GROK AI (xAI) + ZOD · MAPA © OPENSTREETMAP.
        </p>
        <p>
          CURSOR HACKATHON JUJUY · TREN SOLAR DE LA QUEBRADA (22/11/2026). PROTOTIPO PARA CO-DISEÑO CON COMUNIDADES Y COOPERATIVAS.
        </p>
      </footer>
    </div>
  );
}
