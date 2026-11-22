"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { COMUNIDADES, CENTRO_JUJUY, getComunidad } from "@/lib/comunidades";
import type { LecturaSatelital } from "@/lib/types";
import { lecturaCacheada } from "@/lib/cache";
import RadarOrbital, { type RadarSnapshot } from "./RadarOrbital";
import PanelDatos from "./PanelDatos";
import PanelAlerta from "./PanelAlerta";
import FichaCultural from "./FichaCultural";
import { ChakanaIcon } from "./AndeanMotifs";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => (
    <div className="h-full grid place-items-center text-[#9CA3AF] text-xs animate-pulse">
      Cargando mapa de Jujuy…
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

type DetalleTab = "priorizacion" | "satelite" | "cultura";

export default function App() {
  const parametroC = useSyncExternalStore(sinSuscripcion, leerParametroC, () => null);
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const online = useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true);
  const [elegida, setSeleccion] = useState<string | null>(null);
  const seleccion = elegida ?? parametroC ?? "susques";
  const [vivas, setVivas] = useState<Record<string, LecturaSatelital>>({});
  const [terminada, setTerminada] = useState<string | null>(null);
  const [radar, setRadar] = useState<RadarSnapshot | null>(null);
  const [tabDetalle, setTabDetalle] = useState<DetalleTab>("priorizacion");
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

  const observador = useMemo(
    () => ({ lat: comunidad.lat, lon: comunidad.lon, altKm: CENTRO_JUJUY.altKm, etiqueta: comunidad.nombre }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comunidad.id],
  );

  const pueblosPuna = COMUNIDADES.filter((c) => c.region === "puna");
  const pueblosQuebrada = COMUNIDADES.filter((c) => c.region === "quebrada");

  return (
    <div className="min-h-screen amc-grid-bg text-[#F4F1EA]">
      {/* HEADER INSTITUCIONAL LIMPIO */}
      <header className="relative z-[1000] border-b border-white/10 bg-[#0B0D10]/90 backdrop-blur-md sm:sticky sm:top-0">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#D95D39] to-[#F59E0B] text-[#0B0D10] flex items-center justify-center shadow">
              <ChakanaIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#F4F1EA]">
                Ojo Andino{" "}
                <span className="font-normal text-[#9CA3AF]">
                  · Tablero Hídrico y Territorial para el Gobierno de Jujuy
                </span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-xl px-3 py-1.5 border border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10 font-medium">
              🏛️ 10 Jurisdicciones Municipales Monitoreadas
            </span>
            <span
              className={`text-[11px] rounded-xl px-2.5 py-1.5 border font-medium ${
                online
                  ? "border-[#10B981]/40 text-[#10B981] bg-[#10B981]/10"
                  : "border-[#F59E0B]/50 text-[#F59E0B] bg-[#F59E0B]/10"
              }`}
            >
              {online ? "● Datos NASA / MODIS activos" : "● Modo sin conexión"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* ENCABEZADO ENFOCADO 100% EN GESTIÓN PÚBLICA Y MUNICIPAL DE JUJUY */}
        <section className="max-w-3xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D95D39]/20 border border-[#D95D39]/50 px-3 py-1 text-xs font-bold text-[#F4F1EA]">
            🏛️ Para el Gobierno de Jujuy, Municipios y Comisiones Municipales
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F4F1EA]">
            ¿Dónde priorizar agua, forraje y obras hídricas hoy en Jujuy?
          </h2>
          <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
            Traduce datos satelitales de lluvia y vegetación en un{" "}
            <strong className="text-[#F4F1EA]">parte oficial por municipio</strong> para decidir dónde enviar camiones de
            forraje y agua en la Puna o dónde vigilar drenajes y caminos por exceso de lluvia en la Quebrada.
          </p>
        </section>

        {/* BLOQUE PRINCIPAL: MAPA DE LAS 10 JURISDICCIONES + PARTE OFICIAL DE LA JURISDICCIÓN SELECCIONADA */}
        <section className="grid gap-5 lg:grid-cols-[400px_1fr] items-start">
          <div className="amc-surface rounded-3xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-[#F4F1EA]">📍 Seleccioná Municipio o Comisión Municipal</span>
              {cargando && <span className="text-xs text-[#2DD4BF] animate-pulse">Actualizando…</span>}
            </div>

            <div className="h-[260px] sm:h-[300px]">
              <Mapa seleccion={seleccion} onSeleccion={setSeleccion} fix={null} radar={radar} />
            </div>

            <div className="p-3.5 border-t border-white/10 space-y-2.5 bg-[#0B0D10]/70">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-[#10B981] mr-1">🏔️ Puna:</span>
                {pueblosPuna.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSeleccion(c.id)}
                    aria-pressed={c.id === seleccion}
                    className={`min-h-[40px] text-xs rounded-xl px-3 py-1.5 border font-medium transition cursor-pointer ${
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
                <span className="text-xs font-bold text-[#F59E0B] mr-1">⛰️ Quebrada:</span>
                {pueblosQuebrada.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSeleccion(c.id)}
                    aria-pressed={c.id === seleccion}
                    className={`min-h-[40px] text-xs rounded-xl px-3 py-1.5 border font-medium transition cursor-pointer ${
                      c.id === seleccion
                        ? "bg-[#F59E0B] text-[#0B0D10] border-[#F59E0B] font-bold shadow"
                        : "border-white/15 text-[#F4F1EA]/85 hover:border-[#F59E0B]/60"
                    }`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <PanelAlerta key={seleccion} comunidad={comunidad} lectura={lectura} />
        </section>

        {/* BLOQUE INFERIOR: 3 PESTAÑAS DE GESTIÓN (Con la Tabla de los 10 Municipios abierta por defecto) */}
        <section className="space-y-4 pt-2">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <button
              onClick={() => setTabDetalle("priorizacion")}
              aria-expanded={tabDetalle === "priorizacion"}
              className={`min-h-[48px] rounded-2xl px-4 py-3 text-left text-xs font-bold border transition cursor-pointer flex items-center justify-between ${
                tabDetalle === "priorizacion"
                  ? "bg-[#F59E0B] text-[#0B0D10] border-[#F59E0B] shadow-lg"
                  : "amc-surface text-[#F4F1EA] hover:border-[#F59E0B]/50"
              }`}
            >
              <span>🏛️ Tabla de Priorización de los 10 Municipios de Jujuy</span>
              <span>●</span>
            </button>

            <button
              onClick={() => setTabDetalle("satelite")}
              aria-expanded={tabDetalle === "satelite"}
              className={`min-h-[48px] rounded-2xl px-4 py-3 text-left text-xs font-bold border transition cursor-pointer flex items-center justify-between ${
                tabDetalle === "satelite"
                  ? "bg-[#2DD4BF] text-[#0B0D10] border-[#2DD4BF] shadow-lg"
                  : "amc-surface text-[#F4F1EA] hover:border-[#2DD4BF]/50"
              }`}
            >
              <span>📊 Gráfico de Lluvia (30 días) y Satélite SAOCOM</span>
              <span>●</span>
            </button>

            <button
              onClick={() => setTabDetalle("cultura")}
              aria-expanded={tabDetalle === "cultura"}
              className={`min-h-[48px] rounded-2xl px-4 py-3 text-left text-xs font-bold border transition cursor-pointer flex items-center justify-between ${
                tabDetalle === "cultura"
                  ? "bg-[#D95D39] text-[#F4F1EA] border-[#D95D39] shadow-lg"
                  : "amc-surface text-[#F4F1EA] hover:border-[#D95D39]/50"
              }`}
            >
              <span>🏔️ Contexto Territorial y Calendario de {comunidad.nombre}</span>
              <span>●</span>
            </button>
          </div>

          {tabDetalle === "priorizacion" && (
            <PanelDatos comunidad={comunidad} lectura={lectura} modo="parametrico" onSeleccion={setSeleccion} />
          )}

          {tabDetalle === "satelite" && (
            <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
              <RadarOrbital observador={observador} onSnapshot={setRadar} />
              <PanelDatos comunidad={comunidad} lectura={lectura} modo="comunidad" onSeleccion={setSeleccion} />
            </div>
          )}

          {tabDetalle === "cultura" && <FichaCultural comunidad={comunidad} />}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-[11px] text-[#9CA3AF] border-t border-white/10">
        Datos públicos verificados: NASA POWER (climatología 2001–2025) · MODIS MOD13Q1 (ORNL DAAC) · Órbitas SAOCOM 1A/1B
        (CelesTrak) · Redacción y voz con Grok AI (xAI). Cursor Hackathon Jujuy · Tren Solar de la Quebrada (22/11/2026).
      </footer>
    </div>
  );
}
