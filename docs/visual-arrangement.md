# Estructura visual y variantes · v0.7.0

## Probar el editor

1. Genera acordes, bajo, melodía y batería, o importa [el proyecto de ejemplo](examples/proyecto-estructura-visual.json).
2. Abre **Estructura**. La regla muestra compases y los bloques tienen un ancho proporcional: ocho compases ocupan el doble que cuatro. **Zoom** permite elegir entre tres escalas.
3. Cada fila es un instrumento: batería azul, bajo rojo, acordes verde y melodía naranja. Los nombres e iconos acompañan el color. Un proyecto normal tiene cuatro filas; las pistas adicionales importadas conservan sus propias filas.
4. En cada bloque elige **V1 · Original**, una variante o **Silencio**. Quitar un bloque no borra su frase. Los selectores bajo el editor de sección ofrecen las mismas acciones para celular o teclado.
5. **Aplicar plantilla dinámica** crea Intro (4), Verso 1 (8), Coro (8), Break (4), Verso 2 (8), Coro final (8) y Outro (4). Intro/Outro utilizan acordes y melodía; versos y coros agregan la base rítmica; el Break deja acordes. Verso 2 usa batería, bajo y melodía y selecciona la primera variante disponible de bajo y melodía. Si no existe, usa V1. Solo utiliza instrumentos existentes (hasta 16 pistas, ordenadas por instrumento); el aviso enumera los que faltan.
6. La plantilla pide confirmación antes de reemplazar secciones y letras existentes. Exporta un JSON si quieres conservarlas. Las pistas y variantes no se eliminan.
7. Selecciona una cabecera de sección para cambiar nombre, compases y letra, escuchar desde allí o duplicar, mover y eliminar la sección completa. El orden de los bloques sigue ese orden.
8. Reproduce el arreglo. El cursor avanza sobre la regla con la posición del transporte; al pausar conserva su posición. Los volúmenes y silencios se ajustan en directo. Cambiar bloques, frases, sonidos o compases detiene el audio. La línea de tiempo se desplaza manualmente; no hay seguimiento automático del cursor.

## Biblioteca de frases

- **V1** es la pista original: los cambios de su generador actualizan todas las secciones que usan V1. Cada generador enumera las secciones afectadas.
- **Duplicar para editar** crea una copia independiente, inicialmente V2. Copia las notas canónicas del acorde o patrón y la duración de su ciclo, incluidas las pausas finales. La copia no cambia al regenerar el original.
- **Crear variación** crea otra copia sin sobrescribir la anterior. En bajo/melodía cambia alturas usando los acordes originales y exige que la frase tenga la referencia armónica actual. En acordes cambia una voz de octava; conserva las clases de altura. En batería cambia acentos y agrega un pequeño fill de caja cuando hay espacio. Son reglas locales, sin API.
- Selecciona un instrumento y una frase en la biblioteca, o pulsa **Editar frase** dentro de un bloque. **Asignar a…** coloca esa frase en la sección seleccionada. Para escucharla, usa **Reproducir desde esta sección**.
- Renombra la copia y ajusta su ciclo (sin dejar notas fuera). Edita o añade notas en el piano roll o mediante los controles de nota, inicio, duración y velocidad. Las notas del bajo y melodía no pueden solaparse. En batería se admite el mapa de seis golpes y se rechazan hi-hats abierto/cerrado que empiecen juntos.
- La biblioteca enumera las secciones que comparten una frase. Editarla actualiza esos bloques. Duplica primero si quieres cambiar una sola copia.
- **Eliminar variante** pide confirmación e indica cuántas secciones la usan. Sus bloques pasan a silencio; V1 y las otras copias se conservan.
- El sonido, volumen, silencio y canal pertenecen al instrumento completo. Cambiar de frase cambia las notas, no el timbre por sección.

Las variantes melódicas se generan contra la progresión original del proyecto, no contra una progresión distinta en cada sección. El arreglo avisa cuando se utiliza una variante de acordes junto a bajo/melodía o cuando una frase no tiene una referencia armónica vigente. Editar notas manualmente elimina esa referencia: el aviso invita a revisar, sin cambiar ni borrar notas. No se garantiza que una combinación manual resulte armónicamente adecuada.

## Datos y compatibilidad

El formato JSON sigue siendo v1 y acepta los proyectos anteriores sin reescribir sus eventos:

- `track.variants?`: hasta 32 copias por pista, además de V1. Cada copia tiene `id`, `name`, `beats`, `notes` y `sourceHarmony?`. Los nombres son únicos dentro de la pista; V1 está reservado.
- `section.trackIds`: continúa definiendo los instrumentos activos.
- `section.variantIds?`: mapa de identificador de pista a identificador de variante. Sin entrada se utiliza V1. Cada entrada debe corresponder a una pista activa y a una variante existente.
- Una copia admite hasta 4096 notas y 4096 negras; el editor de ciclo limita además a 512 compases. El proyecto mantiene el límite de 2 MB, 100 pistas y 100 secciones. El arreglo conserva los límites de 16 pistas vinculadas, 15000 notas renderizadas y 4096 negras.

Los generadores preservan `variants` al reconstruir la pista original. Duplicar o mover secciones conserva sus asignaciones y letras; aplicar otro borrador de letras también conserva los vínculos y variantes de las secciones existentes por posición.

La lectura anterior se mantiene; una versión antigua de la aplicación con esquema estricto puede rechazar un JSON nuevo con variantes. Exporta una copia y usa esta rama para abrirlo. No hay sincronización automática entre dispositivos: traslada el JSON o usa el mismo proyecto local con cuidado de no sobrescribirlo en otra pestaña.

`variantClip` resuelve la fuente de cada bloque. `renderArrangement` repite ese ciclo y recorta las notas al final de la sección. Tanto el preview como el MIDI consumen los mismos eventos renderizados. La exportación conserva canales, programas de sonido, velocidades y marcadores, y no añade notas para representar el silencio final. El MIDI no contiene las variantes que no se hayan asignado. No incrusta el audio del sintetizador.

## Verificación

- 164 pruebas en 26 archivos aprobadas, compilación de producción y ESLint sin errores. Incluyen copias independientes, asignación/silencio, persistencia compatible, referencias inválidas, monofonía, mapa de percusión, conservación al regenerar, plantilla y edición en DOM.
- Lectura del MIDI exportado para contrastar alturas, tiempos y duraciones de las variantes con el render del arreglo.
- Chromium con Web Audio real: creación de V2, plantilla y cancelación, proporción de anchos y zoom, cursor en reproducción/pausa, cambios de bloques, edición de velocidad, exportación MIDI, exportación/importación JSON y recarga.
- Revisión visual de escritorio (1440 px) y vista móvil (390 px), sin desbordamiento horizontal de la página. El Gantt y el piano roll tienen desplazamiento propio.
- Pendientes: escucha humana, pruebas en un DAW, Safari y dispositivos móviles físicos.
