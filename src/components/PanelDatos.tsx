"use client";

import type { Comunidad, LecturaSatelital } from "@/lib/types";
import { estadoHidrico } from "@/lib/lecturas";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
};

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt3 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function PanelDatos({ comunidad, lectura, modo }: Props) {
  if (!lectura) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        Cargando lecturas satelitales de {comunidad.nombre}…
      </div>
    );
  }

  const m = lectura.meteorologia;
  const ndvi = lectura.ndvi;
  const est = estadoHidrico(lectura);

  const badgeEstado =
    est === "superavit_reciente"
      ? { txt: "Lluvia por encima del promedio", cls: "bg-sky-500/20 text-sky-200 border-sky-400/40" }
      : est === "deficit"
        ? { txt: "Déficit hídrico en la ventana", cls: "bg-amber-500/20 text-amber-200 border-amber-400/40" }
        : est === "normal"
          ? { txt: "Lluvia dentro del rango normal", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" }
          : { txt: "Sin dato suficiente", cls: "bg-slate-500/20 text-slate-300 border-slate-500/40" };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white">{comunidad.nombre}</h2>
            <span className="text-[11px] uppercase px-2 py-0.5 rounded-full border border-white/15 text-slate-300">
              {comunidad.region}
            </span>
            {comunidad.paradaTren && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40">
                🚆 Parada Tren Solar
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {comunidad.lat.toFixed(4)}, {comunidad.lon.toFixed(4)} · Último dato meteorológico:{" "}
            {m?.ultimoDiaConDato ?? "s/d"} ({m?.demoraDeclarada ?? "demora 2–3 días"})
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${badgeEstado.cls}`}>{badgeEstado.txt}</span>
      </div>

      {lectura.fuenteCache && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Mostrando lectura precacheada ({new Date(lectura.generadoEn).toLocaleString("es-AR", { timeZone: "America/Argentina/Jujuy" })} ART).
          Modo offline-first activo.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Lluvia 30d */}
        <div className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-1">
          <span className="text-[11px] text-slate-400">Lluvia · NASA POWER (PRECTOTCORR)</span>
          {m ? (
            <>
              <div className="text-2xl font-bold text-white">{fmt1(m.precipitacionMm30d.observado)} mm</div>
              <p className="text-xs text-slate-300">
                Climatología 2001–2025: <strong>{fmt1(m.precipitacionMm30d.climatologia)} mm</strong>
              </p>
              <p
                className={`text-xs font-semibold ${
                  (m.precipitacionMm30d.porcentaje ?? 0) >= 0 ? "text-sky-300" : "text-amber-300"
                }`}
              >
                Anomalía: {(m.precipitacionMm30d.porcentaje ?? 0) >= 0 ? "+" : ""}
                {fmt1(m.precipitacionMm30d.porcentaje ?? 0)} %
              </p>
              <p className="text-[10px] text-slate-500">{m.precipitacionMm30d.ventana}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Sin dato disponible.</p>
          )}
        </div>

        {/* Temperatura 7d */}
        <div className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-1">
          <span className="text-[11px] text-slate-400">Temperatura media 7d · NASA POWER</span>
          {m ? (
            <>
              <div className="text-2xl font-bold text-white">{fmt1(m.temperaturaC7d.mediaObservada)} °C</div>
              <p className="text-xs text-slate-300">
                Climatología {m.temperaturaC7d.mesClimatologico}: <strong>{fmt1(m.temperaturaC7d.climatologiaMes)} °C</strong>
              </p>
              <p className="text-[10px] text-slate-500">Ventana: {m.temperaturaC7d.ventana}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Sin dato disponible.</p>
          )}
        </div>

        {/* NDVI MODIS */}
        <div className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-1">
          <span className="text-[11px] text-slate-400">Verdor NDVI · MODIS MOD13Q1</span>
          {ndvi ? (
            <>
              <div className="text-2xl font-bold text-emerald-300">{fmt3(ndvi.ultimoComposite.ndvi)}</div>
              <p className="text-xs text-slate-300">
                Composite: <strong>{ndvi.ultimoComposite.fecha}</strong>
                {ndvi.compositeAnioAnterior && (
                  <> · 2025: <strong>{fmt3(ndvi.compositeAnioAnterior.ndvi)}</strong></>
                )}
              </p>
              <p className="text-[10px] text-slate-400">{ndvi.aviso}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400">MODIS no respondió dentro del timeout (se mantiene meteorología).</p>
          )}
        </div>
      </div>

      {modo === "parametrico" && m && (
        <div className="rounded-xl border border-sky-400/40 bg-sky-950/30 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-semibold text-sky-200">
              Vista B2B · Insumo para Cooperativas y Seguros Paramétricos
            </span>
            <span className="font-mono text-[11px] text-sky-300">
              Grid {comunidad.lat.toFixed(3)}, {comunidad.lon.toFixed(3)} · MERRA2/GEOSIT
            </span>
          </div>
          <p className="text-slate-300">
            Desvío de precipitación acumulado ({m.precipitacionMm30d.ventana}):{" "}
            <strong>
              {(m.precipitacionMm30d.porcentaje ?? 0) >= 0 ? "+" : ""}
              {fmt1(m.precipitacionMm30d.porcentaje ?? 0)} %
            </strong>{" "}
            respecto a la climatología 2001–2025.
          </p>
          <p className="text-[11px] text-slate-400">
            Antecedente argentino: coberturas paramétricas por índice satelital (ej. Sancor Seguros + CONAE/Instituto Gulich TVDI
            y régimen actualizado SSN 2026 — RESOL-2026-315-APN-SSN#MEC). <strong>Este tablero entrega la serie por punto; no
            constituye una póliza ni un índice homologado.</strong>
          </p>
        </div>
      )}
    </div>
  );
}
