# Ojo Andino — Documentación Completa del Proyecto

> **Contexto para el agente de IA que lea este archivo:**  
> Este documento explica de punta a punta el proyecto **Ojo Andino** para la **Cursor Hackathon Jujuy** (domingo **22/11/2026**, a bordo del **Tren Solar de la Quebrada**). Si la compañera de equipo te pasa este README, usalo para explicarle con claridad el producto, el modelo de negocio, los datos reales verificados, la arquitectura técnica y qué falta construir/probar antes del **feature freeze a las 16:30 ART** (demos a las **18:00 ART**).

---

## 1. Resumen ejecutivo (qué es y por qué gana)

**Ojo Andino** traduce telemetría orbital y datos satelitales públicos en decisiones simples, en texto, voz y WhatsApp, para la Puna y la Quebrada de Jujuy.

Frente a la idea original (un mapa con promedios históricos de NASA POWER + MODIS y un chat con Grok), **pivoteamos quirúrgicamente** manteniendo las APIs ya verificadas pero corrigiendo los 4 puntos débiles que hubiera castigado el jurado:

1. **Telemetría espacial en vivo de verdad (no solo datos diferidos):**  
   Propagamos las órbitas de los satélites argentinos **SAOCOM 1A** (NORAD `43641`) y **SAOCOM 1B** (NORAD `46265`) cada **1 segundo** en el navegador usando `satellite.js` (SGP4) a partir de los TLEs de CelesTrak. Mostramos latitud, longitud, altitud, distancia a Jujuy y cuenta regresiva de la próxima pasada sobre la provincia.  
   *Honestidad técnica:* SAOCOM opera un radar SAR en Banda L (CONAE) capaz de ver a través de nubes y estimar humedad del suelo, pero **no mostramos imagen radar SAR cruda**; mostramos su telemetría orbital real en vivo.
2. **El Tren Solar entra en la arquitectura:**  
   Con consentimiento explícito del usuario, la app lee el GPS del navegador (`navigator.geolocation.watchPosition`) para mostrar posición, altitud (msnm) y velocidad (km/h) sobre la traza Volcán–Tilcara, y calcula las pasadas orbitales respecto a esa ubicación móvil.
3. **IA con validación determinista (Grok + Zod + verificador numérico):**  
   Grok (`grok-4.7`) no genera texto libre sin control: responde un JSON estricto validado con **Zod** (`resumen_oral`, `estado_hidrico`, `nota_parametrica`, `fuentes`), y un verificador numérico revisa cada cifra del texto contra el JSON fuente. Si Grok inventa un número, cambia el estado hídrico o falla la API, el sistema cae a un redactor determinista local.
4. **Un vertical B2B claro que ya tiene mercado en Argentina:**  
   En lugar de depender solo de licitaciones B2G lentas, incorporamos un toggle de vista entre **Comunidad · gratis** y **Cooperativa / Seguro paramétrico · B2B**.

---

## 2. El problema real y los datos verificados hoy (22/11/2026)

### 2.1 Contexto territorial (con fuentes)
- **Sequía previa y operativo estatal (septiembre 2026):** El 23/09/2026 la Provincia entregó alfalfa a municipios y comisiones de los cinco departamentos puneños (Santa Catalina, Yavi, Cochinoca, Rinconada, Susques) más El Moreno (Tumbaya) para mitigar sequía y escasez de pasturas ([Prensa Jujuy](https://prensa.jujuy.gob.ar/provincia/la-provincia-asiste-forraje-productores-la-puna-afectados-la-sequia-n125352)). Hacienda había informado >60 % de acopio en Abra Pampa ([Hacienda Jujuy](https://hacienda.jujuy.gob.ar/asistencia-para-productores-de-la-puna/)). *No se publicó costo total ni cantidad exacta de fardos: no inventarlos.*
- **Octubre 2026:** Productores de Abra Pampa describían campos secos, traslado de hacienda, arriendo de potreros y pedido de emergencia hídrica ([TodoJujuy, 27/10/2026](https://www.todojujuy.com/jujuy/el-nino-jujuy-sequia-la-puna-y-preocupacion-posibles-lluvias-intensas-los-valles-n297969)).
- **Antecedente social:** Reclamos de comunidades de Susques por falta de agua ([Jujuy al Momento, 2024](https://www.jujuyalmomento.com/comunidades/grave-denuncia-comunidades-en-susques-no-hay-agua-n178474)).

### 2.2 Qué muestran las APIs hoy en Abra Pampa (`lat -22.72273, lon -65.69693`)
Consultado el **22/11/2026 a la mañana (ART)**:
- **Último día con dato NASA POWER:** `2026-11-19` (los días 20, 21 y 22 vienen con `fill_value: -999.0`; la demora oficial es de 2–3 días).
- **Lluvia últimos 30 días con dato (`21/10–19/11/2026`):** **82,09 mm** observados (`PRECTOTCORR`) vs **42,61 mm** de climatología 2001–2025 (`MERRA2`) para esas mismas fechas → **anomalía +92,7 %**.
- **Temperatura media últimos 7 días con dato (`13–19/11/2026`):** **14,19 °C** vs **11,16 °C** climatología de noviembre (`T2M`).
- **NDVI MODIS `MYD13Q1` (vía ORNL TESViS, escala `0.0001`):**
  - Composite `2026-11-01` (`A2026305`): **0,138** (anterior `2026-10-16`: **0,115**).
  - Mismo período 2025 (`2025-11-01`): **0,134** (`2025-10-16`: **0,117**).

**Lectura honesta clave para el pitch:**  
La Puna viene de meses secos, pero en noviembre empezó a llover por encima del promedio. **Ojo Andino no vende una sequía fija ni miente con el relato**: muestra el cambio de estado en tiempo real. Si el mes siguiente vuelve a secarse, el tablero lo refleja automáticamente.

---

## 3. Capa cultural y ética (reglas estrictas)

- **No hablar en nombre de ninguna comunidad:** Las comunidades no están "onboarded" hoy. El proyecto se presenta como piloto para **co-diseñar** con ellas.
- **Calendario ritual citado y sin mezclas:**
  - **Pachamama:** **1 de agosto** (agenda oficial de Cultura y Turismo de Jujuy).
  - **Señalada de llamas:** **Carnaval / febrero** (marcado de crías). Nunca mezclarla con agosto.
  - **Quebrada de Humahuaca:** Patrimonio Mundial **UNESCO** (2003, sitio 1116).
  - **Tumbaya:** Virgen de la Candelaria (2 de febrero), Nuestra Señora de los Dolores (15 de septiembre), peregrinación a Punta Corral (Domingo de Ramos).
- **Personas ficcionales:** Si se menciona a "Don Mario" como ejemplo de usuario, debe aclararse explícitamente que es ilustrativo.

---

## 4. Modelo de negocio y escalabilidad

El jurado pidió explícitamente **que la gente quiera pagar y que escale**:

1. **Gratis para el territorio (Comunidad / familias pastoras):**  
   Consultar el pueblo, escuchar el audio y reenviar por WhatsApp (`wa.me`) cuesta **$0**. Cobrarle al pastor contradice el eje social del track.
2. **Quién paga (B2B elegido — un foco claro):** **Cooperativas ganaderas y aseguradoras paramétricas**.
   - *Antecedente real en Argentina:* Ya existen seguros paramétricos de sequía por índice satelital para soja y maíz (**Sancor Seguros** + **CONAE / Instituto Gulich** con índice TVDI), y en 2026 la **SSN** y Agricultura actualizaron el régimen de seguros paramétricos (`RESOL-2026-315-APN-SSN#MEC`, pago a 15 días corridos de verificado el índice).
   - *El hueco:* Esas coberturas hoy cubren zona pampeana extensiva, no ganadería puneña. Ojo Andino entrega la serie estandarizada por coordenada `(lat, lon)`, la anomalía respecto al período 2001–2025 y la nota técnica. **Nunca decir que ya tenemos una póliza homologada por la SSN ni inventar tarifas en dólares no validadas.**
   - *Complemento B2G:* Municipios, Provincia (que ya gasta en fletes y forraje de emergencia) e INTA/extensión rural.
3. **Unit economics de inferencia (precios públicos xAI):**
   - Datos NASA POWER, ORNL MODIS y CelesTrak: **$0**.
   - Texto (`grok-4.7`) + Voz (`POST /v1/tts`): del orden de **~USD 0,01 por alerta generada con audio** (cacheando por pueblo y fecha, el costo marginal es mínimo).
4. **Por qué escala:**  
   NASA POWER, MODIS y CelesTrak son globales. El mismo pipeline sirve para **Salta, Catamarca y el Altiplano de Bolivia y Perú** cambiando coordenadas y ficha cultural. *(Escalar geografía es directo; escalar confianza y calibración en campo requiere piloto local).*

---

## 5. Arquitectura técnica (Next.js App Router, Offline-First)

### Stack
- **Framework:** Next.js 16 (App Router, TypeScript, TailwindCSS, `src/`)
- **Mapa:** `leaflet` + `react-leaflet` (cargado con `next/dynamic` y `ssr: false`)
- **Órbitas en tiempo real:** `satellite.js` (SGP4 a 1 Hz en el cliente)
- **Validación:** `zod`
- **APIs externas:**
  - `NASA POWER` (`/api/temporal/daily/point` y `/api/temporal/climatology/point`, `community=AG`, sin API key)
  - `ORNL TESViS` (`/rst/api/v1/MYD13Q1/dates` y `/subset`, sin API key)
  - `CelesTrak` (`/NORAD/elements/gp.php?NAME=SAOCOM&FORMAT=TLE`, sin API key)
  - `xAI` (`/v1/chat/completions` con `grok-4.7` y `/v1/tts` con `voice_id: "eve"`, `language: "es-MX"` — siempre en el servidor para proteger `XAI_API_KEY`)
  - `Supabase REST` (opcional): contador de tracción y, con `SUPABASE_SERVICE_ROLE_KEY`, historial del barrido diario (`/api/historial`)

### Resiliencia ante cortes de Starlink
1. La UI pinta al instante desde `localStorage` o desde el bundle estático `src/data/cache-lecturas.json`.
2. Luego intenta refrescar en vivo contra `/api/lecturas?id=...` (con timeouts de 6s en POWER y 9–10s en ORNL).
3. Si falla CelesTrak, usa `src/data/tle-saocom.json` y `satellite.js` sigue propagando la órbita **100 % sin internet**.
4. Si falla xAI Chat o falta `XAI_API_KEY`, `/api/alerta` cae a `alertaDeterminista()`.
5. Si falla `/api/tts`, el cliente reproduce el texto con `window.speechSynthesis` (voz del navegador).

---

## 6. Estado actual del código en `ojo-andino/`

### Ya implementado y listo
- `package.json` con dependencias instaladas (`next`, `react`, `leaflet`, `react-leaflet`, `satellite.js`, `zod`, `tsx`).
- `src/lib/types.ts` — Contratos TypeScript completos.
- `src/lib/comunidades.ts` — 10 localidades con coordenadas verificadas (5 paradas del Tren Solar: Volcán, Tumbaya, Purmamarca, Maimará, Tilcara + Humahuaca, Abra Pampa, Susques, La Quiaca, Yavi) y fichas culturales citadas.
- `src/lib/lecturas.ts` — Fetcher de NASA POWER + ORNL MODIS + cálculo exacto de anomalías y clasificación determinista `estadoHidrico()`.
- `src/lib/alerta.ts` — Prompt estricto de Grok (`grok-4.7`), schema Zod, verificador de números contra el payload y fallback determinista.
- `src/lib/orbita.ts` — Parser de TLEs y propagador SGP4 (`estado()`, `proximaPasada()`, trazas y arcos).
- `src/lib/cache.ts` y `src/data/cache-lecturas.json` — Cache verificado de Abra Pampa.
- `src/lib/traccion-cliente.ts` y `src/components/Contador.tsx` — Telemetría de uso con cola offline en `localStorage`.
- `src/app/api/lecturas/route.ts`, `alerta/route.ts`, `tts/route.ts`, `tle/route.ts`, `traccion/route.ts` — Todos los endpoints backend.
- `src/components/App.tsx` — Orquestador principal de la UI.
- `scripts/precache.ts` — Script `npm run precache` para bajar los 10 pueblos y TLEs reales antes del freeze.

### Pendiente de terminar de escribir y verificar
- Componentes de UI hijos referenciados por `App.tsx`:
  - `src/components/RadarOrbital.tsx` (reloj SGP4 cada 1s + próxima pasada SAOCOM)
  - `src/components/PanelGps.tsx` (botón de consentimiento explícito `navigator.geolocation`)
  - `src/components/Mapa.tsx` (Leaflet + pines + traza SAOCOM + posición GPS)
  - `src/components/PanelDatos.tsx` (lluvia, temperatura, NDVI + toggle Comunidad / Paramétrico B2B)
  - `src/components/PanelAlerta.tsx` (botón generar alerta + audio xAI TTS / `speechSynthesis` + `wa.me`)
  - `src/components/FichaCultural.tsx` (calendario citado y disclaimer)
- `src/app/page.tsx`, `.env.example`, `public/sw.js` (si aplica) y verificación final con `npm run precache`, `npm run typecheck`, `npm run build` y deploy en Vercel (`HTTPS` obligatorio para GPS y QR).

---

## 7. Guion del pitch (3 minutos) — Puntos clave

1. **Gancho en vivo (20s):** Mostrar el radar orbital de **SAOCOM 1A/1B** corriendo en tiempo real y el GPS del tren en pantalla. Aclarar que SAOCOM es radar SAR (humedad de suelo a través de nubes) y mostramos su órbita real en vivo.
2. **Problema + Honestidad de datos (40s):** Sequía de sep/oct (entrega provincial de alfalfa) vs dato real de hoy en Abra Pampa (**+92,7 %** de lluvia en últimos 30 días con dato vs promedio 2001–2025). No vendemos un relato fijo: mostramos lo que mide el satélite.
3. **Demo (60s):** Clic en Abra Pampa → ver lluvia, temp y NDVI (`0,138` del `01/11`, producto 16 días) → tocar **Generar alerta** (Grok + Zod + verificador numérico) → escuchar audio → botón **Enviar por WhatsApp**.
4. **Negocio y escala (40s):** Gratis para familias pastoras. Pago B2B para **cooperativas y aseguradoras paramétricas** (apoyado en el antecedente Sancor/CONAE y el régimen SSN 2026, sin prometer póliza hoy). Escala por `(lat, lon)` a todo el NOA y Altiplano.
5. **Cierre ético (20s):** Diseñado para co-crear con las comunidades, no para hablar en su nombre.
