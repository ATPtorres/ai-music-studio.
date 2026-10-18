# AI Music Studio

Asistente de composición musical desarrollado por fases, sin pagos obligatorios. **v0.5.0 — Fase 5: letras y asistencia IA opcional**. Conserva los proyectos JSON v1 anteriores y los generadores de acordes, melodías y bajos.

## Ejecutar

Node.js 22.12+ y npm. No necesita PHP, base de datos, registro, muestras externas ni clave API.

```sh
npm ci
npm run dev
```

Abre la URL que imprime Vite (normalmente http://127.0.0.1:5173/). Aunque la carpeta esté en XAMPP, el desarrollo se sirve con Vite. No publiques la raíz del repositorio por Apache. Para revisar producción: `npm run build` y `npm run preview`.

## Probar la Fase 2

1. Abre **Acordes** en el lateral o su tarjeta en Estudio/Herramientas.
2. Elige tonalidad, mayor/menor natural, género, emoción, 2–16 compases, complejidad, tríadas/séptimas y compás. Pulsa **Generar progresión**. Los ajustes se aplican al generar, sustituyendo la progresión anterior.
3. Cada tarjeta muestra símbolo, grado, notas y duración. Cambia el grado y la duración; las notas y los inicios siguientes se actualizan. Medio compás y compases extendidos son válidos.
4. Pulsa **Reproducir** tras un gesto de usuario. Prueba **Pausar**, **Reanudar**, **Detener**, repetición y volumen. El sonido es síntesis triangular sencilla, no un piano muestreado.
5. Cambia BPM (30–300) y confirma con Enter o saliendo del campo. Editar acordes o tempo detiene la reproducción. Volumen y loop se pueden cambiar durante la escucha. Abandonar el módulo detiene y libera sus nodos.
6. **Descargar MIDI** produce un `.mid` SMF de acordes con tempo, compás, programa de piano y canal. Se puede importar en un DAW. Es información musical, no audio WAV/MP3.
7. Recarga y vuelve a Acordes: la pista permanece en el proyecto. Exporta JSON desde Proyectos, crea otro proyecto e importa la copia para restaurar sus notas y parámetros.

Ejemplos generados con el motor real: [MIDI de cuatro compases](docs/examples/acordes-demo.mid) y [proyecto JSON importable](docs/examples/proyecto-demo.json). Cmaj7 → Em7 → Fmaj7 → G7, 100 BPM, 4/4.

Si ya hay acordes, los controles de tonalidad/modo/compás de Estudio remiten al generador para no etiquetar notas antiguas con otra tonalidad. Género/emoción usan familias de plantillas armónicas, no arreglos estilísticos completos. El modo base menor es natural. La biblioteca de Fase 4.5 permite acordes prestados y dominantes aplicadas de forma opcional. Las notas muestran equivalentes con sostenidos; no se implementa ortografía enarmónica teórica completa.

## Probar la Fase 3

1. Crea una progresión en Acordes. Abre **Melodías** o **Bajos** desde el lateral o las tarjetas de herramientas.
2. Configura registro (nota grave/aguda), densidad, ritmo y complejidad; pulsa Generar. En bajo hay fundamentales largas, pulso, síncopa y walking simplificado. En notas largas no se usa densidad.
3. Selecciona una nota del **piano roll** con clic o Tab/Enter. Edita altura, inicio, duración y velocidad; confirma números con Enter o al salir del campo. Los tiempos usan negras desde cero. Una línea es monofónica: se rechazan solapamientos y notas fuera del final.
4. Pulsa un hueco del roll para añadir media negra o usa **Añadir nota**, que busca el primer hueco de esa duración. Puedes eliminar la nota seleccionada. El roll muestra ocho compases por página y permite desplazamiento horizontal/vertical.
5. **Variar frase** cambia pitches conservando ritmo y velocidades. **Regenerar línea** reemplaza las notas. El registro y los demás ajustes aplicados se guardan con la pista.
6. Escucha sola o marca **Con acordes** y, si existe, **Con bajo/melodía**. Play, pausa, reanudación, stop y repetición comparten un único reloj. Volumen y mute de la línea funcionan durante el preview. Cambiar notas, BPM o acompañamiento lo detiene.
7. Descarga MIDI individual o con las pistas seleccionadas. Silenciar una pista no elimina sus notas del MIDI. Los canales se conservan; se impide exportar juntas pistas importadas que comparten canal.
8. Exporta/importa el proyecto JSON o recarga: se conservan notas, mezcla y parámetros de generación aplicados. Los cambios de configuración sin generar son un borrador y no se guardan.

Si cambias acordes después de generar líneas, sus notas **no se borran ni se rehacen solas**. Aparece un aviso por referencia armónica diferente; regenera cuando quieras adaptarlas. Las ediciones manuales pueden salir de la escala y se conservan tal como las escribas.

Ejemplos de esta fase: [proyecto importable con tres pistas](docs/examples/proyecto-fase3.json), [MIDI de melodía](docs/examples/melody-demo.mid), [MIDI de bajo](docs/examples/bass-demo.mid) y [MIDI con acompañamiento](docs/examples/fase3-acompanamiento.mid).

## Probar la Fase 4

1. Abre **Batería**. Funciona sin acordes, sin IA y sin conexión a servicios. Elige uno de los diez géneros y de 1 a 8 compases; genera un patrón o empieza vacío.
2. La cuadrícula muestra un compás a resolución de semicorchea: 16 pasos en 4/4, 12 en 6/8, 14 en 7/8. Cambia de compás con las flechas o el selector.
3. Clic activa/desactiva un golpe. **Mayús+clic** selecciona sin cambiarlo. También puedes seleccionar con Tab y editar su velocidad MIDI (0 apaga; 1–127 activa). El selector de instrumento permite elegir la fila del golpe seleccionado.
4. **Swing** retrasa la segunda semicorchea de cada pareja; modifica el tiempo real de los golpes, también en MIDI. **Variar patrón** cambia un golpe conservando los demás. **Vaciar patrón** pide confirmación.
5. Prueba Play/Pause/Stop, loop, BPM, volumen y silencio. Editar pasos, swing, tempo o acompañamiento detiene el preview; volumen, mute y loop se pueden modificar mientras suena. Al reanudar no se vuelve a disparar un golpe de percusión que ya había empezado.
6. Marca **Con acordes / melodía / bajo** para escuchar cuatro pistas con un reloj. La batería repite su ciclo hasta completar la frase más larga seleccionada, redondeada a compases del patrón.
7. Descarga **MIDI de batería** para un ciclo original, o **MIDI con acompañamiento** para las pistas seleccionadas y sus repeticiones. Canal humano 10 (índice 9), velocidades y swing incluidos. Mute/volumen de preview no eliminan notas del archivo.
8. Recarga o exporta/importa JSON: se conservan pasos, velocidades, swing, género y longitud aplicados. Cambiar el compás global no transforma una batería existente: aparece un aviso para regenerarla cuando quieras.

El mapa de seis instrumentos es fijo: kick 36, snare 38, clap 39, hi-hat cerrado 42, abierto 46 y shaker/maracas 70. Los sonidos son sintetizados, sin muestras ni bancos de pago. Para una batería importada sin cuadrícula se conserva preview/MIDI; generar un patrón la reemplaza. Las notas importadas fuera de este mapa se conservan en MIDI, con un aviso de que el preview no las reproduce.

Consulta [detalle de Fase 4](docs/phase4.md) y [verificación y límites](docs/verification-phase4.md). El editor de letras se incorpora en Fase 5; el arreglo por secciones sigue pendiente.

Ejemplo de esta fase: [proyecto con cuatro pistas](docs/examples/proyecto-fase4.json), [MIDI de batería](docs/examples/bateria-demo.mid) y [MIDI con acompañamiento](docs/examples/fase4-acompanamiento.mid). En el proyecto, abre Batería y selecciona las otras pistas para escuchar el conjunto.

## Probar la Fase 4.5

1. Abre **Biblioteca**: 36 recetas armónicas y 32 fichas de consulta, incluidas 12 escalas, recursos de melodía, ritmo, estructura y letras.
2. Busca una receta y pulsa **Preparar en Acordes**. Se prepara un borrador compatible; el proyecto cambia al pulsar **Generar progresión**.
3. En Acordes, activa **Usar biblioteca creativa**. Prueba selección automática, exploración, tensión, movimiento armónico, color opcional, conducción de voces y extensiones de novena. Una receta fija conserva su recorrido; los tres deslizadores orientan la selección automática.
4. Escucha, edita y exporta. La ficha aplicada explica el punto de partida y queda marcada si editas la progresión. Para usar el motor anterior, desactiva la biblioteca y genera.

Esta primera entrega conecta automáticamente **Acordes**. Las demás categorías son consulta; su integración con motores nuevos sigue pendiente. La biblioteca local no necesita API key. La asistencia de letras opcional de Fase 5 se configura aparte en el servidor. Las puntuaciones son heurísticas, no garantías de calidad o emoción.

Detalles, compatibilidad y siguientes entregas en [Fase 4.5](docs/phase4.5.md); alcance de pruebas en [verificación](docs/verification-phase4.5.md). Ejemplo: [JSON importable](docs/examples/proyecto-biblioteca.json) y [MIDI de biblioteca](docs/examples/biblioteca-demo.mid).

## Probar la Fase 5

1. Abre **Letras e IA**. Añade secciones y escribe título y letra; el guardado es local y automático.
2. Indica un tema y prepara una **guía local**, sin cuentas ni claves. Es un ejercicio de escritura por secciones, no una letra generada por IA.
3. Revisa el borrador y pulsa **Aplicar borrador al proyecto**. Se pide confirmación antes de reemplazar texto; las pistas y los compases existentes se conservan.
4. Edita, recarga y exporta/importa JSON para comprobar la persistencia. **Descargar letra TXT** exporta solo el texto.
5. Gemini es opcional y necesita Netlify Functions y cuotas persistentes en Redis. Sin esa configuración, los fallos producen una guía local identificada; no se sobrescribe texto automáticamente.

Detalles y activación: [Fase 5](docs/phase5.md). Evidencia y limitaciones: [verificación](docs/verification-phase5.md). No se ha probado todavía una llamada real a Gemini ni un despliegue Netlify: en esta sesión no hay cuentas ni credenciales configuradas.

## Arquitectura vigente

- `src/features/lyrics/`, `src/services/ai/`, `server/lyrics.ts` y `netlify/functions/lyrics.ts`: edición de letras, proveedores y endpoint con cuotas persistentes.
- `src/knowledge/` y `src/features/knowledge/`: catálogo validado, búsqueda, selector, contexto acotado y explorador.
- `src/music/knowledgeHarmony.ts`: préstamos, dominantes aplicadas y conducción de voces.
- `src/models/`: formato v1, esquemas estrictos y tipos musicales.
- `src/state/` y `src/services/`: estado, persistencia, importación y exportación JSON.
- `src/music/harmony.ts`: escalas, tríadas/séptimas, plantillas con semilla, inversiones y sincronización de notas.
- `src/audio/ChordPlayer.ts`: transporte Tone.js y ciclo de vida del preview.
- `src/midi/exportChords.ts`: exportación SMF con @tonejs/midi.
- `src/features/chords/`: editor, controles y pruebas de interacción.
- `src/music/lines.ts`: generación y variación de melodías/bajos, rangos, monofonía y referencias armónicas.
- `src/features/lines/`: controles, piano roll accesible y edición de eventos MIDI.
- `src/audio/TrackPlayer.ts`: preview sincronizado de hasta tres pistas, con limpieza al salir.
- `src/midi/exportTracks.ts`: MIDI individual o con acompañamiento seleccionado.
- `src/music/drums.ts` y `src/features/drums/`: patrones, swing, secuenciador y repetición al acompañar.
- `src/audio/DrumKit.ts`: seis sonidos de percusión sintetizados y cierre del hi-hat abierto.

Los módulos se cargan bajo demanda. Los motores son locales y no dependen de IA. Se edita la primera pista de cada tipo, conservando las adicionales importadas. El preview de cuatro pistas en Batería es un apoyo para componer; todavía no hay arreglo por secciones ni transporte de un estudio completo. El editor de letras de Fase 5 reutiliza las secciones del proyecto sin arreglar sus clips.

## Verificación

```sh
npm test
npm run lint
npm run build
```

118 pruebas en 20 archivos: biblioteca/selector, armonía ampliada, contexto acotado, teoría, esquemas/persistencia, armonía, melodías/bajos, patrones y swing, generación/edición en DOM simulado, transporte/kit con Tone simulado y lectura binaria de MIDI individual/multipista. Consulta [verificación de Fase 4.5](docs/verification-phase4.5.md) para distinguir lo comprobado de la revisión auditiva, visual y en DAW pendiente. En el aislamiento Windows de esta sesión Vitest requiere permiso para sus temporales; fuera de ese aislamiento `npm test` pasa.

## Datos y seguridad

Un proyecto activo por navegador en localStorage, con importación validada hasta 2 MB. Sin sincronización remota ni entre pestañas. Exporta respaldos JSON: borrar los datos del navegador elimina su copia. No incluir credenciales en proyectos.

El editor manual, la guía local y los motores musicales no requieren variables. Gemini es opcional: `GEMINI_API_KEY`, `GEMINI_MODEL`, `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` se configuran solo en Netlify Functions. La IA permanece bloqueada sin cuotas persistentes y credenciales válidas. Nunca usar `VITE_` para secretos. `.env` está excluido de Git. Ver [Fase 5](docs/phase5.md).

Más documentación: [arquitectura y riesgos](docs/architecture.md), [plan por fases](docs/roadmap.md), [GitHub y Netlify](docs/deployment.md).
