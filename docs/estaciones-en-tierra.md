# Lluvia medida en tierra en la Puna y Quebrada jujeña: qué hay público

Relevamiento del 24/11/2026. "Probada" significa que se hizo un pedido real y devolvió datos de lluvia.
Ninguna de estas fuentes está integrada al tablero.

## Estaciones con dato de lluvia

| Estación | Organismo y red | Ubicación | Serie de lluvia | Acceso | Condiciones de uso | Estado |
|---|---|---|---|---|---|---|
| Abra Pampa (EEA INTA) | INTA, sistema SIGA | −22,80 / −65,83, 3.463 m | Diaria, 08/2013 a hoy (un día de demora) | Visor siga.inta.gob.ar. El pedido que hace el visor responde sin clave, pero no es un servicio documentado | Sin licencia publicada. Para uso en un producto hace falta acuerdo con INTA | Probada. Es la única serie larga de la Puna jujeña que se encontró |
| Hornillos (IPAF NOA, Quebrada) | INTA, SIGA | −23,66 / −65,43, 2.241 m | Diaria, 2015 a 2019 en lo que se bajó (2013, 2014 y 2020 no respondieron). Totales anuales de 67 a 98 mm | Igual | Igual | Probada. No se comparó con las fuentes satelitales |
| La Quiaca Observatorio (87007) | SMN | −22,10 / −65,60, 3.479 m | GHCN-Daily (NOAA): 1976 a 04/2025, con años incompletos. Mensajes SYNOP horarios en OGIMET (probado con enero de 2026) | NOAA NCEI sin clave; OGIMET sin clave. El archivo horario de datos abiertos del SMN no trae lluvia | GHCN: datos abiertos de NOAA. OGIMET: redistribución no oficial. Serie oficial completa: pedido al SMN | Probada. No sirve para validar CHIRPS: CHIRPS ya la usa como dato de entrada |
| Barrios (cerca de La Quiaca) | Red Meteorológica RMET, en el SNIH | −22,25 / −65,53 | Cada 4 h, desde 05/2025 | Visor snih.hidricosargentina.gob.ar, sin clave | Sin licencia publicada | Probada. Dato dudoso: 0 mm en enero y febrero de 2026 |
| Cieneguillas (Santa Catalina) | RMET, SNIH | −22,10 / −65,87 | Cada 4 h, desde 05/2025 | Igual | Igual | Probada. Dato dudoso: 0 mm desde 03/2026 |
| Sausalito (Cochinoca) | RMET, SNIH | −23,29 / −65,97 | Cada 4 h, desde 04/2025 | Igual | Igual | Probada. Valores verosímiles, una sola temporada |
| Volcán (Tumbaya) | RMET, SNIH | −23,92 / −65,46 | Horaria, desde 06/2026 | Igual | Igual | Probada. Todavía sin temporada de lluvias |
| Parque Chinchilla (Rinconada) | RMET, SNIH | −22,58 / −66,84 | Figura en el listado desde 02/2026; no se le pidió la serie | Igual | Igual | Sin probar |

No se encontró ninguna estación pública con lluvia en Susques, Rinconada (pueblo), Humahuaca, Tilcara, Maimará ni Purmamarca.
No se revisaron redes provinciales de Jujuy ni estaciones de empresas mineras.

## Qué dice la estación de INTA Abra Pampa

Generado por `npm run estacion` en `src/data/estacion.json` (temporadas del 1/12 al 30/4, 2014 a 2026, 12 con datos completos).

- Las tres fuentes satelitales dan bastante más lluvia que la estación.
- CHIRPS v3 es la que más se le parece, pero con 12 temporadas la diferencia entre fuentes no es concluyente.
- CHIRPS no usa esta estación como dato de entrada: en los listados de estaciones usadas de enero de 2016 y enero de 2026 (`diagnostics/list_of_stations_used` del Climate Hazards Center) las únicas de Jujuy son La Quiaca Obs., Jujuy Aero y Jujuy Univ. Nac. El contraste es independiente.
- La estación está a unos 16 km de la coordenada de Abra Pampa que usa el tablero.

Comparación hecha una sola vez con CHIRPS v2 (píxel de la localidad, no de la estación): correlación 0,67 y 65 % de exceso.

## Sentinel-1 contra la estación

Prueba fuera de la app: 182 imágenes de radar (01/2022 a 11/2026, órbita 76) sobre un cuadrado de 1 km en la estación.

| Comparación (diciembre a marzo, 57 imágenes) | Correlación de rangos |
|---|---:|
| Radar frente a lluvia de 10 días de la estación | 0,71 |
| Radar frente a lluvia de 10 días de NASA POWER en el mismo punto | 0,30 |

- Con 5 mm o más en los 3 días previos (19 imágenes) la señal promedia −14,95 dB; sin lluvia en 10 días (86 imágenes), −16,90 dB con desvío de 0,26 dB.
- Con un cuadrado de 6 km los resultados son parecidos (0,68 y 0,21).
- Es un solo sitio. No alcanza para publicar un indicador de humedad de suelo: falta repetirlo en otros lugares y contrastarlo en campo.
