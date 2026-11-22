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
    const id = setInterval(tick, 15000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);
  if (!s?.habilitado || s.error || s.total === undefined) return null;
  return (
    <span className="rounded-full px-2 py-1 border border-amber-400/40 text-amber-200" title="Eventos de hoy registrados en Supabase">
      🚆 {s.personas} personas · {s.gps} nodos GPS · {s.alertas} alertas
    </span>
  );
}
