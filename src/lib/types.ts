export type Region = "puna" | "quebrada";

export type EventoCalendario = {
  nombre: string;
  cuando: string;
  nota: string;
  fuente: string;
};

export type FichaCultural = {
  resumen: string;
  calendario: EventoCalendario[];
  aviso: string;
};

export type Comunidad = {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  region: Region;
  paradaTren: boolean;
  fuenteCoords: string;
  ficha: FichaCultural;
};

export type SerieDiaria = { fecha: string; valor: number | null };

export type Anomalia = {
  observado: number;
  climatologia: number;
  unidad: string;
  porcentaje: number | null;
  ventana: string;
  diasConDato: number;
};

export type CompositeNdvi = { fecha: string; modisDate: string; ndvi: number };

export type LecturaSatelital = {
  comunidadId: string;
  generadoEn: string;
  fuenteCache: boolean;
  meteorologia: {
    fuente: "NASA POWER";
    ultimoDiaConDato: string;
    demoraDeclarada: string;
    climatologiaPeriodo: string;
    precipitacionMm30d: Anomalia;
    temperaturaC7d: {
      mediaObservada: number;
      climatologiaMes: number;
      mesClimatologico: string;
      ventana: string;
    };
    serie: { fecha: string; lluviaMm: number | null; climaMm: number | null; t2m: number | null }[];
  } | null;
  ndvi: {
    fuente: "MODIS MOD13Q1 vía ORNL TESViS";
    ultimoComposite: CompositeNdvi;
    compositeAnterior: CompositeNdvi | null;
    compositeAnioAnterior: CompositeNdvi | null;
    aviso: string;
  } | null;
  errores: string[];
};

export type EstadoHidrico = "deficit" | "normal" | "superavit_reciente" | "sin_dato";

export type AlertaRespuesta = {
  comunidadId: string;
  modo: "comunidad" | "parametrico";
  resumen_oral: string;
  estado_hidrico: EstadoHidrico;
  nota_parametrica: string;
  fuentes: string;
  origen: "grok" | "determinista";
  modelo: string | null;
  validacion: {
    numerosEncontrados: number;
    numerosVerificados: number;
    noVerificados: string[];
    estadoCorregido: boolean;
    motivoFallback: string | null;
  };
  generadoEn: string;
};
