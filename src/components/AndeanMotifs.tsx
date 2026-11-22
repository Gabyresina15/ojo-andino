"use client";

/**
 * Micro-elementos gráficos SVG de "Andean Mission Control":
 * Chakana geométrica + Guarda escalonada andina / retícula aeroespacial.
 */
export function ChakanaIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 2h6v3h3v3h3v6h-3v3h-3v3H9v-3H6v-3H3V8h3V5h3V2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function GuardaAndinaDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D95D39]/50 to-[#F59E0B]/50" />
      <svg viewBox="0 0 120 12" className="h-3 w-28 text-[#D95D39]/80 shrink-0" fill="none">
        <path
          d="M0 6h12V2h8v8h8V2h8v8h8V6h8V2h8v8h8V2h8v8h8V2h8v4h28"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <rect x="57" y="3" width="6" height="6" fill="#F59E0B" />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#D95D39]/50 to-[#F59E0B]/50" />
    </div>
  );
}
