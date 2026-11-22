"use client";

import { useState } from "react";
import type { Comunidad, LecturaSatelital } from "@/lib/types";
import { COMUNIDADES } from "@/lib/comunidades";
import { lecturaCacheada } from "@/lib/cache";
import { estadoHidrico } from "@/lib/lecturas";
import { ChakanaIcon } from "./AndeanMotifs";

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
    <figure className="rounded-2xl bg-[#0B0D10]/85 border border-white/10 p-4 space-y-2.5">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-mono uppercase font-bold text-[#F4F1EA]">
          SERIE DIARIA NASA POWER · {n} DÍAS CON DATO
        </span>
        <span className="flex items-center gap-3 text-[11px] font-mono text-[#9CA3AF]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2DD4BF]" /> OBSERVADA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-[#F59E0B]" /> CLIMATOLOGÍA 2001–2025
          </span>
        </span>
      </figcaption>

      <div className="relative h-32 sm:h-36 pl-10">
        <span className="absolute left-0 top-0 -translate-y-1/2 text-[10px] font-mono text-[#9CA3AF]">{techo} mm</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#9CA3AF]">{techo / 2} mm</span>
        <span className="absolute left-0 bottom-0 translate-y-1/2 text-[10px] font-mono text-[#9CA3AF]">0 mm</span>
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
                fill={activo === i ? "#F59E0B" : "#2DD4BF"}
                opacity={activo === i ? 1 : 0.85}
              />
            ) : null,
          )}
          <path
            d={lineaClima}
            fill="none"
            stroke="#F59E0B"
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

      <div className="relative h-3 ml-10 text-[10px] font-mono text-[#9CA3AF]">
        <span className="absolute left-0">{ddmm(serie[0].fecha)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${((medio + 0.5) / n) * 100}%` }}>
          {ddmm(serie[medio].fecha)}
        </span>
        <span className="absolute right-0">{ddmm(serie[n - 1].fecha)}</span>
      </div>

      <p className="text-xs font-mono text-[#F4F1EA] min-h-4" aria-live="polite">
        {dia ? (
          <>
            <strong>{ddmm(dia.fecha)}</strong> · OBSERVADA:{" "}
            <strong className="text-[#2DD4BF]">{dia.lluviaMm === null ? "s/d" : `${fmt2(dia.lluviaMm)} mm`}</strong> ·
            CLIMATOLOGÍA:{" "}
            <strong className="text-[#F59E0B]">{dia.climaMm === null ? "s/d" : `${fmt2(dia.climaMm)} mm`}</strong>
          </>
        ) : (
          <span className="text-[#9CA3AF]">Tocá o deslizá sobre las barras para inspeccionar un día.</span>
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
      <div className="amc-surface rounded-2xl p-6 space-y-3 animate-pulse">
        <div className="h-4 w-48 rounded bg-white/10" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-28 rounded-xl bg-white/5" />
          <div className="h-28 rounded-xl bg-white/5" />
          <div className="h-28 rounded-xl bg-white/5" />
        </div>
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
          badge: "⚠️ DÉFICIT HÍDRICO ACTIVO",
          cls: "bg-[#D95D39]/20 text-[#F4F1EA] border-[#D95D39]/60",
          explicacion: "Precipitación significativamente inferior al promedio climatológico 2001–2025.",
        }
      : est === "superavit_reciente"
        ? {
            badge: "🌧️ SUPERÁVIT DE LLUVIA RECIENTE",
            cls: "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/50",
            explicacion: "Recuperación hídrica en la última ventana de 30 días frente a la climatología 2001–2025.",
          }
        : est === "normal"
          ? {
              badge: "✅ RANGO CLIMATOLÓGICO NORMAL",
              cls: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/50",
              explicacion: "Acumulado alineado con el comportamiento histórico 2001–2025.",
            }
          : {
              badge: "SIN DATO SUFICIENTE",
              cls: "bg-white/10 text-[#9CA3AF] border-white/20",
              explicacion: "Esperando telemetría de superficie.",
            };

  const maxLluviaBarra = m ? Math.max(m.precipitacionMm30d.observado, m.precipitacionMm30d.climatologia, 1) : 1;
  const deltaTemp = m ? m.temperaturaC7d.mediaObservada - m.temperaturaC7d.climatologiaMes : 0;

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
    <div className="amc-surface rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 px-2.5 py-1 text-[11px] font-mono font-bold text-[#F59E0B]">
              <ChakanaIcon className="h-3.5 w-3.5" />
              PASO 03 · TELEMETRÍA TERRITORIAL
            </span>
            <span className="text-[11px] font-mono uppercase px-2.5 py-1 rounded-lg border border-white/15 text-[#9CA3AF]">
              {comunidad.region} · {comunidad.lat.toFixed(3)}°, {comunidad.lon.toFixed(3)}°
            </span>
            {comunidad.paradaTren && (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#D95D39]/20 text-[#F4F1EA] border border-[#D95D39]/50">
                🚆 ESTACIÓN TREN SOLAR
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F1EA]">{comunidad.nombre}</h2>
          <p className="text-xs text-[#9CA3AF]">{estadoVisual.explicacion}</p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <span className={`text-xs font-mono font-bold px-3.5 py-1.5 rounded-xl border ${estadoVisual.cls}`}>
            {estadoVisual.badge}
          </span>
          <span className="text-[11px] text-[#9CA3AF] font-mono">
            ÚLTIMO DATO NASA: {m?.ultimoDiaConDato ?? "s/d"} (DEMORA 2–3D)
          </span>
        </div>
      </div>

      {/* 3 Tarjetas con jerarquía estricta: Dato duro arriba (grande en mono) -> Etiqueta contextual -> Explicación accionable */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* TARJETA 1: LLUVIA */}
        <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 space-y-3">
          {m ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono text-3xl font-extrabold text-[#F4F1EA]">
                  {fmt1(m.precipitacionMm30d.observado)} <span className="text-base font-normal text-[#9CA3AF]">mm</span>
                </div>
                <span
                  className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border ${
                    pct <= -25
                      ? "bg-[#D95D39]/20 text-[#D95D39] border-[#D95D39]/50"
                      : pct >= 25
                        ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/40"
                        : "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40"
                  }`}
                >
                  {pct >= 0 ? "+" : ""}
                  {fmt1(pct)}%
                </span>
              </div>

              <div className="text-xs font-bold uppercase tracking-wider text-[#2DD4BF]">
                🌧️ Precipitación acumulada (30 días)
              </div>

              <div className="space-y-1.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-[#9CA3AF]">Observado</span>
                    <strong className="text-[#F4F1EA]">{fmt1(m.precipitacionMm30d.observado)} mm</strong>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct <= -25 ? "bg-[#D95D39]" : "bg-[#2DD4BF]"}`}
                      style={{ width: `${Math.min(100, (m.precipitacionMm30d.observado / maxLluviaBarra) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-[#9CA3AF]">Climatología 2001–25</span>
                    <span className="text-[#F59E0B] font-bold">{fmt1(m.precipitacionMm30d.climatologia)} mm</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F59E0B]"
                      style={{ width: `${Math.min(100, (m.precipitacionMm30d.climatologia / maxLluviaBarra) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#9CA3AF] leading-snug">
                {pct <= -25
                  ? "Acción sugerida: priorizar control de aguadas y suplementación forrajera."
                  : pct >= 25
                    ? "Acción sugerida: monitorear rebrote natural tras las lluvias de noviembre."
                    : "Acción sugerida: manejo habitual de pasturas para la época."}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#9CA3AF]">Sin dato disponible.</p>
          )}
        </div>

        {/* TARJETA 2: TEMPERATURA */}
        <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 space-y-3">
          {m ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono text-3xl font-extrabold text-[#F4F1EA]">
                  {fmt1(m.temperaturaC7d.mediaObservada)} <span className="text-base font-normal text-[#9CA3AF]">°C</span>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/40">
                  {deltaTemp >= 0 ? "+" : ""}
                  {fmt1(deltaTemp)} °C
                </span>
              </div>

              <div className="text-xs font-bold uppercase tracking-wider text-[#F59E0B]">
                🌡️ Temperatura media (últimos 7 días)
              </div>

              <p className="text-xs text-[#F4F1EA]/90 leading-relaxed">
                Climatología de {m.temperaturaC7d.mesClimatologico}:{" "}
                <strong className="font-mono text-[#F59E0B]">{fmt1(m.temperaturaC7d.climatologiaMes)} °C</strong> (ventana{" "}
                <span className="font-mono">{m.temperaturaC7d.ventana}</span>).
              </p>

              <p className="text-[11px] text-[#9CA3AF] leading-snug">
                {deltaTemp > 1
                  ? "Acción sugerida: mayor demanda de agua de bebida por anomalía térmica positiva."
                  : "Acción sugerida: estrés térmico dentro de parámetros normales."}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#9CA3AF]">Sin dato disponible.</p>
          )}
        </div>

        {/* TARJETA 3: VERDOR NDVI */}
        <div className="rounded-2xl bg-[#0B0D10]/90 border border-white/10 p-4 space-y-3">
          {ndvi ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono text-3xl font-extrabold text-[#10B981]">
                  {fmt3(ndvi.ultimoComposite.ndvi)}
                </div>
                {ndvi.compositeAnioAnterior && (
                  <span className="font-mono text-xs text-[#9CA3AF]">
                    2025: <strong className="text-[#F4F1EA]">{fmt3(ndvi.compositeAnioAnterior.ndvi)}</strong>
                  </span>
                )}
              </div>

              <div className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
                🌱 Índice de Verdor MODIS (250m · 16d)
              </div>

              <div className="space-y-1">
                <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-[#D95D39] via-[#F59E0B] to-[#10B981] relative">
                  <div
                    className="absolute -top-1 h-4 w-2 rounded bg-[#F4F1EA] border border-black shadow"
                    style={{ left: `${Math.min(96, Math.max(2, (ndvi.ultimoComposite.ndvi / 0.5) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#9CA3AF]">
                  <span>0,00 (ÁRIDO)</span>
                  <span>0,50+ (VEGETACIÓN DENSA)</span>
                </div>
              </div>

              <p className="text-[11px] text-[#9CA3AF] leading-snug">
                Composite <strong className="font-mono text-[#F4F1EA]">{ndvi.ultimoComposite.fecha}</strong>. Mide vigor fotosintético
                (0–1), no porcentaje directo de pastura.
              </p>
            </>
          ) : (
            <p className="text-xs text-[#9CA3AF]">MODIS fuera de timeout (meteorología NASA activa).</p>
          )}
        </div>
      </div>

      {/* Gráfico interactivo de 30 días */}
      {m && m.serie.length > 1 && <GraficoLluvia serie={m.serie} />}

      {/* MÓDULO B2B: MATRIZ DE PRIORIZACIÓN + DESCARGA CSV */}
      {modo === "parametrico" && m && (
        <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#0B0D10]/95 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#F59E0B]">
                MÓDULO B2B · COOPERATIVAS GANADERAS &amp; SEGUROS PARAMÉTRICOS
              </span>
              <h3 className="font-display text-base sm:text-lg font-bold text-[#F4F1EA]">
                Matriz Regional de Priorización de Forraje e Índice Satelital (10 nodos)
              </h3>
            </div>
            <button
              onClick={() => descargarCsv(comunidad, lectura)}
              className="min-h-[44px] rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 active:scale-[0.99] text-[#0B0D10] font-bold text-xs px-4 py-2.5 transition-all duration-200 shadow cursor-pointer"
            >
              📥 Descargar Serie Auditable CSV ({comunidad.nombre})
            </button>
          </div>

          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            Ranking automático del peor déficit al mayor superávit. Permite asignar fletes de forraje o auditar disparadores por
            índice satelital bajo el antecedente argentino (Sancor Seguros + CONAE/Instituto Gulich TVDI y régimen SSN 2026{" "}
            <code className="font-mono text-[#F59E0B]">RESOL-2026-315-APN-SSN#MEC</code>).{" "}
            <strong className="text-[#F4F1EA]">Insumo técnico por punto; no constituye una póliza homologada.</strong>
          </p>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[11px] font-mono uppercase text-[#9CA3AF] bg-white/5">
                <tr>
                  <th className="py-2.5 px-3">Prioridad / Nodo</th>
                  <th className="py-2.5 px-3">Región</th>
                  <th className="py-2.5 px-3">Lluvia 30d</th>
                  <th className="py-2.5 px-3">Clima 01–25</th>
                  <th className="py-2.5 px-3">Desvío</th>
                  <th className="py-2.5 px-3">NDVI (16d)</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-mono">
                {rankingRegional.map((r, idx) => {
                  const esActual = r.comunidad.id === comunidad.id;
                  return (
                    <tr
                      key={r.comunidad.id}
                      onClick={() => onSeleccion?.(r.comunidad.id)}
                      className={`cursor-pointer transition-all duration-150 ${
                        esActual ? "bg-[#D95D39]/20 font-bold" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans text-[#F4F1EA]">
                        <span className="font-mono text-[#9CA3AF] mr-1.5">#{idx + 1}</span>
                        {r.comunidad.paradaTren ? "🚆 " : ""}
                        {r.comunidad.nombre}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[11px] text-[#9CA3AF]">{r.comunidad.region}</td>
                      <td className="py-2.5 px-3 text-[#F4F1EA]">{fmt1(r.obs)} mm</td>
                      <td className="py-2.5 px-3 text-[#9CA3AF]">{fmt1(r.clim)} mm</td>
                      <td
                        className={`py-2.5 px-3 font-bold ${
                          r.pct <= -25 ? "text-[#D95D39]" : r.pct >= 25 ? "text-[#2DD4BF]" : "text-[#10B981]"
                        }`}
                      >
                        {r.pct >= 0 ? "+" : ""}
                        {fmt1(r.pct)}%
                      </td>
                      <td className="py-2.5 px-3 text-[#10B981]">{r.ndvi !== null ? fmt3(r.ndvi) : "s/d"}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.estado === "deficit"
                              ? "bg-[#D95D39]/25 text-[#F4F1EA] border border-[#D95D39]/50"
                              : r.estado === "superavit_reciente"
                                ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/40"
                                : "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40"
                          }`}
                        >
                          {r.estado === "deficit" ? "DÉFICIT · PRIORIZAR" : r.estado === "superavit_reciente" ? "SUPERÁVIT" : "NORMAL"}
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
