# Fuentes satelitales públicas: qué se puede consumir

Relevamiento del 24/11/2026. "Probado" significa que se hizo un pedido real para un punto de la Puna
(Abra Pampa, −22,72 / −65,70) y devolvió datos. La licencia se cita del sitio del productor; donde no se
pudo leer en esta revisión, dice "sin verificar".

Ninguna de estas fuentes está homologada por un organismo argentino. Son productos oficiales de la agencia
que los publica. El aval local (INTA, SMN, CONAE, UNJu) es un trámite aparte.

## En uso

| Fuente | Qué da | Resolución / demora | Acceso | Licencia | Estado |
|---|---|---|---|---|---|
| NASA POWER | Lluvia y temperatura diarias, climatología 2001–2025 | Grilla regional (~50 km) / 2–3 días | API sin clave | Política de datos abiertos de NASA: sin período de acceso exclusivo. NASA pide no sugerir que avala un producto | En uso |
| MODIS MOD13Q1 (ORNL DAAC) | NDVI | 250 m / compuesto de 16 días | API sin clave | Datos NASA, misma política | En uso |
| CHIRPS v2 (UCSB) vía ClimateSERV | Lluvia diaria | ~5 km / semanas | API sin clave | Dominio público (declarado en chc.ucsb.edu). v2 deja de producirse después de 12/2026 | En uso, solo temporadas cerradas |
| MET Norway locationforecast | Pronóstico de lluvia | Modelo global / 9 días | API sin clave, exige User-Agent | CC BY 4.0 (verificado en una revisión anterior) | En uso, solo pronóstico |
| CelesTrak (TLE) | Órbita de SAOCOM 1A/1B | — | Descarga pública | Sin verificar | En uso, solo horarios de pasada |

## Probadas y disponibles, sin usar

| Fuente | Qué da | Resolución / demora | Acceso | Licencia | Para qué serviría |
|---|---|---|---|---|---|
| Sentinel-2 L2A (ESA/Copernicus) vía Earth Search | Imagen óptica, 13 bandas | 10 m / ~5 días | STAC + COG sin clave | Aviso legal de Copernicus: acceso libre, pleno y abierto; permite reproducción, distribución y adaptación | Verde de vegas con ubicación conocida |
| Sentinel-1 GRD (ESA/Copernicus) vía Earth Search | Radar SAR banda C | 10 m / 6–12 días. Última escena sobre Abra Pampa: 19/11/2026 | STAC sin clave | Mismo aviso legal de Copernicus | Radar real y abierto. Humedad de suelo requiere procesamiento propio y validación |
| MODIS MOD11A2 (ORNL) | Temperatura de superficie | 1 km / 8 días. Último dato: 09/11/2026 | API sin clave | Datos NASA | Heladas y estrés térmico |
| MODIS MOD16A2GF (ORNL) | Evapotranspiración | 500 m / 8 días. Último dato: 27/12/2025 | API sin clave | Datos NASA | Balance hídrico, con un año de atraso. En suelo desnudo devuelve valor de relleno |
| MODIS MOD14A2 (ORNL) | Focos de calor | 1 km / 8 días. Último dato: 09/11/2026 | API sin clave | Datos NASA | Quemas |
| NASA POWER GWETTOP / GWETROOT | Humedad de suelo | Grilla regional / 2–3 días | API sin clave | Datos NASA | Contexto. Sale de un modelo (GEOS), no de una medición satelital directa |
| BAHRA (IGN/INDEC) | Coordenadas oficiales de localidades | — | WFS del IGN sin clave | Sin verificar | Ya se usa en la prueba retrospectiva |
| IGN, capa "vegetación hidrófila" | 467 polígonos de pajonal/juncal/totoral en la Puna jujeña | — | WFS del IGN sin clave | Sin verificar | Ver "Vegas" |

## Listadas, sin probar en esta revisión

| Fuente | Qué da | Por qué no se probó |
|---|---|---|
| Landsat 8/9 (USGS) | Óptico 30 m desde 1982 | Aparece en los catálogos consultados; no se bajó ninguna escena. Licencia sin verificar |
| GPM IMERG (NASA) | Lluvia casi en tiempo real | Probado antes: valores de 2026 anómalos (+39 % a +103 %). No se adoptó |
| SMAP SPL3SMP_E (ORNL) | Humedad de suelo, 9 km | El pedido al punto falló |
| VIIRS VNP13A1 (ORNL) | NDVI 500 m | El servicio devuelve datos solo hasta 05/2024 |
| NASA FIRMS | Focos de calor casi en tiempo real | Requiere una clave gratuita |
| GOES-19 (NOAA) | Lluvia estimada cada 10 min | El listado público no devolvió archivos con la ruta probada |
| ERA5-Land (Copernicus C3S) | Reanálisis, 9 km | Requiere cuenta. No es satélite: es un modelo |
| JRC Global Surface Water, ESA WorldCover, Copernicus DEM | Agua superficial, cobertura, relieve | Aparecen en los catálogos; no se probaron |

## No disponible como dato abierto

| Fuente | Situación |
|---|---|
| SAOCOM 1A/1B (CONAE) | Existe un catálogo web. No se verificaron las condiciones de acceso ni de uso comercial. Hasta tener un acuerdo con CONAE, la app solo muestra horarios de pasada |
| Open-Meteo | El servicio gratuito es para uso no comercial |

## Vegas

Se probó la capa oficial del IGN contra Sentinel-2, septiembre de 2022 a 2026, en 21 polígonos cerca de
Abra Pampa, Susques, Santa Catalina, Rinconada y Yavi. El NDVI medio dentro de los polígonos queda entre
0,03 y 0,21 y varía alrededor de 0,01 de un año a otro en la mayoría. Es el nivel de suelo casi desnudo:
esos polígonos no delimitan parches verdes en época seca, así que no sirven como base de un indicador.

No se construyó el módulo. Hace falta la ubicación de vegas reales, de una comisión, de INTA o de un
inventario científico. No se consultó el Inventario Nacional de Humedales.
