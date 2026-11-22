"use client";

type Tipo = "vista" | "alerta" | "whatsapp" | "gps" | "audio";
const COLA = "oa:cola-eventos";

export function sesion(): string {
  let s = localStorage.getItem("oa:sesion");
  if (!s) {
    s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("oa:sesion", s);
  }
  return s;
}

async function enviar(ev: { tipo: Tipo; comunidad_id?: string; sesion: string }) {
  const r = await fetch("/api/traccion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ev),
    keepalive: true,
  });
  if (!r.ok) throw new Error(String(r.status));
}

/** Fire-and-forget. Si no hay red, encola en localStorage y reintenta al volver. */
export function registrarEvento(tipo: Tipo, comunidad_id?: string) {
  if (typeof window === "undefined") return;
  const ev = { tipo, comunidad_id, sesion: sesion() };
  enviar(ev).catch(() => {
    const cola = JSON.parse(localStorage.getItem(COLA) || "[]");
    cola.push(ev);
    localStorage.setItem(COLA, JSON.stringify(cola.slice(-200)));
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    const cola = JSON.parse(localStorage.getItem(COLA) || "[]");
    localStorage.setItem(COLA, "[]");
    for (const ev of cola) await enviar(ev).catch(() => {});
  });
}
