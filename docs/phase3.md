# Fase 3: melodías y bajos

## Motor local

`music/lines.ts` genera notas MIDI estructuradas en el rango 0–127. La progresión activa define los intervalos temporales; la tonalidad global define la escala mayor/menor natural. La melodía usa notas de acorde al empezar y en posiciones enteras de negra, y puede introducir notas de escala entre ellas. El rango es obligatorio: si no contiene notas de un acorde se devuelve un error, sin trasladar notas fuera del registro.

El bajo busca la fundamental por símbolo (incluye sostenidos/bemoles), incluso con acordes invertidos. En patrones no walking el registro debe contener las fundamentales. Según complejidad puede alternar quinta u otras notas del acorde. Walking es un patrón simplificado por notas del acorde, no una emulación completa de jazz. Hay densidad espaciada/media/alta, pulso regular, síncopa y notas largas; estas últimas ignoran la densidad. La semilla reproduce los resultados. Género/emoción se conservan como contexto compartido; la generación de líneas usa los parámetros explícitos y la armonía, no un modelo de estilo por artista o género.

Cada evento se recorta al final de su acorde. Se admiten duraciones fraccionarias y huecos entre acordes, pero se rechaza una progresión solapada. Límite de generación: 256 acordes, 4096 negras y 4096 notas. No son modelos de IA y no hay llamadas remotas.

## Proyecto y edición

El modelo v1 añade dos propiedades opcionales por pista: `sourceHarmony` (checksum de notas/tiempos de acordes y tonalidad/compás; excluye BPM) y `generation` (registro, densidad, patrón y complejidad). La app actual sigue leyendo proyectos v1 de fases anteriores. Lectores antiguos con esquema estricto pueden rechazar estos campos nuevos; no se garantiza lectura hacia atrás en la versión antigua.

Generar o variar conserva el ID, canal, volumen y mute de la pista, y actualiza su referencia armónica. Modificar una nota manualmente conserva la referencia original para que un cambio de armonía siga avisándose. No se reemplazan melodías/bajos al regenerar acordes. Los ajustes aplicados persisten, los borradores de controles no.

El piano roll usa SVG con selección por ratón/teclado y paginación de ocho compases. Añadir por clic cuantiza el inicio a media negra. El editor permite modificar pitch, start, duration y velocity, eliminar notas y buscar un hueco libre. Las líneas se mantienen monofónicas; se rechazan solapamientos o tiempos fuera del final, mostrando un error y conservando los datos. Una edición manual puede salir de la escala. No hay arrastre de notas; la edición se realiza con los controles de la nota seleccionada.

## Preview y MIDI

`audio/TrackPlayer.ts` comparte un transporte Tone.js entre hasta tres sintetizadores: acordes, melodía y bajo. Los eventos se programan en ticks; las duraciones se convierten con BPM de negras. Pausa libera las voces y reanudar vuelve a atacar solo las que seguían activas en esa posición. Cambiar volumen/mute/loop no reconstruye el transporte; notas, BPM o selección de acompañamiento sí lo detienen. Desmontar el módulo cancela inicios pendientes y libera recursos.

`midi/exportTracks.ts` escribe SMF tipo 1 a 480 PPQ, con tempo, compás y canales independientes. Programa GM de piano para acordes, Lead 1 para melodía y bajo eléctrico para bajo; los previews sintetizados no imitan esos bancos GM. Se permite exportación individual o de la selección de acompañamiento. Se rechazan canales duplicados en una exportación conjunta. El volumen y mute de escucha no eliminan notas del MIDI. No se exportan audio WAV/MP3 ni estructura de canción.

No se añadieron dependencias en esta fase. El módulo se carga bajo demanda y reutiliza Tone.js, @tonejs/midi, Zod y las herramientas de pruebas existentes.
