# Estructuras aleatorias con conocimiento musical — 20 de octubre de 2026

El generador reemplaza la antigua plantilla fija de siete secciones. La colección contiene **24 recetas en ocho familias**, cada una con explicación propia, ejercicio, afinidades de género/emoción, grado de exploración y un plan de grupos, proporciones y capas por sección. Biblioteca permite consultarlas y abrir Estructura; el catálogo completo reúne 92 recursos.

| Familia | Recetas |
| --- | --- |
| Verso/coro (6) | Regreso con puente, pre-coro, gancho inicial, post-coro, doble coro final, dos ciclos compactos |
| Canción AABA/ABAC (3) | AABA, AABA con reprise, ABAC |
| Estrófica (3) | Tres estrofas, estrofas con respuesta breve, estrofas con interludios |
| Ternaria (2) | ABA, ABA con coda |
| Rondó (2) | ABACA, ABACABA |
| Electrónica (4) | Dos drops, tres olas, crecimiento por capas, entrada/salida para mezcla |
| Desarrollo continuo (2) | Desarrollo sin vuelta literal, arco de acumulación y retirada |
| Llamada/respuesta (2) | Diálogo con respiro, diálogo con solo |

Estas son propuestas de diseño, no reglas universales de un estilo. Las familias de género son afinidades de selección, sin bloquear la exploración de otras formas.

## Uso

1. Genera pistas y, si quieres contrastes melódicos, crea algunas variantes en Biblioteca de frases. Abre **Estructura**.
2. Deja familia y receta en automático o fija una de ellas. Elige **Frase principal** de 4, 8 o 16 compases. Ajusta Exploración: valores bajos favorecen recetas familiares y altos otras menos convencionales. El control se desactiva al fijar receta, porque ya no se sortea la forma.
3. Pulsa **Generar estructura aleatoria**. Los ajustes anteriores son un borrador; no cambian tus secciones hasta generar.
4. **Generar otra estructura** pide confirmación para reemplazar secciones y sus letras. Las pistas originales, variantes, sonidos, mezcla y parámetros se conservan. Cancelar conserva todo el proyecto.
5. La ficha aplicada explica la receta y propone un ejercicio. Edita cualquier bloque o asigna otra variante. Si cambia el orden, nombre, fraseo o asignación, la ficha señala que es una estructura editada.
6. Escucha y exporta JSON o MIDI. El JSON conserva la receta, semilla y controles aplicados; los MIDI llevan secciones, marcadores y notas renderizadas, sin depender de la receta para abrirse.

## Aleatoriedad y coherencia

La selección automática usa un sorteo ponderado por género, emoción y distancia al nivel de exploración. No cambia únicamente los nombres: las recetas tienen secuencias, longitudes relativas y planes de capas distintos. Se excluye la última receta aplicada si hay alternativas en la familia; una receta fijada se conserva deliberadamente.

Una semilla explícita permite reproducir forma, compases, asignaciones y variantes en un mismo proyecto. Los IDs de secciones se crean nuevos para conservar su independencia. La interfaz obtiene una semilla nueva de `crypto.getRandomValues`; no se necesita API ni conexión.

Los grupos A/B/C representan materiales que reaparecen. Las reapariciones conservan su longitud relativa; una introducción solo puede estar al comienzo y una salida al final. Un pre-coro lleva a un coro y una subida a un drop. La energía es un plan de **capas**, no una medición objetiva de intensidad sonora ni una automatización de volumen.

El primer grupo musical usa los originales. Otros grupos prefieren variantes aún no utilizadas cuando hay material suficiente. Pueden usar variantes de bajo/melodía con referencia armónica vigente y variantes de batería con notas. Si un grupo vuelve, reutiliza su selección de variantes. Los acordes permanecen en V1 para no asignar automáticamente una armonía editada incompatible con las líneas. Las entradas/salidas de capas pueden variar entre apariciones. Los clips se repiten y recortan según la semántica existente del arreglo.

Se vinculan solamente originales con notas, hasta 16 pistas, ordenados por tipo. Si falta un instrumento, se usan los disponibles y se evita dejar secciones vacías accidentalmente. Sin pistas se genera una forma editable y se avisa de que aún no puede sonar.

Antes de aplicar se comprueba el render completo. Si la densidad o duración excede sus límites, se reduce la frase principal por pasos de 16/8/4/2, conservando las proporciones y el final de la receta, y se muestra un aviso. Si no cabe ni así o hay un clip inválido, se informa del error y se conserva la estructura anterior. No se ajusta automáticamente a los segundos objetivo del proyecto.

## Qué no compone automáticamente

Una forma AABA o un rondó necesita material contrastante para distinguir realmente A de B/C. El motor organiza los clips disponibles; **no escribe nuevas melodías, acordes, transiciones, fills ni letras**. Sin variantes compatibles, el contraste se limita principalmente a las entradas/salidas y longitudes. El aviso y los ejercicios invitan a preparar frases diferentes.

La planificación no garantiza cierres armónicos, modulaciones, ausencia de cortes de frase en todo compás ni calidad estética. El renderer puede recortar el ciclo original al final de una sección. Revisa con el oído los puntos de entrada y salida; puedes ajustar sus compases manualmente.

## Datos y procedencia

- `src/knowledge/data/structures.v1.json`: colección original versionada y referencias.
- `src/knowledge/structureSchema.ts`: esquema estricto, opciones y metadatos ligeros; valida IDs, procedencia, secuencias diferentes, transiciones y proporciones.
- `src/knowledge/structures.ts`: carga validada y búsqueda sin distinción de acentos.
- `src/arrangement/structure.ts`: selección, realización, recursos y huella de las secciones.
- `src/features/arrangement/StructureGenerator.tsx`: controles y ficha explicativa.

El proyecto sigue en JSON v1, con `structureGeneration` opcional. Esta versión abre archivos anteriores sin añadirles el campo hasta generar. Los lectores antiguos con validación estricta podrían rechazar ese nuevo metadato. Una receta no instalada no impide recuperar las secciones almacenadas; la interfaz muestra el identificador y permite volver a selección automática. La huella es una comprobación de procedencia, no un hash de seguridad; no incluye letras ni mezcla.

Redacción y ejercicios propios, sin transcribir canciones ni copiar ejemplos musicales de las referencias. La licencia del proyecto la decide su propietario. Como apoyo conceptual se consultaron [Ableton Learning Music: estructura](https://learningmusic.ableton.com/song-structure/song-structure.html), [University of Puget Sound: AABA](https://musictheory.pugetsound.edu/mt21c/AABAForm.html) y [rondó](https://musictheory.pugetsound.edu/mt21c/RondoForm.html). La colección también registra la referencia introductoria de Open Music Theory; las variantes editoriales no se atribuyen como reglas de esos textos.

## Verificación

- **182 pruebas en 27 archivos**, incluidas las regresiones de sonido/swing anteriores.
- Catálogo de 24 recetas y ocho familias; rechazo de duplicados, fuentes inválidas, saltos de preparación incorrectos y retornos con longitud distinta.
- 120 realizaciones (24 recetas × 4/4, 3/4, 6/8, 7/8 y 12/2), con esquemas, referencias, conservación de fuentes y render válido.
- Reproducibilidad con semilla; exclusión de la receta anterior; al menos 18 formas distintas en 200 semillas de un contexto fijo. El nivel de exploración modifica la distribución de etiquetas de novedad en un muestreo controlado. No es una evaluación estética.
- Retorno AABA, selección de variantes vigentes, proyectos vacíos o con un solo instrumento, ajuste de densidad, metadatos JSON, detección de edición y MIDI con conteo de notas y final binario correcto.
- DOM simulado: borrador, elección explícita de AABA, cambio a automático, confirmación/cancelación, 92 tarjetas, categoría Estructura y navegación al generador.

La escucha y la inspección visual final quedan a cargo de la revisión manual. Ejemplo importable: [proyecto con estructura generada](examples/proyecto-estructura-aleatoria.json) y [MIDI correspondiente](examples/estructura-aleatoria.mid).

Ejemplo generado y leído desde disco: ABACA con introducción/salida, 24 compases, 57,6 segundos a 100 BPM en 4/4; MIDI tipo 1, 480 PPQ, canales 0/1/2/9 y final en tick 46080 para cada pista. El generador avisa si los dos episodios no disponen de suficientes variantes melódicas distintas.
