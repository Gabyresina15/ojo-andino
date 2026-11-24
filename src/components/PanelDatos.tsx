"use client";

import { useState } from "react";
import Link from "next/link";
import type { Comunidad, LecturaSatelital } from "@/lib/types";
import { COMUNIDADES } from "@/lib/comunidades";
import { lecturaCacheada } from "@/lib/cache";
import { anomaliaDelEstado, baseEstado, estadoHidrico, porPrioridad } from "@/lib/lecturas";
import { descargarPdfExpediente, descargarPdfProvincialConsolidado } from "@/lib/pdf-expediente";

type Props = {
  comunidad: Comunidad;
  lectura: LecturaSatelital | null;
  modo: "comunidad" | "parametrico";
  onSeleccion?: (id: string) => void;
};

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DiaSerie = NonNullable<LecturaSatelital["meteorologia"]>["serie"][number];

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const ORGANISMO_POR_ID: Record<string, string> = {
  "susques": "Comisión Municipal de Susques",
  "abra-pampa": "Municipalidad de Abra Pampa",
  "la-quiaca": "Municipalidad de La Quiaca",
  "yavi": "Comisión Municipal de Yavi",
  "humahuaca": "Municipalidad de Humahuaca",
  "tilcara": "Municipalidad de Tilcara",
  "maimara": "Comisión Municipal de Maimará",
  "purmamarca": "Comisión Municipal de Purmamarca",
  "tumbaya": "Comisión Municipal de Tumbaya",
  "volcan": "Comisión Municipal de Volcán",
};

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
        <span className="text-xs font-bold text-[#F4F1EA]">
          📊 Lluvia día por día en {n} días (medida por satélite NASA POWER)
        </span>
        <span className="flex items-center gap-3 text-[11px] text-[#9CA3AF]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2DD4BF]" /> Lluvia caída
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-[#F59E0B]" /> Promedio normal (2001–2025)
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
          aria-label={`Lluvia diaria del ${ddmm(serie[0].fecha)} al ${ddmm(serie[n - 1].fecha)}`}
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
                {`${ddmm(d.fecha)}: ${d.lluviaMm === null ? "s/d" : `${fmt2(d.lluviaMm)} mm`} · normal ${
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

      <p className="text-xs text-[#F4F1EA] min-h-4" aria-live="polite">
        {dia ? (
          <>
            <strong>{ddmm(dia.fecha)}</strong> · Llovió:{" "}
            <strong className="text-[#2DD4BF]">{dia.lluviaMm === null ? "s/d" : `${fmt2(dia.lluviaMm)} mm`}</strong> ·
            Normal para ese día:{" "}
            <strong className="text-[#F59E0B]">{dia.climaMm === null ? "s/d" : `${fmt2(dia.climaMm)} mm`}</strong>
          </>
        ) : (
          <span className="text-[#9CA3AF]">Tocá cualquier barra para ver cuánta agua cayó ese día.</span>
        )}
      </p>
    </figure>
  );
}

export default function PanelDatos({ comunidad, lectura, modo, onSeleccion }: Props) {
  if (!lectura) {
    return (
      <div className="amc-surface rounded-2xl p-6 text-xs text-[#9CA3AF]">
        Cargando datos de {comunidad.nombre}…
      </div>
    );
  }

  const m = lectura.meteorologia;

  if (modo === "comunidad") {
    return (
      <div className="amc-surface rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-[#F4F1EA]">
              Historial diario de lluvias en {comunidad.nombre} (últimos 30 días)
            </h3>
            <p className="text-xs text-[#9CA3AF]">
              Comparación entre la lluvia caída este mes y el promedio histórico de la NASA (2001–2025).
            </p>
          </div>
          <button
            onClick={() => descargarPdfExpediente(comunidad, lectura)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#0B0D10] font-bold text-xs px-3.5 py-2 transition cursor-pointer"
          >
            <span>📄</span>
            <span>Descargar Dictamen Oficial (.PDF)</span>
          </button>
        </div>
        {m && m.serie.length > 1 ? (
          <GraficoLluvia serie={m.serie} />
        ) : (
          <p className="text-xs text-[#9CA3AF]">Sin serie diaria disponible.</p>
        )}
      </div>
    );
  }

  const rankingRegional = COMUNIDADES.map((c) => {
    const l = c.id === comunidad.id ? lectura : lecturaCacheada(c.id);
    const p = l?.meteorologia?.precipitacionMm30d;
    const est = l ? estadoHidrico(l) : "sin_dato";
    let accion = "Seguimiento municipal habitual";
    if (est === "deficit") {
      accion = "🚚 Priorizar envío de forraje (alfalfa) y agua";
    } else if (est === "superavit_reciente" && c.region === "quebrada") {
      accion = "🚧 Vigilar drenajes urbanos, obras y escorrentía en caminos";
    } else if (est === "superavit_reciente") {
      accion = "🌱 Sin emergencia de forraje (esperar rebrote natural)";
    }

    return {
      comunidad: c,
      lectura: l,
      organismo: ORGANISMO_POR_ID[c.id] ?? `Municipio de ${c.nombre}`,
      obs: p?.observado ?? 0,
      clim: p?.climatologia ?? 0,
      pct: p?.porcentaje ?? 0,
      pctEstado: (l && anomaliaDelEstado(l)?.porcentaje) ?? null,
      porTemporada: !!l && baseEstado(l) === "temporada_lluvias",
      estado: est,
      accion,
    };
  }).sort(porPrioridad);

  return (
    <div className="amc-surface rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-bold text-[#F59E0B]">
            🏛️ Tablero Provincial de Asignación de Recursos · Gobierno de Jujuy
          </span>
          <h3 className="font-display text-lg sm:text-xl font-bold text-[#F4F1EA]">
            Priorización de los 10 Municipios y Comisiones Municipales
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Ordenado automáticamente desde la jurisdicción con mayor déficit de agua hasta la de mayor lluvia acumulada.
            Descargá el parte provincial consolidado en PDF o el expediente individual de cada municipio.
          </p>
        </div>

        <button
          onClick={() => descargarPdfProvincialConsolidado()}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#0B0D10] font-bold text-xs px-4 py-2.5 transition shadow cursor-pointer"
        >
          <span>📄</span>
          <span>Descargar Parte Provincial Consolidado (10 Municipios .PDF)</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0B0D10]/90">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-[11px] text-[#9CA3AF] bg-white/5">
            <tr>
              <th className="py-3 px-3 whitespace-nowrap">Prioridad / Localidad</th>
              <th className="py-3 px-3 whitespace-nowrap">Jurisdicción Municipal</th>
              <th className="py-3 px-3 whitespace-nowrap">Llovió (30d)</th>
              <th className="py-3 px-3 whitespace-nowrap">Promedio normal</th>
              <th className="py-3 px-3 whitespace-nowrap">Diagnóstico</th>
              <th className="py-3 px-3">Acción recomendada para Provincia / Municipio</th>
              <th className="py-3 px-3 whitespace-nowrap text-right">Expediente Oficial</th>
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
                    esActual ? "bg-[#D95D39]/20 font-bold" : "hover:bg-white/5"
                  }`}
                >
                  <td className="py-3 px-3 text-[#F4F1EA] whitespace-nowrap">
                    <span className="font-mono text-[#9CA3AF] mr-1.5">#{idx + 1}</span>
                    {r.comunidad.nombre}
                  </td>
                  <td className="py-3 px-3 text-[#9CA3AF] whitespace-nowrap">{r.organismo}</td>
                  <td className="py-3 px-3 font-mono text-[#F4F1EA] whitespace-nowrap">{fmt1(r.obs)} mm</td>
                  <td className="py-3 px-3 font-mono text-[#9CA3AF] whitespace-nowrap">{fmt1(r.clim)} mm</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
                        r.estado === "deficit"
                          ? "bg-[#D95D39]/25 text-[#F4F1EA] border border-[#D95D39]/50"
                          : r.estado === "superavit_reciente"
                            ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40"
                            : "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/40"
                      }`}
                    >
                      {r.estado === "deficit" ? "🔴 Déficit" : r.estado === "superavit_reciente" ? "🟢 Superávit" : "🟡 Normal"}
                      {r.pctEstado != null &&
                        ` (${r.pctEstado >= 0 ? "+" : ""}${fmt1(r.pctEstado)}%${r.porTemporada ? " temporada" : ""})`}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#F4F1EA]/90">{r.accion}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => r.lectura && descargarPdfExpediente(r.comunidad, r.lectura)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#F59E0B] hover:bg-[#F59E0B]/90 px-2.5 py-1.5 text-[11px] font-bold text-[#0B0D10] transition cursor-pointer"
                        title={`Descargar anexo oficial en PDF de ${r.comunidad.nombre}`}
                      >
                        📄 Bajar PDF
                      </button>
                      <Link
                        href={`/municipio/${r.comunidad.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#F4F1EA] transition"
                      >
                        📂 Historial →
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
