"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  seleccion: string;
  nombre: string;
  onClose: () => void;
};

async function copiar(texto: string, respaldo: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    if (!respaldo) return false;
    respaldo.select();
    return document.execCommand("copy");
  }
}

export default function QrModal({ seleccion, nombre, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"ok" | "error" | null>(null);
  const destino = window.location.href;
  const linkLocalidad = `${window.location.origin}/?c=${seleccion}`;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    QRCode.toString(destino, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [destino]);

  const alCopiar = async () => {
    setCopiado((await copiar(linkLocalidad, inputRef.current)) ? "ok" : "error");
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      aria-labelledby="qr-titulo"
      className="m-auto w-[min(92vw,360px)] rounded-2xl border border-white/15 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="qr-titulo" className="text-base font-bold text-white">
              Escaneá para abrir Ojo Andino
            </h2>
            <p className="text-[11px] text-slate-400">Código generado en tu dispositivo · funciona sin conexión</p>
          </div>
          <button
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar"
            className="rounded-lg border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="mx-auto aspect-square w-full max-w-[260px] rounded-xl bg-white p-2">
          {svg ? (
            <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="grid h-full place-items-center text-xs text-slate-500">Generando QR…</div>
          )}
        </div>

        <p className="break-all text-center font-mono text-[10px] text-slate-500">{destino}</p>

        <div className="space-y-1.5">
          <label htmlFor="qr-link" className="text-[11px] text-slate-400">
            Link directo a {nombre}
          </label>
          <input
            id="qr-link"
            ref={inputRef}
            readOnly
            value={linkLocalidad}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-slate-200"
          />
          <button
            onClick={alCopiar}
            className="w-full rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-amber-300"
          >
            {copiado === "ok" ? "✓ Link copiado" : "Copiar link de esta localidad"}
          </button>
          {copiado === "error" && (
            <p className="text-[11px] text-amber-200">No se pudo copiar automáticamente: seleccioná el link y copialo a mano.</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
