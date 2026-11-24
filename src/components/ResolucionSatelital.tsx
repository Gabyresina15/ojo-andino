import type { productoNdvi } from "@/lib/lecturas";

export default function ResolucionSatelital({ producto }: { producto: ReturnType<typeof productoNdvi> }) {
  return (
    <section
      aria-label="Resolución espacial de las fuentes"
      className="rounded-2xl border border-white/10 bg-[#0B0D10]/80 p-4 sm:p-5 print:border-slate-300 print:bg-white"
    >
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] print:text-slate-600">
        Resolución espacial
      </h2>
      <p className="font-display mt-1 text-lg font-bold text-[#F4F1EA] print:text-black">
        Dos escalas para leer el territorio
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-[#2DD4BF]/25 bg-[#2DD4BF]/5 p-3.5 print:border-slate-300 print:bg-white">
          <h3 className="text-xs font-bold text-[#2DD4BF] print:text-black">NASA POWER · Meteorología regional</h3>
          <p className="mt-1 font-mono text-xl font-bold text-[#F4F1EA] print:text-black">
            0,5° × 0,625°
            <span className="ml-2 inline-block text-xs font-normal text-[#9CA3AF] print:text-slate-600">
              ≈ 55 km de norte a sur
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#D1D5DB] print:text-slate-700">
            Usá la lluvia y la temperatura como referencia regional. Dos localidades en la misma celda pueden
            mostrar los mismos valores: son estimaciones de grilla, no mediciones de una estación local.
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-[#10B981]/25 bg-[#10B981]/5 p-3.5 print:border-slate-300 print:bg-white">
          <h3 className="text-xs font-bold text-[#6EE7B7] print:text-black">MODIS {producto} · Vegetación local</h3>
          <p className="mt-1 font-mono text-xl font-bold text-[#F4F1EA] print:text-black">
            250&nbsp;m
            <span className="ml-2 inline-block text-xs font-normal text-[#9CA3AF] print:text-slate-600">
              por píxel · resolución nominal
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#D1D5DB] print:text-slate-700">
            Mirá el verdor a escala de parcela o valle. ORNL TESViS devuelve el NDVI del píxel de la ubicación:
            un compuesto de 16 días, no un dato de hoy ni un promedio del municipio.
          </p>
        </div>
      </div>
    </section>
  );
}
