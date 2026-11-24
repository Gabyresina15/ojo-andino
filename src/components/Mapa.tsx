"use client";

import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { COMUNIDADES } from "@/lib/comunidades";
import { lecturaCacheada } from "@/lib/cache";
import { anomaliaDelEstado, estadoHidrico } from "@/lib/lecturas";
import type { LecturaSatelital } from "@/lib/types";

type Props = {
  seleccion: string;
  onSeleccion: (id: string) => void;
  /** Lecturas en vivo por localidad; la que falte usa el cache del deploy. */
  lecturas?: Record<string, LecturaSatelital>;
};

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function Mapa({ seleccion, onSeleccion, lecturas }: Props) {
  return (
    <MapContainer center={[-23.1, -65.6]} zoom={8} className="h-full w-full z-0" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 10 Jurisdicciones Municipales coloreadas por su Semáforo Hídrico Real */}
      {COMUNIDADES.map((c) => {
        const activa = c.id === seleccion;
        const l = lecturas?.[c.id] ?? lecturaCacheada(c.id);
        const est = l ? estadoHidrico(l) : "normal";
        const pct = (l && anomaliaDelEstado(l)?.porcentaje) ?? l?.meteorologia?.precipitacionMm30d.porcentaje ?? 0;

        const paleta =
          est === "deficit"
            ? { fill: "#D95D39", stroke: "#FCA5A5", label: "Déficit · Priorizar forraje" }
            : est === "superavit_reciente" && c.region === "quebrada"
              ? { fill: "#2DD4BF", stroke: "#99F6E4", label: "Lluvias altas · Vigilar drenajes" }
              : est === "superavit_reciente"
                ? { fill: "#10B981", stroke: "#6EE7B7", label: "En recuperación hídrica" }
                : { fill: "#F59E0B", stroke: "#FDE68A", label: "Rango normal" };

        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lon]}
            radius={activa ? 11 : est === "deficit" ? 9 : 7}
            pathOptions={{
              color: activa ? "#F4F1EA" : paleta.stroke,
              fillColor: paleta.fill,
              fillOpacity: 0.95,
              weight: activa ? 3 : est === "deficit" ? 2.5 : 1.5,
            }}
            eventHandlers={{ click: () => onSeleccion(c.id) }}
          >
            <Tooltip direction="top">
              <strong>{c.nombre}</strong> ({ pct >= 0 ? "+" : ""}{fmt1(pct)}%) · {paleta.label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
