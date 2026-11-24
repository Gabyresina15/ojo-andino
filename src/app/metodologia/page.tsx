import backtest from "@/data/backtest.json";
import type { Metadata } from "next";
import Link from "next/link";
import { COMUNIDADES } from "@/lib/comunidades";
import { PISO_NORMAL_30D_MM, UMBRAL_30D_PCT, UMBRAL_TEMPORADA_PCT } from "@/lib/lecturas";

export const metadata: Metadata = {
  title: "Ojo Andino · Metodología y límites del indicador",
  description: "Qué fuentes usa Ojo Andino, cómo decide el estado hídrico de cada localidad, qué no mide y cómo le fue en la prueba retrospectiva de 2026.",
};

const FUENTES = [
  {
    nombre: "NASA POWER",
    uso: "Lluvia diaria (PRECTOTCORR) y temperatura (T2M). Normal: climatología 2001–2025 de la misma fuente.",
    limite:
      "Es una grilla global de alrededor de 50 km de lado, no una estación en el lugar. Localidades vecinas pueden caer en la misma celda y mostrar la misma lluvia. Los datos llegan con 2 a 3 días de demora.",
  },
  {
    nombre: "MODIS MOD13Q1 (ORNL DAAC)",
    uso: "Índice de vegetación NDVI, píxel de 250 m sobre la coordenada de la localidad.",
    limite:
      "Es un compuesto de 16 días: no cambia de un día para otro. Se muestra como contexto y no interviene en el estado hídrico.",
  },
  {
    nombre: "CHIRPS (Climate Hazards Center, UCSB)",
    uso: "Segunda fuente de lluvia, grilla de unos 5 km. Se usa solo para cruzar el acumulado de la última temporada de lluvias cerrada.",
    limite:
      "No decide el estado: si no coincide con NASA POWER, se avisa que hay que verificar en campo. Llega con semanas de demora, así que no cubre los últimos 30 días ni la temporada en curso. También es una estimación satelital, no una estación.",
  },
  {
    nombre: "MET Norway (api.met.no)",
    uso: "Pronóstico de lluvia para los próximos 7 días. Se muestra aparte, rotulado como pronóstico. Licencia CC BY 4.0.",
    limite:
      "No interviene en el estado hídrico ni en la recomendación. Es un modelo global, no una estación del lugar, y no está verificado contra lluvia medida en la Puna. No sirve como alerta de crecidas o tormentas.",
  },
  {
    nombre: "MODIS MOD14A2 (NASA), Sentinel-1 (ESA/Copernicus) y humedad de suelo de NASA POWER",
    uso: "Contexto que se muestra aparte en cada localidad: focos de calor en píxeles de 1 km, fechas de las últimas imágenes de radar tomadas sobre el lugar, y humedad de suelo.",
    limite:
      "Nada de esto interviene en el estado hídrico ni en la recomendación. Los focos chicos o bajo nubes pueden no detectarse. De Sentinel-1 solo se informa que la imagen existe: Ojo Andino no la procesa. La humedad de suelo la calcula un modelo (GEOS) sobre una grilla regional: no es una medición.",
  },
  {
    nombre: "Grok (xAI)",
    uso: "Redacta el texto de la alerta a partir de las cifras anteriores.",
    limite:
      "No decide el estado ni aporta datos. Cada cifra del texto se compara con su dato de origen; si alguna no coincide, se publica el texto fijo generado sin IA.",
  },
];

const fmt1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Generado por scripts/backtest.ts (npm run backtest): ninguna cifra de la prueba se escribe a mano.
const BT = backtest.filas;
const ESTADO: Record<string, string> = { deficit: "déficit", normal: "normal", superavit_reciente: "superávit", sin_dato: "sin dato" };
const pct = (n: number | null) => (n === null ? "sin dato" : `${n > 0 ? "+" : ""}${fmt1(n)} %`);
const lista = (v: string[]) => (v.length > 1 ? `${v.slice(0, -1).join(", ")} y ${v[v.length - 1]}` : (v[0] ?? "ninguna"));
const fechaAr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const NO_MIDE = [
  "No mide el agua de un campo, una aguada o una vega en particular.",
  "No usa imágenes de radar SAOCOM ni datos de estaciones meteorológicas locales. La segunda fuente (CHIRPS) también es satelital, y el panel de pasadas solo calcula cuándo pasan los satélites.",
  "No sirve para emergencias de horas (crecidas, tormentas): los datos tienen 2 a 3 días de demora.",
  "El estado no pronostica: describe lo que ya llovió frente a lo normal. El pronóstico de 7 días se muestra aparte y no lo modifica.",
  "No reemplaza la verificación en el territorio ni la decisión del organismo competente.",
];


function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="amc-surface rounded-3xl p-5 sm:p-6 space-y-3">
      <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#F4F1EA]">{titulo}</h2>
      <div className="space-y-3 text-sm text-[#9CA3AF] leading-relaxed">{children}</div>
    </section>
  );
}

export default function MetodologiaPage() {
  const anterior = BT.filter((b) => b.estadoRegla30d === "deficit");
  const actual = BT.filter((b) => b.estadoReglaActual === "deficit");
  const sinExplicar = BT.filter((b) => b.estadoReglaActual !== "deficit");
  const nums = (v: (number | null)[]) => v.filter((x): x is number => x !== null);
  const chirpsPcts = nums(BT.map((b) => b.chirpsPct));
  const chirpsDef = chirpsPcts.filter((x) => x <= UMBRAL_TEMPORADA_PCT);
  const antNasa = nums(BT.map((b) => b.temporadaAnterior.nasaPct));
  const antChirps = nums(BT.map((b) => b.temporadaAnterior.chirpsPct));
  const corr = nums(BT.map((b) => b.correlacionTemporadas));
  const fmt2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="min-h-screen amc-grid-bg text-[#F4F1EA]">
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-5">
        <div className="space-y-2">
          <Link href="/" className="text-xs text-[#F59E0B] underline">
            ← Volver al tablero
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">Metodología y límites del indicador</h1>
          <p className="text-sm text-[#9CA3AF] leading-relaxed">
            Ojo Andino es un prototipo. No es un sistema oficial ni está homologado por ningún organismo. Esta página dice
            qué mide, cómo decide y dónde falla, para que un equipo técnico lo pueda revisar.
          </p>
        </div>

        <Seccion titulo="1. Fuentes de datos">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-[#F4F1EA]">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3">Fuente</th>
                  <th className="py-2 pr-3">Para qué se usa</th>
                  <th className="py-2">Límite</th>
                </tr>
              </thead>
              <tbody>
                {FUENTES.map((f) => (
                  <tr key={f.nombre} className="border-b border-white/5 align-top">
                    <td className="py-2 pr-3 font-bold text-[#F4F1EA] whitespace-nowrap">{f.nombre}</td>
                    <td className="py-2 pr-3">{f.uso}</td>
                    <td className="py-2">{f.limite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Cobertura actual: {COMUNIDADES.length} localidades fijas de la Puna y la Quebrada ({COMUNIDADES.map((c) => c.nombre).join(", ")}).
            Cada lectura muestra la fecha del último dato disponible.
          </p>
        </Seccion>

        <Seccion titulo="2. Cómo se decide el estado de cada localidad">
          <p>El estado lo calcula una regla fija, no la IA. Compara la lluvia observada con la normal 2001–2025 del mismo período:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-[#F4F1EA]">Época de lluvias</strong> (la normal de 30 días es de {PISO_NORMAL_30D_MM} mm o más): déficit
              si los últimos 30 días quedaron {UMBRAL_30D_PCT} % o más por debajo de lo normal; superávit reciente si quedaron{" "}
              {UMBRAL_30D_PCT} % o más por encima.
            </li>
            <li>
              <strong className="text-[#F4F1EA]">Época seca</strong> (la normal de 30 días es menor a {PISO_NORMAL_30D_MM} mm): el porcentaje
              de 30 días no se usa, porque con una normal de 2 a 6 mm unos pocos milímetros dan desvíos de más de 100 %. Decide el
              acumulado de la última temporada de lluvias (1/12 al 30/4): déficit si quedó {Math.abs(UMBRAL_TEMPORADA_PCT)} % o más por
              debajo de lo normal.
            </li>
            <li>
              <strong className="text-[#F4F1EA]">Época seca sin dato de temporada válido:</strong> queda en normal, que acá significa
              &quot;sin evidencia de déficit&quot;, no &quot;todo bien&quot;.
            </li>
          </ul>
          <p>
            Los dos umbrales ({UMBRAL_30D_PCT} % y {Math.abs(UMBRAL_TEMPORADA_PCT)} %) son provisorios. No están calibrados contra registros
            de emergencias ni de asistencia.
          </p>
        </Seccion>

        <Seccion titulo={`3. Prueba retrospectiva: ${fechaAr(backtest.evento.fecha)}`}>
          <p>
            Se reconstruyó qué habría dicho el sistema el {fechaAr(backtest.evento.fecha)}. Evento de referencia:{" "}
            {backtest.evento.descripcion.toLowerCase()}. Se evalúa la cabecera de cada departamento, con la serie
            completa hasta ese día; en la fecha real el último dato disponible habría sido de 2 a 3 días antes.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-[#F4F1EA]">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3">Localidad</th>
                  <th className="py-2 pr-3">Lluvia 30 días vs normal</th>
                  <th className="py-2 pr-3">Regla anterior (solo 30 días)</th>
                  <th className="py-2 pr-3">Temporada vs normal</th>
                  <th className="py-2 pr-3">Regla actual</th>
                  <th className="py-2">Temporada según CHIRPS</th>
                </tr>
              </thead>
              <tbody>
                {BT.map((b) => (
                  <tr key={b.codBahra} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-bold text-[#F4F1EA] whitespace-nowrap">{b.lugar}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {fmt1(b.lluvia30d.observado)} vs {fmt1(b.lluvia30d.normal)} mm ({pct(b.lluvia30d.porcentaje)})
                    </td>
                    <td className="py-2 pr-3">{ESTADO[b.estadoRegla30d]}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{pct(b.temporadaNasaPct)}</td>
                    <td className="py-2 pr-3 text-[#F4F1EA]">{ESTADO[b.estadoReglaActual]}</td>
                    <td className="py-2 whitespace-nowrap">
                      {pct(b.chirpsPct)}
                      {b.chirpsPct !== null && ` (${b.chirpsPct <= UMBRAL_TEMPORADA_PCT ? "déficit" : "normal"})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              La regla anterior marcó déficit en {anterior.length} de {BT.length} casos. La regla actual marca déficit en{" "}
              {actual.length} de {BT.length} ({lista(actual.map((b) => b.lugar))}), pero se agregó después de ver este resultado, así
              que la prueba no es independiente.
            </li>
            {sinExplicar.length > 0 && (
              <li>
                {lista(sinExplicar.map((b) => b.lugar))}: hubo asistencia y NASA POWER no marca déficit de temporada. La fuente no
                explica ese caso.
              </li>
            )}
            {actual.length > 0 && (
              <li>
                Los déficits de temporada van de {pct(Math.max(...actual.map((b) => b.temporadaNasaPct ?? 0)))} a{" "}
                {pct(Math.min(...actual.map((b) => b.temporadaNasaPct ?? 0)))}, con el umbral en {UMBRAL_TEMPORADA_PCT} %. Con un umbral
                5 puntos más exigente quedarían {actual.filter((b) => (b.temporadaNasaPct ?? 0) <= UMBRAL_TEMPORADA_PCT - 5).length} de{" "}
                {actual.length}.
              </li>
            )}
            <li>
              <strong className="text-[#F4F1EA]">
                La segunda fuente marca déficit en {chirpsDef.length} de {BT.length} localidades.
              </strong>{" "}
              CHIRPS (grilla de unos 5 km) da entre {pct(Math.min(...chirpsPcts))} y {pct(Math.max(...chirpsPcts))}. Para la temporada
              anterior NASA POWER da entre {pct(Math.min(...antNasa))} y {pct(Math.max(...antNasa))}, y CHIRPS entre{" "}
              {pct(Math.min(...antChirps))} y {pct(Math.max(...antChirps))}.
            </li>
            <li>
              Entre 2001 y {backtest.evento.fecha.slice(0, 4)} los totales de temporada de NASA POWER y CHIRPS se parecen poco en estas
              localidades (correlación de {fmt2(Math.min(...corr))} a {fmt2(Math.max(...corr))}). Sin estaciones en tierra no se puede
              decir cuál de las dos acierta.
            </li>
            <li>Es un solo evento. No alcanza para estimar aciertos ni falsas alarmas.</li>
            <li>
              Tabla generada el {fechaAr(backtest.generadoEn)} con <code>npm run backtest</code>. Coordenadas: {backtest.fuentes.coordenadas}.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="4. Qué no mide">
          <ul className="list-disc pl-5 space-y-1.5">
            {NO_MIDE.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="5. Registro y verificación">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Un barrido diario (08:00 de Jujuy) calcula el estado de las {COMUNIDADES.length} localidades y guarda una fila por localidad y por día. El primer registro del día no se sobrescribe.</li>
            <li>
              El registro se puede bajar en CSV: <code className="text-[#F4F1EA]">/api/historial?id=susques&amp;dias=90&amp;formato=csv</code>.
            </li>
            <li>Si una fuente no responde, se usa la última copia guardada y la lectura lo indica.</li>
            <li>El envío automático por WhatsApp no está activo.</li>
          </ul>
        </Seccion>
      </main>
    </div>
  );
}
