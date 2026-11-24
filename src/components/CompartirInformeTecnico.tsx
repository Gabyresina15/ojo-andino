"use client";

import { useSyncExternalStore } from "react";
import type { Comunidad, LecturaSatelital } from "@/lib/types";
import { urlWhatsAppInformeTecnico } from "@/lib/whatsapp-informe-tecnico";

const sinSuscripcion = () => () => {};

export default function CompartirInformeTecnico({ comunidad, lectura }: { comunidad: Comunidad; lectura: LecturaSatelital | null }) {
  const origen = useSyncExternalStore(sinSuscripcion, () => window.location.origin, () => null);
  if (!origen || !lectura || lectura.comunidadId !== comunidad.id) return null;

  return (
    <a
      href={urlWhatsAppInformeTecnico(comunidad, lectura, origen)}
      target="_blank"
      rel="noopener noreferrer"
      className="min-h-[48px] inline-flex items-center justify-center rounded-xl border border-[#10B981]/50 bg-[#10B981]/15 hover:bg-[#10B981]/25 px-4 py-2 text-center text-xs font-bold text-[#F4F1EA] transition"
    >
      Compartir informe técnico por WhatsApp
    </a>
  );
}
