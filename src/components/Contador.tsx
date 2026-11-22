"use client";

import { useEffect, useState } from "react";

type Stats = { habilitado: boolean; total?: number; gps?: number; alertas?: number; personas?: number; error?: string };

export default function Contador() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    let vivo = true;
    const tick = () =>
      fetch("/api/traccion", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: Stats) => vivo && setS(j))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 12000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  if (!s?.habilitado || s.error || s.total === undefined) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-1.5 text-xs text-[#F4F1EA] shadow-sm"
      title="Tracción en vivo registrada hoy a bordo del Tren Solar (Supabase)"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F59E0B]" />
      </span>
      <span className="font-mono font-bold text-[#F59E0B]">{s.personas ?? 0}</span>
      <span className="text-[11px] text-[#F4F1EA]/90">pasajeros</span>
      <span className="text-[#9CA3AF]">·</span>
      <span className="font-mono font-bold text-[#2DD4BF]">{s.gps ?? 0}</span>
      <span className="text-[11px] text-[#F4F1EA]/90 hidden sm:inline">nodos tren</span>
      <span className="text-[#9CA3AF]">·</span>
      <span className="font-mono font-bold text-[#10B981]">{s.alertas ?? 0}</span>
      <span className="text-[11px] text-[#F4F1EA]/90">alertas</span>
    </div>
  );
}
