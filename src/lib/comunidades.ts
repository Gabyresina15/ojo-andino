import type { Comunidad, EventoCalendario } from "./types";

const AVISO = "Ficha de contexto con fuentes públicas; no habla en nombre de ninguna comunidad.";

const PACHAMAMA: EventoCalendario = {
  nombre: "Pachamama",
  cuando: "1 de agosto",
  nota: "Fecha central del culto a la Pachamama en Jujuy; la agenda oficial lista ceremonias en toda la provincia.",
  fuente: "https://culturayturismo.jujuy.gob.ar/2025/07/31/agenda-cultural-de-la-provincia-del-31-de-julio-al-6-de-agosto/",
};

const SENALADA: EventoCalendario = {
  nombre: "Señalada",
  cuando: "Carnaval / febrero",
  nota: "Marcado de las crías del año anterior. No es un rito de agosto: no se mezcla con la Pachamama.",
  fuente: "https://www.todojujuy.com/jujuy/se-realizo-la-senalada-la-puna-n229684",
};

const UNESCO: EventoCalendario = {
  nombre: "Quebrada de Humahuaca — Patrimonio Mundial",
  cuando: "Inscripta en 2003",
  nota: "UNESCO, criterios ii, iv y v (sitio 1116).",
  fuente: "https://whc.unesco.org/en/list/1116/",
};

const FORRAJE_2026 =
  "En septiembre de 2026 la Provincia entregó alfalfa a municipios y comisiones de los cinco departamentos puneños por sequía y falta de pasturas.";

export const COMUNIDADES: Comunidad[] = [
  {
    id: "abra-pampa",
    nombre: "Abra Pampa",
    lat: -22.72273,
    lon: -65.69693,
    region: "puna",
    paradaTren: false,
    fuenteCoords: "https://www.geonames.org/3867009/abra-pampa.html",
    ficha: {
      resumen: `Cabecera de Cochinoca, en la Puna. ${FORRAJE_2026} Hacienda informó que el acopio en Abra Pampa superaba el 60 % del volumen previsto (17/09/2026). El 27/10/2026 productores describían campos secos y pedían emergencia hídrica.`,
      calendario: [SENALADA, PACHAMAMA],
      aviso: AVISO,
    },
  },
  {
    id: "susques",
    nombre: "Susques",
    lat: -23.39858,
    lon: -66.36753,
    region: "puna",
    paradaTren: false,
    fuenteCoords: "https://www.geonames.org/3834893/susques.html",
    ficha: {
      resumen: `Puna occidental. ${FORRAJE_2026} Hay reclamos previos de comunidades por desabastecimiento de agua (2024).`,
      calendario: [SENALADA, PACHAMAMA],
      aviso: AVISO,
    },
  },
  {
    id: "la-quiaca",
    nombre: "La Quiaca",
    lat: -22.10448,
    lon: -65.59646,
    region: "puna",
    paradaTren: false,
    fuenteCoords: "https://www.geonames.org/3849140/la-quiaca.html",
    ficha: {
      resumen: `Ciudad de frontera en el departamento Yavi. ${FORRAJE_2026}`,
      calendario: [SENALADA, PACHAMAMA],
      aviso: AVISO,
    },
  },
  {
    id: "yavi",
    nombre: "Yavi",
    lat: -22.13098,
    lon: -65.46292,
    region: "puna",
    paradaTren: false,
    fuenteCoords: "https://es.wikipedia.org/wiki/Yavi",
    ficha: {
      resumen: "Puna norte. La agenda oficial 2025 listó ceremonia de Pachamama a las 12:00 en Ojo de Agua de la Comunidad de Yavi.",
      calendario: [PACHAMAMA, SENALADA],
      aviso: AVISO,
    },
  },
  {
    id: "humahuaca",
    nombre: "Humahuaca",
    lat: -23.20612,
    lon: -65.34742,
    region: "quebrada",
    paradaTren: false,
    fuenteCoords: "https://www.geonames.org/3853967/humahuaca.html",
    ficha: {
      resumen: "Ciudad que da nombre a la Quebrada, Patrimonio Mundial de la UNESCO desde 2003.",
      calendario: [UNESCO, PACHAMAMA],
      aviso: AVISO,
    },
  },
  {
    id: "tilcara",
    nombre: "Tilcara",
    lat: -23.57817,
    lon: -65.39516,
    region: "quebrada",
    paradaTren: true,
    fuenteCoords: "https://www.geonames.org/3834403/tilcara.html",
    ficha: {
      resumen: "Parada final del recorrido del Tren Solar. Quebrada de Humahuaca, Patrimonio Mundial UNESCO (2003).",
      calendario: [UNESCO, PACHAMAMA],
      aviso: AVISO,
    },
  },
  {
    id: "maimara",
    nombre: "Maimará",
    lat: -23.623,
    lon: -65.408,
    region: "quebrada",
    paradaTren: true,
    fuenteCoords: "https://virtual.unju.edu.ar/pluginfile.php/1045749/mod_resource/content/1/localidades_quebrada.csv",
    ficha: {
      resumen: "Parada del Tren Solar en la Quebrada (coordenadas de menor precisión, CSV UNJu).",
      calendario: [UNESCO, PACHAMAMA],
      aviso: AVISO,
    },
  },
  {
    id: "purmamarca",
    nombre: "Purmamarca",
    lat: -23.74595,
    lon: -65.49976,
    region: "quebrada",
    paradaTren: true,
    fuenteCoords: "https://www.geonames.org/3839841/purmamarca.html",
    ficha: {
      resumen: "Parada del Tren Solar y punto de recarga de baterías. Quebrada de Humahuaca, Patrimonio Mundial UNESCO (2003).",
      calendario: [UNESCO, PACHAMAMA],
      aviso: AVISO,
    },
  },
  {
    id: "tumbaya",
    nombre: "Tumbaya",
    lat: -23.85755,
    lon: -65.46702,
    region: "quebrada",
    paradaTren: true,
    fuenteCoords: "https://es.wikipedia.org/wiki/Tumbaya",
    ficha: {
      resumen: "Parada del Tren Solar. Fiestas: Virgen de la Candelaria (2 de febrero), Nuestra Señora de los Dolores (15 de septiembre) y peregrinación a Punta Corral el Domingo de Ramos (fuente: Wikipedia).",
      calendario: [
        PACHAMAMA,
        {
          nombre: "Virgen de la Candelaria",
          cuando: "2 de febrero",
          nota: "Fiesta patronal citada en la ficha de Tumbaya.",
          fuente: "https://es.wikipedia.org/wiki/Tumbaya",
        },
      ],
      aviso: AVISO,
    },
  },
  {
    id: "volcan",
    nombre: "Volcán",
    lat: -23.91715,
    lon: -65.46433,
    region: "quebrada",
    paradaTren: true,
    fuenteCoords: "https://www.geonames.org/3832456/volcan.html",
    ficha: {
      resumen: "Estación de partida del Tren Solar de la Quebrada y punto de recarga de baterías.",
      calendario: [UNESCO, PACHAMAMA],
      aviso: AVISO,
    },
  },
];

export const PARADAS_TREN = ["volcan", "tumbaya", "purmamarca", "maimara", "tilcara"]
  .map((id) => COMUNIDADES.find((c) => c.id === id)!)
  .filter(Boolean);

const COMISIONES_MUNICIPALES = new Set(["susques", "yavi", "maimara", "purmamarca", "tumbaya", "volcan"]);

/** Gobierno local de la localidad, sin áreas internas: no hay un destinatario institucional acordado. */
export function jurisdiccionDe(c: Comunidad): string {
  return `${COMISIONES_MUNICIPALES.has(c.id) ? "Comisión Municipal" : "Municipalidad"} de ${c.nombre}`;
}

export function getComunidad(id: string | null | undefined): Comunidad | undefined {
  return COMUNIDADES.find((c) => c.id === id);
}

/** Centro aproximado para cálculos orbitales (entre Quebrada y Puna). */
export const CENTRO_JUJUY = { lat: -23.2, lon: -65.5, altKm: 3.0 };

export function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
