"use client";

import { useState } from "react";
import type { Comunidad, LecturaSatelital } from "@/lib/types";
import { COMUNIDADES } from "@/lib/comunidades";
import { lecturaCacheada } from "@/lib/cache";
import { estadoHidrico } from "@/lib/lecturas";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
  onSeleccion?: (id: string) => void;
};

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt3 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

type DiaSerie = NonNullable<LecturaSatelital["meteorologia"]>["serie"][number];

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function GraficoLluvia({ serie }: { serie: DiaSerie[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const n = serie.length;
  const alto = 100;
  const tope = Math.max(1, ...serie.map((d) => Math.max(d.lluviaMm ?? 0, d.climaMm ?? 0)));
  const techo = Math.ceil(tope / 2) * 2;
  const y = (mm: number) => alto - (mm / techo) * alto;

  let lineaClima = "";
  serie.forEach((d, i) => {
    if (d.climaMm === null) return;
    const yi = y(d.climaMm).toFixed(2);
    lineaClima += lineaClima && serie[i - 1]?.climaMm !== null ? ` V${yi} H${i + 1}` : ` M${i} ${yi} H${i + 1}`;
  });

  const medio = Math.floor((n - 1) / 2);
  const dia = activo !== null ? serie[activo] : null;

  return (
    <figure className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2.5">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-semibold text-slate-200">
          📊 Lluvia día por día (últimos {n} días con dato)
        </span>
        <span className="flex items-center gap-3 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" /> Lluvia medida
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-amber-300" /> Promedio histórico 2001–2025
          </span>
        </span>
      </figcaption>

      <div className="relative h-32 sm:h-36 pl-9">
        <span className="absolute left-0 top-0 -translate-y-1/2 text-[10px] font-mono text-slate-400">{techo} mm</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">{techo / 2} mm</span>
        <span className="absolute left-0 bottom-0 translate-y-1/2 text-[10px] font-mono text-slate-400">0 mm</span>
        <svg
          viewBox={`0 0 ${n} ${alto}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`Lluvia diaria observada frente a la climatología diaria, del ${ddmm(serie[0].fecha)} al ${ddmm(serie[n - 1].fecha)}`}
          onPointerLeave={() => setActivo(null)}
        >
          {[0, alto / 2, alto].map((gy) => (
            <line key={gy} x1={0} x2={n} y1={gy} y2={gy} className="stroke-white/10" vectorEffect="non-scaling-stroke" />
          ))}
          {serie.map((d, i) =>
            d.lluviaMm ? (
              <rect
                key={d.fecha}
                x={i + 0.15}
                y={y(d.lluviaMm)}
                width={0.7}
                height={alto - y(d.lluviaMm)}
                className={activo === i ? "fill-sky-300" : "fill-sky-400/85"}
              />
            ) : null,
          )}
          <path
            d={lineaClima}
            fill="none"
            className="stroke-amber-300"
            strokeWidth={1.75}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          {serie.map((d, i) => (
            <rect
              key={`hit-${d.fecha}`}
              x={i}
              y={0}
              width={1}
              height={alto}
              className={activo === i ? "fill-white/10" : "fill-transparent"}
              onPointerEnter={() => setActivo(i)}
              onClick={() => setActivo(i)}
            >
              <title>
                {`${ddmm(d.fecha)}: ${d.lluviaMm === null ? "s/d" : `${fmt2(d.lluviaMm)} mm`} · climatología ${
                  d.climaMm === null ? "s/d" : `${fmt2(d.climaMm)} mm`
                }`}
              </title>
            </rect>
          ))}
        </svg>
      </div>

      <div className="relative h-3 ml-9 text-[10px] font-mono text-slate-400">
        <span className="absolute left-0">{ddmm(serie[0].fecha)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${((medio + 0.5) / n) * 100}%` }}>
          {ddmm(serie[medio].fecha)}
        </span>
        <span className="absolute right-0">{ddmm(serie[n - 1].fecha)}</span>
      </div>

      <p className="text-xs text-slate-300 min-h-4" aria-live="polite">
        {dia ? (
          <>
            <strong className="text-white">{ddmm(dia.fecha)}</strong> · lluvia medida:{" "}
            <strong className="text-sky-300">{dia.lluviaMm === null ? "s/d" : `${fmt2(dia.lluviaMm)} mm`}</strong> ·
            esperado histórico:{" "}
            <strong className="text-amber-200">{dia.climaMm === null ? "s/d" : `${fmt2(dia.climaMm)} mm`}</strong>
          </>
        ) : (
          <span className="text-slate-400">Tocá cualquier barra para ver cuánta agua cayó ese día.</span>
        )}
      </p>
    </figure>
  );
}

function descargarCsv(comunidad: Comunidad, lectura: LecturaSatelital) {
  const m = lectura.meteorologia;
  if (!m) return;
  const encabezados = [
    "comunidad_id",
    "comunidad_nombre",
    "lat_wgs84",
    "lon_wgs84",
    "fecha",
    "lluvia_observada_mm",
    "lluvia_climatologia_2001_2025_mm",
    "temperatura_2m_c",
    "ndvi_ultimo_composite",
    "ndvi_fecha_composite",
  ];
  const ndviVal = lectura.ndvi?.ultimoComposite.ndvi ?? "";
  const ndviFecha = lectura.ndvi?.ultimoComposite.fecha ?? "";
  const filas = m.serie.map((d) =>
    [
      comunidad.id,
      `"${comunidad.nombre}"`,
      comunidad.lat,
      comunidad.lon,
      d.fecha,
      d.lluviaMm ?? "",
      d.climaMm ?? "",
      d.t2m ?? "",
      ndviVal,
      ndviFecha,
    ].join(","),
  );
  const csv = [encabezados.join(","), ...filas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ojo-andino-${comunidad.id}-${m.ultimoDiaConDato}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PanelDatos({ comunidad, lectura, modo, onSeleccion }: Props) {
  if (!lectura) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
        Cargando lecturas satelitales de {comunidad.nombre}…
      </div>
    );
  }

  const m = lectura.meteorologia;
  const ndvi = lectura.ndvi;
  const est = estadoHidrico(lectura);
  const pct = m?.precipitacionMm30d.porcentaje ?? 0;

  const estadoVisual =
    est === "deficit"
      ? {
          badge: "⚠️ Déficit hídrico activo",
          cls: "bg-rose-500/20 text-rose-200 border-rose-400/50",
          explicacion: "Llovió mucho menos que el promedio histórico para estas fechas.",
        }
      : est === "superavit_reciente"
        ? {
            badge: "🌧️ Superávit de lluvia reciente",
            cls: "bg-sky-500/20 text-sky-200 border-sky-400/50",
            explicacion: "En las últimas semanas llovió por encima del promedio histórico 2001–2025.",
          }
        : est === "normal"
          ? {
              badge: "✅ Lluvia en rango normal",
              cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/50",
              explicacion: "Las lluvias acumuladas coinciden con el promedio histórico de la época.",
            }
          : {
              badge: "Sin dato suficiente",
              cls: "bg-slate-500/20 text-slate-300 border-slate-500/40",
              explicacion: "Esperando actualización del satélite.",
            };

  const maxLluviaBarra = m ? Math.max(m.precipitacionMm30d.observado, m.precipitacionMm30d.climatologia, 1) : 1;
  const deltaTemp = m ? m.temperaturaC7d.mediaObservada - m.temperaturaC7d.climatologiaMes : 0;

  // Ranking regional de las 10 localidades para el modo B2B / Paramétrico
  const rankingRegional = COMUNIDADES.map((c) => {
    const l = c.id === comunidad.id ? lectura : lecturaCacheada(c.id);
    const p = l?.meteorologia?.precipitacionMm30d;
    return {
      comunidad: c,
      obs: p?.observado ?? 0,
      clim: p?.climatologia ?? 0,
      pct: p?.porcentaje ?? 0,
      ndvi: l?.ndvi?.ultimoComposite.ndvi ?? null,
      estado: l ? estadoHidrico(l) : "sin_dato",
    };
  }).sort((a, b) => a.pct - b.pct);

  return (
    <div className="rounded-3xl border border-white/15 bg-slate-900/75 p-5 sm:p-6 space-y-5 shadow-xl">
      {/* Cabecera clara de la localidad */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
              PASO 3 · Datos reales del satélite
            </span>
            <span className="text-xs uppercase px-2.5 py-0.5 rounded-full border border-white/15 text-slate-300 font-medium">
              Región {comunidad.region}
            </span>
            {comunidad.paradaTren && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40 font-medium">
                🚆 Estación Tren Solar
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{comunidad.nombre}</h2>
          <p className="text-xs text-slate-300">{estadoVisual.explicacion}</p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <span className={`text-xs font-bold px-3.5 py-1.5 rounded-full border ${estadoVisual.cls}`}>
            {estadoVisual.badge}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Último dato NASA: {m?.ultimoDiaConDato ?? "s/d"} (demora oficial 2–3 días)
          </span>
        </div>
      </div>

      {/* 3 Tarjetas Visuales e Intuitivas */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* TARJETA 1: LLUVIA */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <span>🌧️</span> Agua de lluvia (30 días)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">NASA POWER</span>
          </div>

          {m ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-3xl font-extrabold text-white">{fmt1(m.precipitacionMm30d.observado)} mm</div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    pct < -25
                      ? "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                      : pct > 25
                        ? "bg-sky-500/20 text-sky-300 border border-sky-400/40"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                  }`}
                >
                  {pct >= 0 ? "+" : ""}
                  {fmt1(pct)} %
                </span>
              </div>

              {/* Barras comparativas visuales */}
              <div className="space-y-1.5 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Medido este mes</span>
                    <strong className="text-white">{fmt1(m.precipitacionMm30d.observado)} mm</strong>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct < -25 ? "bg-rose-400" : "bg-sky-400"}`}
                      style={{ width: `${Math.min(100, (m.precipitacionMm30d.observado / maxLluviaBarra) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Promedio histórico (2001–2025)</span>
                    <span className="text-amber-200 font-semibold">{fmt1(m.precipitacionMm30d.climatologia)} mm</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-300/80"
                      style={{ width: `${Math.min(100, (m.precipitacionMm30d.climatologia / maxLluviaBarra) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-1">Ventana: {m.precipitacionMm30d.ventana}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Sin dato disponible.</p>
          )}
        </div>

        {/* TARJETA 2: TEMPERATURA */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <span>🌡️</span> Temperatura (7 días)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">NASA POWER</span>
          </div>

          {m ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-3xl font-extrabold text-white">{fmt1(m.temperaturaC7d.mediaObservada)} °C</div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                  {deltaTemp >= 0 ? "+" : ""}
                  {fmt1(deltaTemp)} °C
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Promedio histórico de {m.temperaturaC7d.mesClimatologico}:{" "}
                <strong className="text-white">{fmt1(m.temperaturaC7d.climatologiaMes)} °C</strong>.
                {deltaTemp > 1
                  ? " Semana más cálida que lo habitual (mayor evaporación en aguadas)."
                  : " Temperatura alineada con el promedio del mes."}
              </p>

              <p className="text-[11px] text-slate-400 pt-1">Últimos 7 días con dato ({m.temperaturaC7d.ventana})</p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Sin dato disponible.</p>
          )}
        </div>

        {/* TARJETA 3: VERDOR NDVI */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <span>🌱</span> Verdor del suelo (NDVI)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">MODIS 250m</span>
          </div>

          {ndvi ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-3xl font-extrabold text-emerald-300">{fmt3(ndvi.ultimoComposite.ndvi)}</div>
                {ndvi.compositeAnioAnterior && (
                  <span className="text-xs text-slate-300">
                    2025: <strong className="text-white">{fmt3(ndvi.compositeAnioAnterior.ndvi)}</strong>
                  </span>
                )}
              </div>

              {/* Escala visual 0 a 0.5 */}
              <div className="space-y-1">
                <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-amber-700 via-yellow-500 to-emerald-500 relative">
                  <div
                    className="absolute -top-1 h-4 w-2 rounded bg-white border border-black shadow"
                    style={{ left: `${Math.min(96, Math.max(2, (ndvi.ultimoComposite.ndvi / 0.5) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0,0 (Suelo árido Puna)</span>
                  <span>0,5+ (Vegetación densa)</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">
                Lectura del <strong className="text-slate-200">{ndvi.ultimoComposite.fecha}</strong> (compuesto satelital cada 16
                días; mide índice de verdor, no % de pasto).
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400">MODIS fuera de timeout (se mantiene meteorología NASA).</p>
          )}
        </div>
      </div>

      {/* Gráfico interactivo de los 30 días */}
      {m && m.serie.length > 1 && <GraficoLluvia serie={m.serie} />}

      {/* MODO B2B / COOPERATIVA Y SEGURO PARAMÉTRICO */}
      {modo === "parametrico" && m && (
        <div className="rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-950/50 via-slate-900 to-slate-950 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-sky-300">
                Módulo B2B · Cooperativas Ganaderas, Aseguradoras y Provincia
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Matriz de Priorización de Forraje e Índice Paramétrico (10 localidades)
              </h3>
            </div>
            <button
              onClick={() => descargarCsv(comunidad, lectura)}
              className="rounded-xl bg-sky-400 hover:bg-sky-300 text-black font-bold text-xs px-4 py-2.5 transition shadow"
            >
              📥 Descargar Serie Auditable CSV ({comunidad.nombre})
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Ordenado automáticamente desde el <strong>peor déficit hídrico</strong> al mayor superávit. Permite a una cooperativa,
            ministerio o aseguradora priorizar dónde enviar forraje hoy o auditar desvíos frente a la climatología 2001–2025
            (antecedente argentino: Sancor Seguros + CONAE/Instituto Gulich TVDI y régimen SSN 2026{" "}
            <code className="text-sky-300">RESOL-2026-315-APN-SSN#MEC</code>).{" "}
            <strong className="text-amber-200">Insumo de datos por punto; no es una póliza homologada.</strong>
          </p>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[11px] uppercase text-slate-400 bg-white/5">
                <tr>
                  <th className="py-2.5 px-3">Prioridad / Localidad</th>
                  <th className="py-2.5 px-3">Región</th>
                  <th className="py-2.5 px-3">Lluvia 30d</th>
                  <th className="py-2.5 px-3">Normal 2001–25</th>
                  <th className="py-2.5 px-3">Desvío Índice</th>
                  <th className="py-2.5 px-3">NDVI (16d)</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rankingRegional.map((r, idx) => {
                  const esActual = r.comunidad.id === comunidad.id;
                  return (
                    <tr
                      key={r.comunidad.id}
                      onClick={() => onSeleccion?.(r.comunidad.id)}
                      className={`cursor-pointer transition ${
                        esActual ? "bg-sky-500/20 font-semibold" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="py-2 px-3 text-white">
                        <span className="text-slate-400 font-mono mr-1.5">#{idx + 1}</span>
                        {r.comunidad.paradaTren ? "🚆 " : ""}
                        {r.comunidad.nombre}
                      </td>
                      <td className="py-2 px-3 uppercase text-[11px] text-slate-300">{r.comunidad.region}</td>
                      <td className="py-2 px-3 font-mono text-white">{fmt1(r.obs)} mm</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{fmt1(r.clim)} mm</td>
                      <td
                        className={`py-2 px-3 font-mono font-bold ${
                          r.pct <= -25 ? "text-rose-300" : r.pct >= 25 ? "text-sky-300" : "text-emerald-300"
                        }`}
                      >
                        {r.pct >= 0 ? "+" : ""}
                        {fmt1(r.pct)} %
                      </td>
                      <td className="py-2 px-3 font-mono text-emerald-300">{r.ndvi !== null ? fmt3(r.ndvi) : "s/d"}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.estado === "deficit"
                              ? "bg-rose-500/25 text-rose-200 border border-rose-400/40"
                              : r.estado === "superavit_reciente"
                                ? "bg-sky-500/20 text-sky-200 border border-sky-400/40"
                                : "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                          }`}
                        >
                          {r.estado === "deficit"
                            ? "DÉFICIT (Priorizar)"
                            : r.estado === "superavit_reciente"
                              ? "SUPERÁVIT"
                              : "NORMAL"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
