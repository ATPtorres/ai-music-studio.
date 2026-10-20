# Paleta de sonidos — revisión del 20 de octubre de 2026

La paleta amplía el preview local con cinco opciones de acordes, seis de melodía, tres bajos y tres kits de batería. No requiere descargas de muestras, servicios, cuentas, claves ni paquetes nuevos. Se mantiene el tema claro con bordes rectos y colores sólidos.

## Opciones

| Pista | Sonidos |
| --- | --- |
| Acordes | Piano eléctrico, pad cálido, strings, guitarra acústica, guitarra eléctrica limpia |
| Melodía | Pluck, guitarra acústica, guitarra eléctrica limpia, piano, lead suave, flauta sintética |
| Bajo | Bajo eléctrico, bajo sintetizado, contrabajo |
| Batería | 707, 808, 909 |

Los instrumentos acústicos son **aproximaciones por síntesis**. Los kits son recetas originales inspiradas en características generales de esas máquinas: 707 seca/compacta, 808 grave con cola larga, 909 con pegada brillante. No contienen grabaciones originales, bancos de muestras ni emulaciones certificadas de los equipos. No se afirma fidelidad acústica o histórica. Para pianos/guitarras realistas o máquinas originales habría que incorporar bancos de muestras con permisos de distribución y presupuestar su descarga y memoria.

## Uso

1. Genera la pista en su módulo. El selector se activa cuando existe la pista.
2. Elige **Sonido de acordes**, **Sonido de melodía**, **Sonido de bajo** o **Máquina de batería**. El cambio detiene el preview y conserva notas, acordes, pasos, velocidades y swing. Pulsa Reproducir para escuchar la nueva voz.
3. Regenerar/variar música o editar sus eventos conserva el sonido elegido. El kit cambia el timbre, no el patrón por género.
4. En **Estructura**, cada pista de la mezcla ofrece el mismo selector. El arreglo, los acompañamientos y los generadores leen la elección guardada de la pista. Cambiar sonido detiene el transporte; volumen y silencio siguen aplicándose en directo.
5. Guarda una copia JSON: el sonido viaja con el proyecto y se recupera al recargar o importar.

Los acompañamientos respetan el sonido de cada fuente, aunque se reproduzcan desde otro módulo. La elección es por pista, compartida por todos sus clips; no se pueden asignar sonidos distintos por sección a una misma pista en esta entrega.

## Guardado y compatibilidad

Cada pista incorpora un campo opcional `sound` con ID de un catálogo cerrado. Sigue siendo JSON v1; los archivos anteriores sin ese campo se importan sin añadirlo automáticamente. Por defecto se resuelven Piano eléctrico para acordes, Lead suave para melodía, Bajo eléctrico para bajo y 707 para batería. Los programas MIDI predeterminados actuales son 4/80/33/0 (índice cero). Las selecciones antiguas de Piano en acordes y LinnDrum se aceptan para recuperar proyectos, pero se resuelven a Piano eléctrico y 707 tanto en preview como en exportación MIDI. No se ofrecen en los selectores; Piano permanece disponible en Melodía.

El esquema comprueba que el ID exista y corresponda al tipo de pista: un kit no puede asignarse a acordes ni un piano a batería. Los lectores antiguos con esquema estricto pueden rechazar archivos que ya incluyan `sound`; la compatibilidad de lectura es hacia atrás desde esta versión. Una selección no cambia referencias armónicas, notas, mezcla, letra o vínculos de secciones.

## Síntesis y exportación

Los instrumentos melódicos usan voces polifónicas con FM, osciladores y filtros/envolventes según el preset. Se comparten entre ChordPlayer y TrackPlayer para que la elección tenga la misma receta dentro y fuera del arreglo. Piano eléctrico, piano y bajo eléctrico usan FM; pad/strings y cuerdas pulsadas usan filtrado; lead/flauta usan envolventes propias.

Los kits cambian frecuencia, caída de tono y envolvente del bombo, color del ruido, filtros y colas de caja/clap/hats/shaker. Se mantiene el mapa GM de seis instrumentos, el ahogo del hi-hat abierto al golpear el cerrado y la liberación de recursos al cambiar de kit o salir del módulo.

Los exportadores de acordes, pistas y arreglo escriben el programa GM seleccionado. **El MIDI no incluye nuestro audio**: el sonido final depende del banco del DAW y su soporte de selección de kit en canal 10. Las correspondencias de batería son aproximadas:

| Selección | Programa (índice cero) | Familia GM de exportación |
| --- | --- | --- |
| 707 | 0 | Standard |
| 808 | 25 | TR-808 |
| 909 | 24 | Electronic |
| LinnDrum | 8 | Room |

Piano 0; eléctrico 4; pad 89; strings 48; acústica 24; eléctrica limpia 27; pluck 10; lead 80; flauta 73; bajo eléctrico 33; sintetizado 38; contrabajo 32. Volumen/silencio siguen afectando solo al preview, conservando las velocidades y notas exportadas, como en las fases anteriores.

## Verificación histórica — 19 de octubre de 2026

- **151 pruebas en 25 archivos**: 140 previas y 11 nuevas. Esquema/compatibilidad, persistencia, regeneración, propagación al render, programas reales de los tres exportadores y canales/velocidades intactos. Voces polifónicas, familias FM/filtrado, recetas distintas, cambios de kits y limpieza de recursos. Selectores en acordes y mezcla con comprobación de datos conservados.
- `npm run lint`, `npm run build` y `git diff --check`: correctos. Persisten los avisos no bloqueantes de anotaciones de optimización de Zod.
- Chromium con Web Audio real: reproducción de las 19 combinaciones ofrecidas por los selectores (16 timbres únicos), cambios que detienen el preview, notas/patrón conservados, sonido retenido al regenerar, acompañamientos, reproducción desde el arreglo y selección desde la mezcla.
- Descarga MIDI desde el arreglo y lectura de programas/kit [48, 10, 38, 24] con canal 9 de percusión (10 humano). Exportación/importación JSON y recarga conservan los cuatro sonidos.
- Render OfflineAudioContext de los 16 timbres únicos a 22050 Hz, 1,4 s por caso: muestras finitas, energía no nula, formas de onda distintas y pico inferior a 1 en los casos probados. Los casos de batería incluyen bombo, caja e hi-hat abierto/cerrado. Esto no es una evaluación auditiva ni demuestra que cualquier mezcla quede libre de saturación.
- Capturas de escritorio y viewport móvil a 390 px revisadas, sin desbordamiento horizontal del documento ni errores JavaScript.

Pendiente: escucha humana para valorar carácter y balance, comparación con equipos reales, móvil físico/Safari y revisión de los programas/kits en un DAW. Los controles de volumen permiten ajustar diferencias de nivel percibido entre instrumentos sostenidos y percusivos.

## Correcciones del 20 de octubre de 2026

La ganancia de cada preset de Acordes y Bajo se ajusta en `previewLevels.ts`, compartida por los generadores, acompañamientos y el arreglo. La comparación usa las mismas notas, velocidad, duración y fader; conserva el carácter de ataque/caída, la dinámica MIDI y el volumen que eligió el usuario. No es normalización LUFS ni garantiza igual sonoridad para cualquier registro o frase.

Se corrigieron los pasos pares con swing: Tone Transport omite eventos expresados como ticks fraccionarios. Los inicios, final y loop se convierten ahora a ticks enteros al programar el preview. El patrón guardado y sus tiempos MIDI no se modifican.

Consulta [mediciones y regresiones](verification-audio-fixes.md) para el caso reproducido, resultados y comprobación opcional con Web Audio real.
