"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AlertaRespuesta, Comunidad, LecturaSatelital } from "@/lib/types";
import { lecturaCacheada } from "@/lib/cache";
import { corteLectura, estadoHidrico } from "@/lib/lecturas";
import { alertaDeterminista, payloadUsuario, recomendacionGobierno, validarNumeros } from "@/lib/alerta";
import { descargarPdfExpediente } from "@/lib/pdf-expediente";
import { JURISDICCION_MUNICIPAL } from "./PanelAlerta";
import { ChakanaIcon } from "./AndeanMotifs";

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt3 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function ExpedienteMunicipal({ comunidad }: { comunidad: Comunidad }) {
  const [lectura, setLectura] = useState<LecturaSatelital | null>(() => lecturaCacheada(comunidad.id));
  const [alertaGrok, setAlertaGrok] = useState<AlertaRespuesta | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch(`/api/lecturas?id=${comunidad.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((l: LecturaSatelital | null) => {
        if (l && l.meteorologia) setLectura(l);
      })
      .catch(() => {});
  }, [comunidad.id]);

  const alertaBase = useMemo<AlertaRespuesta | null>(() => {
    if (!lectura) return null;
    const det = alertaDeterminista(comunidad, lectura, "comunidad");
    const payload = payloadUsuario(comunidad, lectura, "comunidad");
    const v = validarNumeros(`${det.resumen_oral} ${det.nota_parametrica}`, payload);
    return {
      comunidadId: comunidad.id,
      modo: "comunidad",
      ...det,
      origen: "determinista",
      modelo: null,
      validacion: { ...v, estadoCorregido: false, motivoFallback: null },
      generadoEn: lectura.generadoEn,
    };
  }, [comunidad, lectura]);

  useEffect(() => {
    if (!lectura) return;
    fetch("/api/alerta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: comunidad.id, modo: "comunidad" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((a: AlertaRespuesta | null) => {
        setAlertaGrok(a && a.corteDatos === corteLectura(lectura) ? a : null);
      })
      .catch(() => {});
  }, [comunidad.id, lectura]);

  const alerta = alertaGrok ?? alertaBase;
  const m = lectura?.meteorologia;
  const ndvi = lectura?.ndvi;
  const est = lectura ? estadoHidrico(lectura) : "sin_dato";
  const jurisdiccion = JURISDICCION_MUNICIPAL[comunidad.id] ?? `Municipio de ${comunidad.nombre}`;

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // ignore
    }
  };

  const diasConLluvia = m ? m.serie.filter((d) => (d.lluviaMm ?? 0) >= 0.5).length : 0;
  const picoLluvia = m
    ? [...m.serie].sort((a, b) => (b.lluviaMm ?? 0) - (a.lluviaMm ?? 0))[0]
    : null;

  return (
    <div className="min-h-screen amc-grid-bg text-[#F4F1EA] print:bg-white print:text-black">
      {/* BARRA DE NAVEGACIÓN Y ACCIONES (Se oculta al exportar a PDF) */}
      <header className="border-b border-white/10 bg-[#0B0D10]/95 backdrop-blur sticky top-0 z-50 print:hidden">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/?c=${comunidad.id}`}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-[#F4F1EA] transition"
          >
            <span>←</span>
            <span>Volver al Tablero Provincial de Jujuy</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copiarLink}
              className="min-h-[42px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-[#F4F1EA] transition cursor-pointer"
            >
              {copiado ? "✓ Link del expediente copiado" : "🔗 Copiar link de este registro"}
            </button>
            <button
              onClick={() => lectura && descargarPdfExpediente(comunidad, lectura, alerta)}
              disabled={!lectura}
              className="min-h-[42px] rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 px-4 py-2 text-xs font-bold text-[#0B0D10] transition shadow cursor-pointer flex items-center gap-2"
            >
              <span>📄</span>
              <span>Descargar Anexo Oficial (.PDF)</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 space-y-6 print:py-2 print:space-y-4">
        {/* MEMBRETE OFICIAL DEL EXPEDIENTE MUNICIPAL */}
        <section className="amc-surface-elevated rounded-3xl p-6 sm:p-8 space-y-4 print:border print:border-slate-300 print:bg-white print:text-black print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4 print:border-slate-300">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#F59E0B] print:text-slate-700 font-bold">
                <ChakanaIcon className="h-4 w-4 text-[#D95D39]" />
                <span>Gobierno de la Provincia de Jujuy · Sistema Ojo Andino</span>
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-[#F4F1EA] print:text-black">
                Expediente Hídrico e Historial Satelital · {comunidad.nombre}
              </h1>
              <p className="text-sm text-[#9CA3AF] print:text-slate-600">
                Jurisdicción: <strong className="text-[#F4F1EA] print:text-black">{jurisdiccion}</strong> · Región:{" "}
                <strong className="uppercase text-[#F4F1EA] print:text-black">{comunidad.region}</strong>
              </p>
            </div>

            <div className="rounded-2xl bg-[#0B0D10]/80 border border-white/10 p-3.5 text-xs font-mono space-y-1 print:bg-slate-100 print:border-slate-300 print:text-black">
              <div>
                EXPEDIENTE: <strong>EXP-JUJ-2026-{comunidad.id.toUpperCase()}</strong>
              </div>
              <div>
                COORDENADAS: {comunidad.lat.toFixed(4)}°, {comunidad.lon.toFixed(4)}°
              </div>
              <div>ÚLTIMO CORTE NASA: {m?.ultimoDiaConDato ?? "s/d"}</div>
              <div>SERIE BASE: Climatología 2001–2025 (25 años)</div>
            </div>
          </div>

          {/* Dictamen y Acción de Gobierno */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  est === "deficit"
                    ? "bg-[#D95D39]/25 border-[#D95D39] text-[#F4F1EA] print:text-red-700 print:border-red-600"
                    : est === "superavit_reciente"
                      ? "bg-[#10B981]/20 border-[#10B981] text-[#10B981] print:text-emerald-700 print:border-emerald-600"
                      : "bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B] print:text-amber-700 print:border-amber-600"
                }`}
              >
                {est === "deficit"
                  ? "🔴 PRIORIDAD ALTA · DÉFICIT HÍDRICO"
                  : est === "superavit_reciente"
                    ? "🟢 SUPERÁVIT DE LLUVIA RECIENTE"
                    : "🟡 RANGO CLIMATOLÓGICO NORMAL"}
              </span>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-[#F4F1EA] print:text-black">
              {alerta?.resumen_oral}
            </p>

            {lectura && (
              <div className="rounded-2xl bg-[#D95D39]/15 border border-[#D95D39]/40 p-4 text-sm text-[#F4F1EA] print:bg-slate-100 print:border-slate-400 print:text-black">
                <strong>🏛️ Decisión operativa recomendada para Provincia y Municipio:</strong>{" "}
                {recomendacionGobierno(comunidad, lectura)}
              </div>
            )}
          </div>
        </section>

        {/* RESUMEN DE INDICADORES HISTÓRICOS */}
        {m && (
          <section className="grid gap-4 sm:grid-cols-4">
            <div className="amc-surface rounded-2xl p-4 print:border print:border-slate-300 print:bg-white">
              <div className="text-xs text-[#9CA3AF] print:text-slate-600">Lluvia acumulada (30 días)</div>
              <div className="font-mono text-2xl font-extrabold text-[#F4F1EA] print:text-black mt-1">
                {fmt1(m.precipitacionMm30d.observado)} mm
              </div>
              <div className="text-xs text-[#9CA3AF] print:text-slate-600 mt-1">
                Promedio 2001–2025: <strong>{fmt1(m.precipitacionMm30d.climatologia)} mm</strong>
              </div>
              {m.precipitacionTemporada && (
                <div className="text-xs text-[#9CA3AF] print:text-slate-600 mt-1">
                  Temporada de lluvias{m.precipitacionTemporada.enCurso ? " (en curso)" : ""}:{" "}
                  <strong>{fmt1(m.precipitacionTemporada.observado)} mm</strong> de {fmt1(m.precipitacionTemporada.climatologia)} mm
                  normales ({(m.precipitacionTemporada.porcentaje ?? 0) >= 0 ? "+" : ""}
                  {fmt1(m.precipitacionTemporada.porcentaje ?? 0)}%)
                </div>
              )}
            </div>

            <div className="amc-surface rounded-2xl p-4 print:border print:border-slate-300 print:bg-white">
              <div className="text-xs text-[#9CA3AF] print:text-slate-600">Desvío frente a la historia</div>
              <div
                className={`font-mono text-2xl font-extrabold mt-1 ${
                  (m.precipitacionMm30d.porcentaje ?? 0) <= -25
                    ? "text-[#D95D39] print:text-red-700"
                    : "text-[#10B981] print:text-emerald-700"
                }`}
              >
                {(m.precipitacionMm30d.porcentaje ?? 0) >= 0 ? "+" : ""}
                {fmt1(m.precipitacionMm30d.porcentaje ?? 0)}%
              </div>
              <div className="text-xs text-[#9CA3AF] print:text-slate-600 mt-1">
                {diasConLluvia} de {m.serie.length} días registraron lluvias
              </div>
            </div>

            <div className="amc-surface rounded-2xl p-4 print:border print:border-slate-300 print:bg-white">
              <div className="text-xs text-[#9CA3AF] print:text-slate-600">Mayor lluvia en un día</div>
              <div className="font-mono text-2xl font-extrabold text-[#F4F1EA] print:text-black mt-1">
                {picoLluvia && picoLluvia.lluviaMm ? `${fmt1(picoLluvia.lluviaMm)} mm` : "0,0 mm"}
              </div>
              <div className="text-xs text-[#9CA3AF] print:text-slate-600 mt-1">
                {picoLluvia ? `Registrado el ${ddmm(picoLluvia.fecha)}` : "Sin picos registrados"}
              </div>
            </div>

            <div className="amc-surface rounded-2xl p-4 print:border print:border-slate-300 print:bg-white">
              <div className="text-xs text-[#9CA3AF] print:text-slate-600">Índice de Vegetación (MODIS)</div>
              <div className="font-mono text-2xl font-extrabold text-[#10B981] print:text-black mt-1">
                {ndvi ? fmt3(ndvi.ultimoComposite.ndvi) : "s/d"}
              </div>
              <div className="text-xs text-[#9CA3AF] print:text-slate-600 mt-1">
                {ndvi?.compositeAnioAnterior
                  ? `Noviembre 2025: ${fmt3(ndvi.compositeAnioAnterior.ndvi)}`
                  : "Escala satelital 0 a 1"}
              </div>
            </div>
          </section>
        )}

        {/* EVOLUCIÓN INTERANUAL DE PASTURAS (2025 vs 2026) Y ANTECEDENTES DE LA JURISDICCIÓN */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="amc-surface rounded-2xl p-5 space-y-3 print:border print:border-slate-300 print:bg-white">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F1EA] print:text-black">
              🌱 Evolución Histórica del Índice de Vegetación (MODIS Terra 250m)
            </h2>
            <p className="text-xs text-[#9CA3AF] print:text-slate-600">
              Comparación del vigor vegetal entre la primavera actual (2026) y el mismo período del año anterior (2025):
            </p>
            {ndvi ? (
              <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="rounded-xl bg-[#0B0D10]/80 border border-white/10 p-3 print:bg-slate-100 print:border-slate-300">
                  <div className="text-[#9CA3AF] print:text-slate-600">Noviembre 2025</div>
                  <div className="font-mono text-lg font-bold text-[#F4F1EA] print:text-black mt-0.5">
                    {ndvi.compositeAnioAnterior ? fmt3(ndvi.compositeAnioAnterior.ndvi) : "s/d"}
                  </div>
                  <div className="text-[11px] text-[#9CA3AF] print:text-slate-500">
                    {ndvi.compositeAnioAnterior?.fecha ?? "Año anterior"}
                  </div>
                </div>

                <div className="rounded-xl bg-[#0B0D10]/80 border border-white/10 p-3 print:bg-slate-100 print:border-slate-300">
                  <div className="text-[#9CA3AF] print:text-slate-600">Octubre 2026</div>
                  <div className="font-mono text-lg font-bold text-[#F4F1EA] print:text-black mt-0.5">
                    {ndvi.compositeAnterior ? fmt3(ndvi.compositeAnterior.ndvi) : "s/d"}
                  </div>
                  <div className="text-[11px] text-[#9CA3AF] print:text-slate-500">
                    {ndvi.compositeAnterior?.fecha ?? "Corte previo"}
                  </div>
                </div>

                <div className="rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 p-3 print:bg-slate-100 print:border-slate-400">
                  <div className="text-[#10B981] print:text-black font-bold">Noviembre 2026</div>
                  <div className="font-mono text-lg font-bold text-[#F4F1EA] print:text-black mt-0.5">
                    {fmt3(ndvi.ultimoComposite.ndvi)}
                  </div>
                  <div className="text-[11px] text-[#9CA3AF] print:text-slate-500">{ndvi.ultimoComposite.fecha}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#9CA3AF]">Sin serie MODIS disponible.</p>
            )}
          </div>

          <div className="amc-surface rounded-2xl p-5 space-y-3 print:border print:border-slate-300 print:bg-white">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F1EA] print:text-black">
              📌 Antecedentes y Contexto Territorial de {comunidad.nombre}
            </h2>
            <p className="text-xs sm:text-sm text-[#F4F1EA]/90 print:text-black leading-relaxed">
              {comunidad.ficha.resumen}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {comunidad.ficha.calendario.map((ev) => (
                <span
                  key={ev.nombre}
                  className="text-[11px] rounded-lg bg-[#0B0D10]/80 border border-white/10 px-2.5 py-1 text-[#9CA3AF] print:bg-slate-100 print:border-slate-300 print:text-black"
                >
                  <strong className="text-[#F59E0B] print:text-black">{ev.nombre}:</strong> {ev.cuando}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* REGISTRO HISTÓRICO DÍA POR DÍA (LOS 30 DÍAS COMPLETOS) */}
        {m && m.serie.length > 0 && (
          <section className="amc-surface rounded-2xl p-5 sm:p-6 space-y-4 print:border print:border-slate-300 print:bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-[#F4F1EA] print:text-black">
                  📅 Registro Histórico Día por Día ({m.precipitacionMm30d.ventana})
                </h2>
                <p className="text-xs text-[#9CA3AF] print:text-slate-600">
                  Bitácora diaria verificada de precipitaciones y temperaturas en {comunidad.nombre} (fuente: NASA POWER).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0B0D10]/90 print:bg-white print:border-slate-300">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-[11px] text-[#9CA3AF] bg-white/5 print:bg-slate-100 print:text-black print:border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Lluvia caída</th>
                    <th className="py-2.5 px-3">Promedio histórico (2001–2025)</th>
                    <th className="py-2.5 px-3">Diferencia del día</th>
                    <th className="py-2.5 px-3">Temperatura media</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono print:divide-slate-200">
                  {[...m.serie].reverse().map((d) => {
                    const obs = d.lluviaMm ?? 0;
                    const clim = d.climaMm ?? 0;
                    const dif = obs - clim;
                    return (
                      <tr key={d.fecha} className="hover:bg-white/5">
                        <td className="py-2 px-3 text-[#F4F1EA] print:text-black">{ddmm(d.fecha)}</td>
                        <td
                          className={`py-2 px-3 font-bold ${
                            obs >= 5
                              ? "text-[#2DD4BF] print:text-sky-700"
                              : obs > 0
                                ? "text-[#F4F1EA] print:text-black"
                                : "text-[#9CA3AF] print:text-slate-500"
                          }`}
                        >
                          {fmt2(obs)} mm
                        </td>
                        <td className="py-2 px-3 text-[#9CA3AF] print:text-slate-600">{fmt2(clim)} mm</td>
                        <td
                          className={`py-2 px-3 ${
                            dif >= 0 ? "text-[#10B981] print:text-emerald-700" : "text-[#D95D39] print:text-red-700"
                          }`}
                        >
                          {dif >= 0 ? "+" : ""}
                          {fmt2(dif)} mm
                        </td>
                        <td className="py-2 px-3 text-[#F4F1EA] print:text-black">
                          {d.t2m !== null ? `${fmt1(d.t2m)} °C` : "s/d"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="text-[11px] text-[#9CA3AF] print:text-slate-600 border-t border-white/10 print:border-slate-300 pt-4">
          Documento oficial generado por Ojo Andino para el Gobierno de la Provincia de Jujuy y {jurisdiccion}. Fuentes:
          NASA/POWER (serie 2001–2025) y MODIS MOD13Q1 (ORNL DAAC).
        </footer>
      </main>
    </div>
  );
}
