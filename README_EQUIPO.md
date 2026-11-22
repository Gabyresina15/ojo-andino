# Ojo Andino — Guía rápida para el equipo

**Qué es en una frase:**  
Una app web offline-first que cruza **telemetría orbital en vivo de los satélites argentinos SAOCOM 1A/1B**, **GPS en vivo desde el Tren Solar**, y **datos satelitales reales de lluvia, temperatura y verdor (NASA POWER + MODIS)** para generar una alerta clara —en texto, voz y WhatsApp— para comunidades de la Puna/Quebrada y cooperativas/aseguradoras paramétricas.

---

## 1. Por qué esta versión es mucho más fuerte para hoy

1. **Telemetría espacial real (no solo promedios):**  
   Propagamos las órbitas de **SAOCOM 1A y 1B** (CONAE) cada 1 segundo en el navegador con `satellite.js` a partir de los TLEs de CelesTrak. Mostramos dónde están ahora, a qué altura vuelan y cuándo es la próxima pasada sobre Jujuy.  
   *Aclaración honesta:* SAOCOM lleva un radar SAR banda L (ve a través de nubes y mide humedad del suelo), pero **no mostramos imagen SAR cruda**; mostramos su telemetría orbital en vivo.
2. **El Tren Solar entra en escena:**  
   Con consentimiento explícito del usuario, la app lee el GPS del celular (`navigator.geolocation`) para mostrar ubicación, altitud y velocidad en el tren, y calcula la órbita respecto a esa posición.
3. **Cero humo con los datos:**  
   Hoy **22/11/2026**, en Abra Pampa NASA POWER marca **82,09 mm** en los últimos 30 días con dato (21/10–19/11) frente a **42,61 mm** del promedio 2001–2025 (**+92,7 %**).  
   Venimos de una sequía dura en septiembre/octubre (cuando la Provincia repartió alfalfa), pero en noviembre empezó a llover. **Ojo Andino no inventa una sequía eterna**: muestra el cambio de régimen en vivo.
4. **IA con validación determinista (Grok + Zod):**  
   `grok-4.7` (xAI) no chatea libre: devuelve un JSON validado con **Zod** y un verificador numérico que rechaza cualquier número que no exista en el payload satelital. Si Grok o la red fallan, cae a un redactor determinista local.
5. **Modelo de negocio claro (quién paga y por qué escala):**
   - **Gratis:** Consulta de pueblo, audio y reenvío por WhatsApp para familias pastoras y comunidades.
   - **Pago (B2B):** **Cooperativas ganaderas y aseguradoras paramétricas** (en Argentina ya existen seguros paramétricos por índice satelital como Sancor + CONAE/TVDI, y en 2026 la SSN actualizó el régimen con `RESOL-2026-315-APN-SSN#MEC`). Vendemos la serie estandarizada, el desvío vs climatología 2001–2025 y la alerta; **no** prometemos pólizas homologadas hoy.
   - **Escala:** El mismo motor funciona cambiando `(lat, lon)` para Salta, Catamarca y el Altiplano de Bolivia/Perú.

---

## 2. Cómo funciona en la demo (90 segundos)

1. **Barra orbital + GPS:** Mostrás SAOCOM 1A/1B en tiempo real y activás el GPS del celular en el tren.
2. **Mapa de Quebrada y Puna:** 10 localidades cargadas (las 5 paradas del tren: Volcán, Tumbaya, Purmamarca, Maimará, Tilcara + Humahuaca, Abra Pampa, Susques, La Quiaca, Yavi).
3. **Panel de datos (Abra Pampa):**  
   - Lluvia 30 días con dato vs promedio 2001–2025 (**NASA POWER**, demora oficial 2–3 días).  
   - Temperatura media últimos 7 días con dato (**14,19 °C** vs **11,16 °C** de noviembre).  
   - Verdor **NDVI** (**MODIS MOD13Q1** vía ORNL): compuesto de 16 días (**0,138** al `01/11/2026` vs **0,134** en 2025). *Nunca se traduce a "% de pasto".*
4. **Toggle de vista:** Cambiás entre **Comunidad · gratis** y **Cooperativa / Seguro paramétrico · B2B**.
5. **Alerta + Voz + WhatsApp:** Generás la alerta con Grok, la reproducís con **xAI TTS** (o respaldo del navegador) y abrís `wa.me` con el mensaje listo para reenviar.
6. **Ficha cultural:** Contexto citado (Pachamama el 1 de agosto, Señalada en carnaval/febrero —sin mezclarlos—, UNESCO Quebrada 2003), con aviso explícito de que no habla en nombre de ninguna comunidad.

---

## 3. Reglas de oro para el pitch (no pisar el palito)

- **No inventar números:** Solo citar datos que se vean en pantalla o en las APIs.
- **No decir "sequía hoy"** si la anomalía de lluvia del mes es positiva.
- **No decir "el NDVI es porcentaje de pasto"**: es índice de verdor (0 a 1).
- **No presentar comunidades reales como clientes** ni decir que ya tenemos póliza homologada.
- **Resiliencia Starlink:** Todo tiene fallback local (`cache-lecturas.json`, `tle-saocom.json`, `localStorage`, fallback determinista de alerta y voz del navegador).

---

## 4. Estado actual del código en `ojo-andino/`

- **Listo en el repo:** Tipos (`src/lib/types.ts`), 10 comunidades y fichas culturales (`src/lib/comunidades.ts`), fetcher NASA POWER + ORNL MODIS (`src/lib/lecturas.ts`), motor Grok + Zod + verificador numérico (`src/lib/alerta.ts`), propagador SGP4 (`src/lib/orbita.ts`), rutas API (`/api/lecturas`, `/api/alerta`, `/api/tts`, `/api/tle`, `/api/traccion`), script `scripts/precache.ts`, `App.tsx` y `Contador.tsx`. Dependencias instaladas (`npm install` OK).
- **Falta terminar de escribir y compilar:** Los componentes visuales hijos (`RadarOrbital`, `PanelGps`, `PanelDatos`, `PanelAlerta`, `FichaCultural`, `Mapa`), `page.tsx`, `npm run precache` y `npm run build` + deploy en Vercel.
