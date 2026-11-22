"use client";

import type { Comunidad } from "@/lib/types";

export default function FichaCultural({ comunidad }: { comunidad: Comunidad }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
            Capa Cultural y Territorial
          </span>
          <h3 className="text-base font-semibold text-white">Contexto de {comunidad.nombre}</h3>
        </div>
        <a
          href={comunidad.fuenteCoords}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-sky-300 hover:underline"
        >
          Fuente coordenadas ↗
        </a>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{comunidad.ficha.resumen}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {comunidad.ficha.calendario.map((ev) => (
          <div key={ev.nombre} className="rounded-xl bg-black/40 border border-white/10 p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-amber-200">{ev.nombre}</strong>
              <span className="text-[10px] text-slate-400">{ev.cuando}</span>
            </div>
            <p className="text-[11px] text-slate-300">{ev.nota}</p>
            <a href={ev.fuente} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-300 hover:underline">
              Fuente citada ↗
            </a>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 border-t border-white/10 pt-2">
        {comunidad.ficha.aviso} Los ejemplos de uso (ej. un pastor ilustrativo) son ficcionales y pensados para co-diseño.
      </p>
    </div>
  );
}
