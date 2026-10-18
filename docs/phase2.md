# Fase 2: módulo de acordes

## Decisiones musicales

Motor puro TypeScript: escala mayor o menor natural, terceras diatónicas para tríadas y séptimas, grados y pitch MIDI. Plantillas generales por familia: jazz/R&B/funk, rock y pop/urbana/electrónica/latina; emoción contemplativa o enérgica. No se pretende que una secuencia de bloques imite el ritmo o la producción de todos esos géneros. Complejidad intermedia sustituye funciones; avanzada añade inversiones. La semilla reproduce el contenido musical, aunque los IDs son nuevos. Regenerar evita repetir exactamente las mismas voces mediante una inversión alternativa cuando es necesario.

Los ajustes de generación son un borrador hasta pulsar Generar/Regenerar. Entonces parámetros globales y pista se actualizan juntos. La regeneración conserva el ID de pista y por tanto las referencias de secciones. La edición de duración reajusta inicios consecutivos; modificar grado conserva la duración.

En v1 los acordes y notas están en la misma pista. **La lista de acordes es la fuente del módulo armónico**: sus pitches, start y duration se convierten a notas al generar/editar y al exportar MIDI. Los futuros motores de melodía y bajo podrán consumir la pista guardada. No hay botones de envío a módulos que todavía no existen.

## Audio

Tone.js 15.1.22, transporte único con PPQ propio, Part de eventos en ticks y PolySynth de onda triangular. Cada duración se convierte de negras a segundos según BPM; 6/8 contiene tres negras por compás. Un gesto de usuario inicializa Web Audio. Play/Pause/Stop y loop usan el transporte; reanudar vuelve a atacar los acordes que quedaron a medias. El fin sin loop cambia el estado a detenido. Editar notas, regenerar o cambiar BPM detiene el preview; loop y volumen no lo interrumpen.

El desmontaje detiene el transporte y libera Part, sintetizador y ganancia. Un número de solicitud cancela inicios pendientes si se pulsa Stop o se abandona el módulo mientras Web Audio inicia. Este reproductor es solo de acordes; el transporte multipista llegará en Fase 6. No implementa metrónomo ni mezcla de varias pistas.

El preview limita proyectos importados a 256 acordes y un final de 65.536 negras para no programar arreglos arbitrariamente grandes. El generador produce como máximo 16 acordes. Si falla la creación del grafo de audio también se liberan los recursos parciales.

## MIDI

@tonejs/midi 2.0.28 escribe SMF tipo 1 con pista de metadatos y pista de notas, 480 PPQ, tempo, compás y programa 0 (piano GM). Se conserva el canal no percusivo de la pista, con Note On/Off para cada voz, velocidad 88 y mínimo de un tick. Se rechazan tiempos que exceden el rango de exportación. El archivo usa todas las notas de la progresión, independientemente del volumen de preview o si está silenciada.

Pruebas con `midi-file` inspeccionan la firma MThd, metadata, canal y eventos; una segunda lectura con `Midi` comprueba pitches y duración en segundos. No se ha realizado una importación manual en DAW desde esta sesión.

## Licencias y costo

Tone.js, @tonejs/midi y midi-file: MIT según sus package.json instalados. No hay muestras, servicios, claves ni peticiones a IA para componer. happy-dom es una dependencia solo de desarrollo para probar el editor sin un navegador real.

Referencias de implementación: [Tone Transport](https://github.com/tonejs/tone.js/wiki/Transport), [Tone events](https://github.com/tonejs/tone.js/wiki/Events), [@tonejs/midi](https://github.com/Tonejs/Midi).
