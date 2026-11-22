"use client";

import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { COMUNIDADES, PARADAS_TREN } from "@/lib/comunidades";
import type { Fix } from "./PanelGps";
import type { RadarSnapshot } from "./RadarOrbital";

type Props = {
  seleccion: string;
  onSeleccion: (id: string) => void;
  fix: Fix | null;
  radar: RadarSnapshot | null;
};

const TRAZA_TREN: [number, number][] = PARADAS_TREN.map((p) => [p.lat, p.lon]);

export default function Mapa({ seleccion, onSeleccion, fix, radar }: Props) {
  return (
    <MapContainer center={[-23.1, -65.6]} zoom={8} className="h-full w-full z-0" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Corredor del Tren Solar: Volcán -> Tumbaya -> Purmamarca -> Maimará -> Tilcara */}
      <Polyline positions={TRAZA_TREN} pathOptions={{ color: "#fbbf24", weight: 3, dashArray: "6 6", opacity: 0.85 }} />

      {/* Próxima pasada orbital de SAOCOM si cae en la región */}
      {radar?.proxima?.traza.length ? (
        <Polyline positions={radar.proxima.traza} pathOptions={{ color: "#38bdf8", weight: 2, opacity: 0.7 }} />
      ) : null}

      {/* Posición en vivo de SAOCOM 1A/1B */}
      {radar?.estados.map((s) => (
        <CircleMarker
          key={s.norad}
          center={[s.lat, s.lon]}
          radius={6}
          pathOptions={{ color: "#38bdf8", fillColor: "#0284c7", fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip direction="top">
            🛰️ {s.nombre} ({s.altKm.toFixed(0)} km alt)
          </Tooltip>
        </CircleMarker>
      ))}

      {/* GPS del celular a bordo */}
      {fix && (
        <CircleMarker
          center={[fix.lat, fix.lon]}
          radius={7}
          pathOptions={{ color: "#ffffff", fillColor: "#10b981", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip direction="top" permanent>
            🚆 Tu GPS
          </Tooltip>
        </CircleMarker>
      )}

      {/* 10 Comunidades y paradas */}
      {COMUNIDADES.map((c) => {
        const activa = c.id === seleccion;
        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lon]}
            radius={activa ? 10 : c.paradaTren ? 7 : 6}
            pathOptions={{
              color: activa ? "#ffffff" : c.paradaTren ? "#fbbf24" : "#34d399",
              fillColor: activa ? "#f59e0b" : c.paradaTren ? "#f59e0b" : "#059669",
              fillOpacity: 0.9,
              weight: activa ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onSeleccion(c.id) }}
          >
            <Tooltip direction="top">
              {c.paradaTren ? "🚆 " : ""}
              {c.nombre} ({c.region})
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
