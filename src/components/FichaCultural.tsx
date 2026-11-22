"use client";

import type { Comunidad } from "@/lib/types";
import { ChakanaIcon } from "./AndeanMotifs";

export default function FichaCultural({ comunidad }: { comunidad: Comunidad }) {
  return (
    <div className="amc-surface rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#D95D39] font-bold">
            <ChakanaIcon className="h-3.5 w-3.5" />
            MEMORIA TERRITORIAL Y CALENDARIO ANDINO
          </span>
          <h3 className="font-display text-lg font-bold text-[#F4F1EA]">
            Contexto social y cultural de {comunidad.nombre}
          </h3>
        </div>
        <a
          href={comunidad.fuenteCoords}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[36px] inline-flex items-center text-xs font-mono px-3 py-1 rounded-lg border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-all duration-200"
        >
          GEO_REF OFICIAL ↗
        </a>
      </div>

      <p className="text-xs sm:text-sm text-[#F4F1EA]/90 leading-relaxed">{comunidad.ficha.resumen}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {comunidad.ficha.calendario.map((ev) => (
          <div key={ev.nombre} className="rounded-xl bg-[#0B0D10]/85 border border-white/10 p-3.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <strong className="font-display text-[#F59E0B] text-sm">{ev.nombre}</strong>
              <span className="font-mono px-2 py-0.5 rounded bg-[#D95D39]/20 border border-[#D95D39]/40 text-[11px] text-[#F4F1EA]">
                {ev.cuando}
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">{ev.nota}</p>
            <a
              href={ev.fuente}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-mono text-[11px] text-[#2DD4BF] hover:underline pt-0.5"
            >
              Fuente verificada ↗
            </a>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#9CA3AF] border-t border-white/10 pt-3">
        ⚖️ <strong className="text-[#F4F1EA]">Protocolo ético:</strong> {comunidad.ficha.aviso} Los casos de uso presentados
        son ilustrativos y están diseñados para co-crearse con las comunidades y comisiones municipales.
      </p>
    </div>
  );
}
