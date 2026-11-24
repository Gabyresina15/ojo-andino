import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ojo Andino · Tablero hídrico para municipios de la Puna y la Quebrada de Jujuy",
  description:
    "Lluvia y vegetación por localidad a partir de datos públicos de NASA POWER y MODIS MOD13Q1, con alerta redactada y verificada cifra por cifra.",
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
