"use client";

import { useState } from "react";
import { simularPriorizacion, type NodoPriorizacion } from "@/lib/priorizacion";

const etiquetas = { deficit: "Déficit", normal: "Normal", superavit_reciente: "Recuperada", sin_dato: "Sin dato" };
const colores = { deficit: "#D95D39", normal: "#F59E0B", superavit_reciente: "#10B981", sin_dato: "#9CA3AF" };
const numero = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

export default function SimuladorPriorizacion({ nodos, onSeleccion }: { nodos: NodoPriorizacion[]; onSeleccion: (id: string) => void }) {
  const [fletes, setFletes] = useState(40);
  const [costo, setCosto] = useState("");
  const resultado = simularPriorizacion(nodos, fletes);
  const destinos = resultado.filas.filter((f) => f.delta > 0).map((f) => f.nombre).join(", ");
  const costoValido = costo.trim() !== "" && Number.isFinite(Number(costo)) && Number(costo) >= 0;
  return (
    <section aria-labelledby="simulador-titulo" className="amc-surface rounded-2xl p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-xs font-mono uppercase text-[#F59E0B]">Presupuesto provincial · Puna</p>
        <h2 id="simulador-titulo" className="font-display text-xl font-bold">Simulador de Priorización Logística</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Ajustá los camiones disponibles y compará dónde rendiría más el mismo presupuesto.</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm flex flex-col gap-1">Fletes totales
          <input className="rounded-lg border border-white/20 bg-[#0B0D10] px-3 py-2 w-40" type="number" min="0" step="1" value={fletes} onChange={(e) => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n >= 0) setFletes(n); }} />
        </label>
        <label className="text-sm flex flex-col gap-1">Costo por flete (pesos, opcional)
          <input className="rounded-lg border border-white/20 bg-[#0B0D10] px-3 py-2 w-56 max-w-full" type="number" min="0" step="any" placeholder="Ingresá tu costo" value={costo} onChange={(e) => setCosto(e.target.value)} />
        </label>
      </div>
      <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 p-3">
        <p className="font-bold text-[#10B981]">{resultado.fletesReasignados} de {fletes} fletes pasan de municipios recuperados{destinos ? ` a ${destinos}` : " a destinos con déficit (sin destinos actuales)"}.</p>
        <p className="text-sm text-[#9CA3AF]">En el reparto uniforme, {resultado.fletesSinEmergencia} fletes irían a zonas sin emergencia hídrica según lluvia 30d. Reserva provincial: {resultado.reservaProvincial} fletes.</p>
        {costoValido && <p className="text-sm mt-1">Presupuesto redirigido: <strong>$ {numero(resultado.fletesReasignados * Number(costo))} pesos</strong>. No es un ahorro neto: se mantiene el presupuesto de los viajes reasignados.</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm text-left">
          <caption className="sr-only">Fletes por municipio antes y después de priorizar</caption>
          <thead className="text-xs text-[#9CA3AF] border-b border-white/15"><tr><th className="py-2">Municipio / lluvia 30d</th><th>Estado</th><th>Reparto uniforme</th><th>Reparto priorizado</th><th>Delta</th></tr></thead>
          <tbody>{resultado.filas.map((f) => <tr key={f.id} className="border-b border-white/10">
            <td className="py-3 pr-3"><button className="underline underline-offset-4 cursor-pointer" onClick={() => onSeleccion(f.id)}>{f.nombre}</button><span className="block text-xs text-[#9CA3AF]">{f.porcentaje === null ? "Sin dato" : `${f.porcentaje > 0 ? "+" : ""}${numero(f.porcentaje)}%`}</span></td>
            <td style={{ color: colores[f.estado] }}>{etiquetas[f.estado]}</td><td>{f.baseline}</td><td className="font-bold">{f.priorizado}</td><td style={{ color: colores[f.estado] }}>{f.delta > 0 ? "+" : ""}{f.delta}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-[#9CA3AF]">Simulación orientativa: normal y sin dato conservan su cuota; lo liberado se reparte por magnitud del déficit de lluvia. Sin déficit, queda en reserva. No reemplaza la evaluación territorial.</p>
      <ul className="text-[11px] text-[#9CA3AF]">{resultado.filas.map((f) => <li key={f.id}>{f.nombre} · NASA POWER · {f.ventana} · último día: {f.ultimoDiaConDato ?? "sin dato"}</li>)}</ul>
    </section>
  );
}
