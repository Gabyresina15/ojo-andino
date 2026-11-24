"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { COMUNIDADES, getComunidad } from "@/lib/comunidades";
import type { LecturaSatelital } from "@/lib/types";
import { lecturaCacheada } from "@/lib/cache";
import { nombres, sintesisRegional } from "@/lib/sintesis";
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

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type DetalleTab = "priorizacion" | "satelite" | "cultura";

export default function App() {
  const parametroC = useSyncExternalStore(sinSuscripcion, leerParametroC, () => null);
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const online = useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true);
  const [elegida, setSeleccion] = useState<string | null>(null);
  const seleccion = elegida ?? parametroC ?? "susques";
  const [vivas, setVivas] = useState<Record<string, LecturaSatelital>>({});
  const [terminada, setTerminada] = useState<string | null>(null);
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

  // Las 10 localidades en vivo para el mapa y la tabla regional; no pisa la lectura ya pedida de la seleccionada.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/lecturas", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((todas: LecturaSatelital[]) => {
        const nuevas = Object.fromEntries(todas.filter((l) => l.meteorologia && !l.fuenteCache).map((l) => [l.comunidadId, l]));
        setVivas((v) => ({ ...nuevas, ...v }));
        for (const l of Object.values(nuevas)) localStorage.setItem(LS_KEY(l.comunidadId), JSON.stringify(l));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Cada localidad usa siempre la misma fuente, esté o no seleccionada: en vivo, o la última guardada en este navegador.
  const regionales = useMemo(() => {
    const r: Record<string, LecturaSatelital> = {};
    for (const c of COMUNIDADES) {
      const local = montado ? leerLocal(c.id) : null;
      const l = vivas[c.id] ?? (local ? { ...local, fuenteCache: true } : null);
      if (l) r[c.id] = l;
    }
    return r;
  }, [vivas, montado]);
  const sint = useMemo(() => sintesisRegional({ ...regionales, [seleccion]: lectura }), [regionales, seleccion, lectura]);
  const punaEnDeficit = sint.deficit.filter((f) => f.c.region === "puna");

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
            <Link href="/metodologia" className="text-[11px] rounded-xl px-2.5 py-1.5 border border-white/15 text-[#F4F1EA] font-medium hover:border-[#F59E0B]/60">
              Metodología
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* ENCABEZADO ENFOCADO 100% EN GESTIÓN PÚBLICA Y MUNICIPAL DE JUJUY */}
        <section className="space-y-4">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D95D39]/20 border border-[#D95D39]/50 px-3 py-1 text-xs font-bold text-[#F4F1EA]">
              🏛️ Para el Gobierno de Jujuy, Municipios y Comisiones Municipales
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F4F1EA]">
              ¿Dónde priorizar agua, forraje y obras hídricas hoy en Jujuy?
            </h2>
            <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
              Traduce datos satelitales de lluvia y vegetación en un{" "}
              <strong className="text-[#F4F1EA]">expediente oficial auditable por municipio</strong> para decidir dónde enviar
              camiones de forraje y agua en la Puna o dónde vigilar drenajes y caminos por exceso de lluvia en la Quebrada.
            </p>
          </div>

          {/* TIRA EJECUTIVA PROVINCIAL (4 KPIs de Impacto Presupuestario y Territorial) */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => sint.deficit[0] && setSeleccion(sint.deficit[0].c.id)}
              className="amc-surface rounded-2xl p-3.5 text-left border hover:border-[#D95D39]/60 transition cursor-pointer"
            >
              <div className="text-[11px] font-mono uppercase text-[#D95D39] font-bold">🔴 Déficit de lluvia hoy</div>
              <div className="font-display text-xl font-extrabold text-[#F4F1EA] mt-0.5">
                {sint.deficit.length} de {COMUNIDADES.length} municipios
              </div>
              <div className="text-xs text-[#9CA3AF] mt-0.5">
                <strong className="text-[#F4F1EA]">
                  {sint.deficit.map((f) => `${f.c.nombre} (${fmt1(f.pct)}%)`).join(", ") || "Ninguno"}
                </strong>
              </div>
            </button>

            <button
              onClick={() => sint.vial[0] && setSeleccion(sint.vial[0].c.id)}
              className="amc-surface rounded-2xl p-3.5 text-left border hover:border-[#2DD4BF]/60 transition cursor-pointer"
            >
              <div className="text-[11px] font-mono uppercase text-[#2DD4BF] font-bold">🚧 Alerta Vial / Drenajes</div>
              <div className="font-display text-xl font-extrabold text-[#F4F1EA] mt-0.5">
                {sint.vial.length} de {COMUNIDADES.length} municipios
              </div>
              <div className="text-xs text-[#9CA3AF] mt-0.5">
                <strong className="text-[#F4F1EA]">{nombres(sint.vial)}</strong> · lluvias altas en Quebrada
              </div>
            </button>

            <button
              onClick={() => sint.punaConLluvia[0] && setSeleccion(sint.punaConLluvia[0].c.id)}
              className="amc-surface rounded-2xl p-3.5 text-left border hover:border-[#10B981]/60 transition cursor-pointer"
            >
              <div className="text-[11px] font-mono uppercase text-[#10B981] font-bold">🌱 Puna con lluvia sobre lo normal</div>
              <div className="font-display text-xl font-extrabold text-[#F4F1EA] mt-0.5">
                {sint.punaConLluvia.length} de {COMUNIDADES.length} municipios
              </div>
              <div className="text-xs text-[#9CA3AF] mt-0.5">
                <strong className="text-[#F4F1EA]">{nombres(sint.punaConLluvia)}</strong>
              </div>
            </button>

            <div className="amc-surface rounded-2xl p-3.5 text-left border border-[#F59E0B]/30">
              <div className="text-[11px] font-mono uppercase text-[#F59E0B] font-bold">🚚 Puna sin déficit</div>
              <div className="font-display text-xl font-extrabold text-[#F59E0B] mt-0.5">
                {sint.punaSinDeficit} de {sint.punaTotal} localidades
              </div>
              <div className="text-xs text-[#9CA3AF] mt-0.5">
                {punaEnDeficit.length
                  ? `Concentrar el envío de forraje en ${nombres(punaEnDeficit)}`
                  : "Ninguna localidad puneña en déficit"}
              </div>
            </div>
          </div>
        </section>

        {/* BLOQUE PRINCIPAL: MAPA DE LAS 10 JURISDICCIONES + PARTE OFICIAL DE LA JURISDICCIÓN SELECCIONADA */}
        <section className="grid gap-5 lg:grid-cols-[400px_1fr] items-start">
          <div className="amc-surface rounded-3xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-[#F4F1EA]">📍 Seleccioná Municipio o Comisión Municipal</span>
              {cargando && <span className="text-xs text-[#2DD4BF] animate-pulse">Actualizando…</span>}
            </div>

            <div className="h-[260px] sm:h-[300px]">
              <Mapa seleccion={seleccion} onSeleccion={setSeleccion} lecturas={regionales} />
            </div>

            {/* Leyenda cromática del Semáforo en el Mapa */}
            <div className="px-3.5 py-2 border-t border-white/10 bg-[#0B0D10]/90 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9CA3AF]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D95D39]" /> Déficit (Forraje)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> Normal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" /> Puna recuperada
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2DD4BF]" /> Quebrada (Drenajes)
              </span>
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
              <span>📊 Gráfico de Lluvia (30 días) y Vegetación</span>
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
            <PanelDatos comunidad={comunidad} lectura={lectura} modo="parametrico" onSeleccion={setSeleccion} lecturas={regionales} />
          )}

          {tabDetalle === "satelite" && (
            <PanelDatos comunidad={comunidad} lectura={lectura} modo="comunidad" onSeleccion={setSeleccion} lecturas={regionales} />
          )}

          {tabDetalle === "cultura" && <FichaCultural comunidad={comunidad} />}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-[11px] text-[#9CA3AF] border-t border-white/10">
        Fuentes públicas: NASA POWER (climatología 2001–2025) · MODIS MOD13Q1 (ORNL DAAC) · Redacción y voz con Grok AI (xAI).{" "}
        <Link href="/metodologia" className="underline text-[#F4F1EA] hover:text-[#F59E0B]">
          Metodología y límites del indicador
        </Link>
      </footer>
    </div>
  );
}
