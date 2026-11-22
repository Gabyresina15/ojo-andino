"use client";

import { useState } from "react";
import { leerCosto, leerFletes } from "@/lib/entradas-priorizacion";
import { presupuestoRedirigido, simularPriorizacion, type NodoPriorizacion } from "@/lib/priorizacion";

const etiquetas = { deficit: "Déficit", normal: "Normal", superavit_reciente: "Recuperada", sin_dato: "Sin dato" };
const colores = { deficit: "#D95D39", normal: "#F59E0B", superavit_reciente: "#10B981", sin_dato: "#9CA3AF" };
const numero = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const moneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function SimuladorPriorizacion({ nodos, onSeleccion }: { nodos: NodoPriorizacion[]; onSeleccion: (id: string) => void }) {
  const [fletes, setFletes] = useState(40);
  const [textoFletes, setTextoFletes] = useState("40");
  const [costo, setCosto] = useState("");
  const [ultimoCosto, setUltimoCosto] = useState<number | null>(null);
  const fletesInvalidos = leerFletes(textoFletes) === null;
  const costoInvalido = costo !== "" && leerCosto(costo) === null;
  const resultado = simularPriorizacion(nodos, fletes);
  const destinos = resultado.filas.filter((f) => f.estado === "deficit").map((f) => f.nombre).join(", ");
  return (
    <section aria-labelledby="simulador-titulo" className="amc-surface rounded-2xl p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-xs font-mono uppercase text-[#F59E0B]">Presupuesto provincial · Puna</p>
        <h2 id="simulador-titulo" className="font-display text-xl font-bold">Simulador de Priorización Logística</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Ajustá los camiones disponibles y compará dónde rendiría más el mismo presupuesto.</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm flex flex-col gap-1">Fletes totales
          <input className="rounded-lg border border-white/20 bg-[#0B0D10] px-3 py-2 w-40" type="text" inputMode="numeric" value={textoFletes} aria-invalid={fletesInvalidos} aria-describedby="fletes-validacion" onChange={(e) => {
            const texto = e.target.value;
            setTextoFletes(texto);
            const valor = leerFletes(texto);
            if (valor !== null) setFletes(valor);
          }} />
          <span id="fletes-validacion" className="text-xs text-[#F59E0B]">
            {fletesInvalidos ? "Ingresá un entero no negativo. Se conserva el último reparto válido." : ""}
          </span>
        </label>
        <label className="text-sm flex flex-col gap-1">Costo por flete (pesos, opcional)
          <input className="rounded-lg border border-white/20 bg-[#0B0D10] px-3 py-2 w-56 max-w-full" type="text" inputMode="decimal" placeholder="Ingresá tu costo" value={costo} aria-invalid={costoInvalido} aria-describedby="costo-validacion" onChange={(e) => {
            const texto = e.target.value;
            setCosto(texto);
            const valor = leerCosto(texto);
            if (texto === "" || valor !== null) setUltimoCosto(valor);
          }} />
          <span id="costo-validacion" className="text-xs text-[#F59E0B]">
            {costoInvalido ? "Ingresá un costo no negativo con hasta 2 decimales. Se conserva el último costo válido." : ""}
          </span>
        </label>
      </div>
      <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 p-3">
        <p className="font-bold text-[#10B981]">
          {textoFletes === "" || fletes === 0
            ? "Cargá la cantidad de fletes disponibles para simular el reparto."
            : destinos
              ? `${resultado.fletesReasignados} de ${fletes} fletes pasan de municipios recuperados a ${destinos}.`
              : `Sin municipios con déficit: ${resultado.reservaProvincial} fletes quedan en reserva provincial.`}
        </p>
        <p className="text-sm text-[#9CA3AF]">En el reparto uniforme, {resultado.fletesARecuperados} fletes irían a municipios recuperados con superávit reciente de lluvia (30d). Reserva provincial: {resultado.reservaProvincial} fletes.</p>
        {ultimoCosto !== null && <p className="text-sm mt-1">Presupuesto redirigido: <strong>{moneda.format(presupuestoRedirigido(resultado.fletesReasignados, ultimoCosto))}</strong>. No es un ahorro neto: se mantiene el presupuesto de los viajes reasignados.</p>}
      </div>
      <ul className="space-y-3 sm:hidden" aria-label="Fletes por municipio antes y después de priorizar">
        {resultado.filas.map((fila) => (
          <li key={fila.id} className="rounded-xl border border-white/15 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button className="underline underline-offset-4 cursor-pointer" onClick={() => onSeleccion(fila.id)}>
                {fila.nombre}
              </button>
              <span style={{ color: colores[fila.estado] }}>{etiquetas[fila.estado]}</span>
            </div>
            <p className="text-xs text-[#9CA3AF]">
              Lluvia 30d: {fila.porcentaje === null ? "Sin dato" : `${fila.porcentaje > 0 ? "+" : ""}${numero(fila.porcentaje)}%`}
            </p>
            <p className="text-xs text-[#9CA3AF]">Reparto uniforme → priorizado (delta)</p>
            <p className="font-bold">
              {fila.baseline} → {fila.priorizado}{" "}
              <span style={{ color: colores[fila.estado] }}>
                ({fila.delta > 0 ? "+" : fila.delta < 0 ? "−" : ""}{Math.abs(fila.delta)})
              </span>{" "}fletes
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <table className="w-full text-sm text-left">
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
