"use client";

import { useEffect, useState } from "react";
import { RADIO_FOCOS_KM, type ContextoSatelital as Ctx } from "@/lib/contexto";

const fmt2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dia = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const diaAr = (iso: string) => dia(new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString());

function Bloque({ titulo, fuente, children }: { titulo: string; fuente: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 p-3 print:border-slate-300">
      <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF] print:text-slate-600">{titulo}</div>
      <div className="mt-1.5 text-sm text-[#F4F1EA] print:text-black space-y-1">{children}</div>
      <div className="mt-2 text-[10px] text-[#9CA3AF] print:text-slate-600">{fuente}</div>
    </div>
  );
}
const SinDato = () => <div className="text-xs text-[#9CA3AF]">La fuente no respondió.</div>;

/** Otros datos satelitales de la localidad. Se muestran aparte y no intervienen en el estado hídrico. */
export function ContextoSatelital({ comunidadId }: { comunidadId: string }) {
  const [r, setR] = useState<{ id: string; c: Ctx | null } | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/contexto?id=${comunidadId}`)
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null)
      .then((c) => vigente && setR({ id: comunidadId, c }));
    return () => {
      vigente = false;
    };
  }, [comunidadId]);

  const c = r?.id === comunidadId ? r.c : undefined;
  const f = c?.focos;
  const h = c?.humedad;

  return (
    <div className="rounded-2xl bg-[#0B0D10]/80 border border-dashed border-white/20 p-4 print:bg-white print:border-slate-300">
      <div className="text-xs text-[#9CA3AF] print:text-slate-600">
        Otros datos satelitales de la zona ·{" "}
        <strong className="text-[#F4F1EA] print:text-black">no cambian el estado hídrico ni la recomendación</strong>
      </div>
      {c === undefined && <div className="text-xs text-[#9CA3AF] mt-2">Consultando fuentes satelitales…</div>}
      {c === null && <div className="text-xs text-[#9CA3AF] mt-2">Datos no disponibles en este momento.</div>}
      {c && (
        <div className="grid gap-3 mt-3 sm:grid-cols-3">
          <Bloque
            titulo="Focos de calor"
            fuente={`MODIS Aqua MYD14A2 (NASA), píxeles de 1 km en un cuadrado de ${RADIO_FOCOS_KM} km hacia cada lado. Los fuegos chicos o bajo nubes pueden no detectarse.`}
          >
            {f?.desactualizado ? (
              <div className="text-[#FBBF24] print:text-black">
                La fuente no se actualiza desde el período que empezó el {dia(f.hasta)}. No hay dato reciente de focos.
              </div>
            ) : f ? (
              f.periodos.length === 0 ? (
                <div>
                  Sin focos detectados en los últimos {f.compuestos} períodos de 8 días (último: desde el {dia(f.hasta)}).
                </div>
              ) : (
                f.periodos.map((p) => (
                  <div key={p.fecha}>
                    8 días desde el {dia(p.fecha)}:{" "}
                    <strong className="font-mono">
                      {p.pixeles} {p.pixeles === 1 ? "píxel" : "píxeles"}
                    </strong>{" "}
                    con fuego ({p.nominalOAlta} con confianza nominal o alta)
                  </div>
                ))
              )
            ) : (
              <SinDato />
            )}
          </Bloque>

          <Bloque
            titulo="Radar: imágenes ya tomadas"
            fuente="Sentinel-1 (ESA/Copernicus), radar de banda C a 10 m, datos abiertos. Catálogo: Earth Search. Ojo Andino todavía no procesa estas imágenes: solo informa que existen."
          >
            {c.radar ? (
              c.radar.escenas.map((e) => (
                <div key={e.id}>
                  <strong className="font-mono">{diaAr(e.fecha)}</strong> · {e.satelite}
                  {e.orbita && ` · órbita ${e.orbita}`}
                </div>
              ))
            ) : (
              <SinDato />
            )}
          </Bloque>

          <Bloque
            titulo={`Humedad del suelo${h ? ` · ${dia(h.fecha)}` : ""}`}
            fuente="NASA POWER (modelo GEOS), grilla regional. Es un valor calculado por un modelo, no una medición del satélite ni del lugar. Escala de 0 (seco) a 1 (saturado)."
          >
            {h ? (
              <>
                <div>
                  Superficie: <strong className="font-mono">{fmt2(h.superficial)}</strong>
                  {h.superficial30d !== null && (
                    <span className="text-xs text-[#9CA3AF] print:text-slate-600"> (30 días antes: {fmt2(h.superficial30d)})</span>
                  )}
                </div>
                <div>
                  Zona de raíces: <strong className="font-mono">{fmt2(h.raices)}</strong>
                  {h.raices30d !== null && (
                    <span className="text-xs text-[#9CA3AF] print:text-slate-600"> (30 días antes: {fmt2(h.raices30d)})</span>
                  )}
                </div>
              </>
            ) : (
              <SinDato />
            )}
          </Bloque>
        </div>
      )}
    </div>
  );
}
