# Fase 6 — Estudio de arreglo

La versión 0.6.0 conecta las pistas musicales y las letras en un arreglo local por secciones: timeline, orden, duración, transporte común, mezcla sencilla y MIDI multipista. No necesita cuentas, claves, Netlify, Gemini ni Redis. La IA opcional de Fase 5 mantiene sus requisitos y su validación real pendiente.

La ampliación [v0.6.1](sounds.md) añade selección de sonidos en generadores y mezcla, conservada por los vínculos.

## Recorrido de uso

1. Crea acordes, melodía, bajo y/o batería en sus generadores, o importa un proyecto JSON. Abre **Estructura** desde el lateral o Herramientas.
2. Si no hay secciones, usa **Crear estructura inicial**: Intro de 4 compases, Verso de 8 y Estribillo de 8, vinculadas a las primeras 16 pistas disponibles. No reemplaza secciones existentes. También puedes **Añadir sección** vacía.
3. Si ya escribiste letras en Fase 5, sus secciones aparecen con los mismos IDs, nombres, compases y texto. Vincula las pistas pulsando las celdas del timeline o usa **Vincular todas a esta sección**. Una celda vacía significa silencio de esa pista.
4. Selecciona una cabecera o la lista **Sección a editar**. Edita nombre, compases y letra. Confirma compases y BPM con Enter o al salir del campo. **Mover antes/después** desplaza toda la sección, con sus vínculos y letra; **Duplicar** crea un ID nuevo; **Eliminar** pide confirmación y conserva las pistas originales.
5. Pulsa **Reproducir arreglo**, **Pausar**, **Reanudar**, **Detener** o **Repetir arreglo**. **Reproducir desde esta sección** comienza en su inicio, incluso si esa parte es silenciosa. Repetir afecta a todo el arreglo: si comienzas por una sección intermedia, las siguientes vueltas comienzan en cero. La letra de la sección actual aparece durante la reproducción; no es karaoke ni voz sintetizada.
6. Ajusta volumen y silencio en la mezcla mientras suena. Se guardan en la pista y se comparten con los previews de los demás módulos. Los cambios de vínculos, secciones, texto, tempo o canal detienen el preview para evitar una agenda desactualizada.
7. **Descargar MIDI del arreglo** exporta las notas repetidas/recortadas, sus canales y programas, tempo, compás, marcadores de sección y duración hasta el final, incluido el silencio final. Exporta JSON desde Proyectos para conservar además letras, vínculos y mezcla.

La línea de tiempo se desplaza horizontalmente dentro de su panel. En pantallas pequeñas mantiene accesibles las acciones de orden sin exigir arrastrar con el dedo. Las columnas tienen un ancho mínimo para que se puedan pulsar; a partir de ese mínimo crecen con la duración.

Ejemplos listos para importar: [proyecto Fase 6](examples/proyecto-fase6.json) y [MIDI del arreglo](examples/arreglo-demo.mid). Cinco secciones, cuatro pistas, 13 compases, 100 BPM, 31,2 s incluidos un compás final de silencio. El MIDI contiene 386 notas; los dos textos del ejemplo son originales de esta entrega.

## Qué significa un clip vinculado

El formato v1 ya tenía `sections[].trackIds`, `bars` y `lyrics`. Ahora una referencia a una pista activa su clip en esa sección. No se copian las notas al guardar vínculos y no se modifican las fuentes al renderizar.

- Cada sección comienza el clip desde su tiempo cero. Se repite hasta completar sus compases y se recorta cualquier nota que atraviese el final. Se conservan silencios iniciales e internos de la fuente.
- Para acordes se usan los eventos armónicos como fuente canónica; si una pista importada no tiene eventos de acordes, se conservan sus notas. Para melodía/bajo y batería importada sin patrón se usan sus notas. Su ciclo es el final de la última nota, redondeado al siguiente compás global.
- La batería con patrón conserva la longitud de su propio ciclo y sus tiempos con swing. Si su compás difiere del global, aparece un aviso; no se transforma silenciosamente. Las notas de percusión fuera del kit de seis sonidos se conservan en MIDI y se avisan porque no suenan en el preview.
- Desvincular no borra la pista. Editar la fuente en su generador actualiza todos los vínculos al volver al arreglo. Los generadores anteriores siguen editando la primera pista de cada tipo; las adicionales importadas pueden vincularse y mezclarse sin eliminarlas.
- En esta entrega no hay offsets de fuente, clips independientes por sección, automatización, grabación, efectos, cambios de tempo/compás dentro de la canción ni audio WAV/MP3. Para material diferente en una sección se necesita una pista fuente distinta. La duración objetivo de parámetros no estira notas: la duración real se calcula con secciones × compases × negras por compás × 60/BPM.

## Compatibilidad e integración de modos

Se mantiene JSON **v1** sin añadir campos al esquema. `sections` define el orden; cada objeto conserva su ID, letra y referencias. `volume`, `muted` y `channel` permanecen en las pistas. Los archivos anteriores, incluidos los que no tienen secciones, siguen siendo válidos.

Los motores locales, la biblioteca creativa y las ediciones manuales del piano roll/secuenciador alimentan el mismo arreglo. Las letras pueden ser manuales, guiadas localmente o un borrador de Gemini ya aplicado. Aplicar otro borrador de Fase 5 conserva IDs, compases y vínculos de las secciones existentes por posición, tal como se documentó en esa fase. Las secciones nuevas de ese borrador quedan sin vínculos hasta que las actives en Estructura.

Los previews de los generadores y el del arreglo usan el mismo transporte Tone, con un único dueño montado a la vez. Al salir del módulo se liberan sus nodos y eventos; el siguiente módulo empieza con su propia selección. No se conserva un transporte sonando entre pantallas.

## Mezcla y exportación MIDI

La mezcla es volumen 0–100% y silencio por pista, sin procesado de mastering. El preview usa síntesis sencilla; no equivale al sonido de un DAW. Los canales MIDI se pueden cambiar desde la mezcla; el canal humano 10 (índice 9) sigue reservado para percusión.

Como en los módulos anteriores, **silencio y volumen afectan al preview, no eliminan notas ni cambian velocidades MIDI**. El exportador incluye todas las pistas vinculadas que tengan notas y conserva las velocidades originales. Una pista vacía no crea eventos de nota artificiales.

Para evitar colisiones de programa/nota, se rechazan pistas sonoras que compartan canal MIDI. Cambia los canales melódicos desde la mezcla. Si hay dos pistas de batería en canal 10, desvincula una para exportar ese arreglo. Esto no impide escucharlas juntas dentro de los límites del preview.

El MIDI se cuantiza a 480 PPQ. Si una nota importada queda tan cerca del final de sección que su inicio redondea fuera de ella, se rechaza con un mensaje para corregirla. No se introduce una nota colgada o fuera de sección. Se añade End Of Track al final real de cada pista del SMF para conservar los silencios; la revisión en DAW real sigue pendiente.

## Límites y archivos

El esquema mantiene hasta 100 secciones y 512 compases por sección. Para renderizar/reproducir/exportar, se limita a **4096 negras totales, 15000 notas expandidas y 16 pistas vinculadas**. Un clip fuente que excede esos límites de duración o notas también se rechaza. El timeline y los controles siguen disponibles para reducir o desvincular material cuando el preview excede sus límites. La importación/guardado mantiene el límite previo de 2 MB.

- `src/arrangement/render.ts`: disposición temporal, fuentes de clips, repetición/recorte, orden y límites.
- `src/features/arrangement/`: timeline, edición, transporte y mezcla.
- `src/audio/TrackPlayer.ts`: transporte compartido, hasta 16 pistas, posicionamiento y reinicio después del final.
- `src/midi/exportArrangement.ts`: mismo render para MIDI, marcadores y final del SMF con silencio.

Se usa `midi-file`, que ya estaba instalado como dependencia de pruebas y transitiva de `@tonejs/midi`; se declara ahora también como dependencia directa de producción para escribir el final del archivo. No se incorporan paquetes nuevos ni cambian sus versiones resueltas. El encoder de `@tonejs/midi` no escribe `endOfTrackTicks`, por eso se ajusta End Of Track al serializar el SMF final.

Ver [verificación y límites](verification-phase6.md).

## Ampliación v0.7.0

La estructura incorpora un Gantt proporcional, colores por instrumento, plantilla con entradas y salidas y versiones independientes de frases. Los vínculos antiguos continúan reproduciendo V1; los bloques nuevos pueden seleccionar copias. Consulta la [guía de estructura visual](visual-arrangement.md).
