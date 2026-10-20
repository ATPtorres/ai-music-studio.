# Correcciones de sonido — 20 de octubre de 2026

## Qué cambió

- Acordes ofrece Piano eléctrico, Pad, Strings y las dos guitarras. Se retira Piano únicamente de Acordes; sigue disponible en Melodía.
- Batería ofrece 707, 808 y 909. Se retira LinnDrum del selector y de los perfiles de síntesis activos.
- Los IDs antiguos se admiten en JSON para conservar notas, patrones, mezcla y secciones. Al reproducir o exportar, `piano` en acordes se resuelve a `electric-piano`; `kit-linn` a `kit-707`. También cambia a eléctrico el sonido predeterminado de acordes sin selección explícita.
- Se aplican compensaciones por preset a Acordes y Bajo. Son comunes a ChordPlayer y TrackPlayer, incluidos acompañamientos y Estructura. No se cambia el fader del usuario ni la velocidad de las notas/MIDI.

## Causa de los pasos silenciosos

El patrón sí guardaba las semicorcheas pares. Con swing 60%, el segundo paso comienza en 0,4 negras. A 192 PPQ, el código anterior programaba `76.80000000000001i`; el reloj de Tone recorre ticks enteros y no encontraba ese evento. El cuarto paso sufría el mismo problema, repetido en cada beat/compás. Otros valores de swing también producen ticks fraccionarios.

Se reprodujo con el reloj real de Tone y Web Audio fuera de línea: **solo 24 de 48 pasos** disparados con swing 60%. El problema era de planificación temporal, común a todos los sonidos. No se necesitó cambiar envolventes ni añadir voces de percusión.

`previewTime` redondea al tick entero más cercano (`77i` en ese ejemplo) antes de programar eventos, final y loop. Error máximo: medio tick, aproximadamente 1,56 ms a 100 BPM con 192 PPQ. También se redondean las posiciones de búsqueda del transporte. Las notas almacenadas y su exportación MIDI mantienen sus tiempos originales. La corrección también cubre otras pistas con inicios fraccionarios.

## Mediciones de volumen

Render real a 48000 Hz, mono, cuatro ataques separados 0,8 s, duración de nota 0,6 s, velocidad 0,75 y fader 0,7. Acordes: Do3/Mi3/Sol3; bajos: Do2. RMS integrado entre 0,1 y 3,3 segundos. Valores en dBFS; no son LUFS ni una evaluación perceptiva.

| Preset | Antes | Después | Pico después |
| --- | ---: | ---: | ---: |
| Piano eléctrico | -42,50 | -36,00 | 0,1132 |
| Pad cálido | -37,40 | -36,00 | 0,0821 |
| Strings | -40,77 | -35,97 | 0,0628 |
| Guitarra acústica | -40,21 | -36,01 | 0,1740 |
| Guitarra eléctrica | -33,21 | -36,01 | 0,1004 |
| Bajo eléctrico | -42,48 | -33,98 | 0,0967 |
| Bajo sintetizado | -34,26 | -33,96 | 0,1066 |
| Contrabajo | -38,83 | -34,03 | 0,1378 |

En esta referencia, la diferencia baja de 9,29 a 0,04 dB en acordes y de 8,22 a 0,07 dB en bajos. Los ataques, el contenido espectral y la duración de cada timbre siguen siendo diferentes; la escucha humana puede requerir ajustes finos para otras frases y registros. No se garantiza ausencia de saturación en cualquier mezcla arbitraria.

## Pruebas

- **170 pruebas correctas en 26 archivos.** Se agregan regresiones para swing 1/10/30/60%, ticks enteros, conservación de los tiempos originales, final fraccionario y resolución de instrumentos retirados. Los selectores y los programas MIDI reflejan las nuevas opciones.
- Render con **Tone real y node-web-audio-api 2.2.0**, sin reproducción por altavoces: 72 escenarios de batería (3 kits × 6 instrumentos × 100/300 BPM × swing 0/60%), 48 pasos por escenario, tres compases. **3456 pasos detectados y con energía**, incluidos los pasos 2 y 4; mínimo de las ventanas medidas: -62,64 dBFS. Se verificó el caso que fallaba antes de la corrección.
- Los ocho presets se renderizan y comparan con tolerancia máxima de 2 dB por sección en la referencia, y pico inferior a 0,8 en esos casos.
- No se agregan dependencias de ejecución ni de los tests habituales al proyecto. El motor Web Audio nativo se instaló aparte, en una carpeta temporal de verificación.

La prueba de render se puede repetir opcionalmente en PowerShell:

```powershell
npm install --prefix "$env:TEMP\ai-music-audio-check" --no-save --package-lock=false node-web-audio-api@2.2.0
node scripts/verify-preview-audio.cjs "$env:TEMP\ai-music-audio-check\node_modules\node-web-audio-api"
```

El script compila un verificador temporal con el esbuild disponible en desarrollo y borra ese archivo al terminar. Genera un reporte JSON y falla si se pierden pasos, hay silencios completos o los presets superan las tolerancias. No llama servicios ni usa API keys.

Pendiente: escucha humana del balance en frases propias y confirmación manual en el navegador del usuario. Para comparar, detener y volver a iniciar la reproducción después de recargar, recorrer los tres kits con todos los pasos activados y alternar swing 0/60%.
