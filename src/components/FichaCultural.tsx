"use client";

import type { Comunidad } from "@/lib/types";

export default function FichaCultural({ comunidad }: { comunidad: Comunidad }) {
  return (
    <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-950/25 via-slate-900/75 to-slate-950 p-5 sm:p-6 space-y-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
            🏔️ Memoria Territorial y Calendario Andino
          </span>
          <h3 className="text-lg font-bold text-white">Contexto social y cultural de {comunidad.nombre}</h3>
        </div>
        <a
          href={comunidad.fuenteCoords}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1 rounded-full border border-sky-400/30 text-sky-300 hover:bg-sky-400/10 transition"
        >
          Ver coordenada oficial ↗
        </a>
      </div>

      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{comunidad.ficha.resumen}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {comunidad.ficha.calendario.map((ev) => (
          <div key={ev.nombre} className="rounded-2xl bg-black/45 border border-white/10 p-3.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-amber-300 text-sm">{ev.nombre}</strong>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-[11px] font-medium text-amber-200">
                {ev.cuando}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{ev.nota}</p>
            <a
              href={ev.fuente}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] text-sky-300 hover:underline pt-0.5"
            >
              Fuente verificada ↗
            </a>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 border-t border-white/10 pt-3">
        ⚖️ <strong>Compromiso ético:</strong> {comunidad.ficha.aviso} Los casos de uso del pitch son ilustrativos y están
        diseñados para co-crearse junto a las comunidades y municipios.
      </p>
    </div>
  );
}
