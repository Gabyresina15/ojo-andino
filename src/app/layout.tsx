import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ojo Andino · Telemetría SAOCOM y alertas satelitales para Jujuy",
  description:
    "Telemetría orbital en vivo (SAOCOM 1A/1B), GPS en el Tren Solar y datos reales de NASA POWER y MODIS MOD13Q1 traducidos por Grok.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link rel="stylesheet" href="/leaflet.css" />
      </head>
      <body className="min-h-full bg-[#05070d] text-slate-100 font-sans">{children}</body>
    </html>
  );
}
