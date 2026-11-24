"use client";

import { useEffect, useState } from "react";
import { DIAS_PRONOSTICO, type Pronostico } from "@/lib/pronostico";

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const etiqueta = (iso: string) => `${DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Pronóstico de lluvia: se muestra aparte y no interviene en el estado hídrico. */
export function PronosticoLluvia({ comunidadId }: { comunidadId: string }) {
  const [r, setR] = useState<{ id: string; p: Pronostico | null } | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/pronostico?id=${comunidadId}`)
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null)
      .then((p) => vigente && setR({ id: comunidadId, p }));
    return () => {
      vigente = false;
    };
  }, [comunidadId]);

  const p = r?.id === comunidadId ? r.p : undefined;
  const max = p ? Math.max(1, ...p.dias.map((d) => d.mm)) : 1;

  return (
    <div className="rounded-2xl bg-[#0B0D10]/80 border border-dashed border-white/20 p-4 print:bg-white print:border-slate-300">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-xs text-[#9CA3AF] print:text-slate-600">
          Pronóstico de lluvia, próximos {DIAS_PRONOSTICO} días ·{" "}
          <strong className="text-[#F4F1EA] print:text-black">no es un dato medido</strong>
        </div>
        {p && (
          <div className="font-mono text-lg font-extrabold text-[#F4F1EA] print:text-black">{fmt1(p.totalMm)} mm</div>
        )}
      </div>
      {p === undefined && <div className="text-xs text-[#9CA3AF] mt-2">Consultando pronóstico…</div>}
      {p === null && <div className="text-xs text-[#9CA3AF] mt-2">Pronóstico no disponible en este momento.</div>}
      {p && (
        <div className="grid grid-cols-7 gap-1.5 mt-3">
          {p.dias.map((d) => (
            <div key={d.fecha} className="text-center">
              <div className="h-10 flex items-end justify-center">
                <div
                  className="w-full max-w-6 rounded-t bg-[#38BDF8]/70 print:bg-slate-500"
                  style={{ height: `${Math.max(d.mm > 0 ? 8 : 2, (d.mm / max) * 100)}%` }}
                />
              </div>
              <div className="font-mono text-[11px] text-[#F4F1EA] print:text-black mt-1">{fmt1(d.mm)}</div>
              <div className="text-[10px] text-[#9CA3AF] print:text-slate-600">{etiqueta(d.fecha)}</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-[#9CA3AF] print:text-slate-600 mt-3">
        Modelo meteorológico global, no una estación del lugar: puede fallar, sobre todo en tormentas de verano. No cambia el estado
        hídrico ni la recomendación. Fuente: MET Norway (api.met.no), licencia CC BY 4.0.
      </div>
    </div>
  );
}
