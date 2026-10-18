# Fase 4.5 — Biblioteca creativa, primera entrega

Esta entrega amplía la base local y conecta su primer consumidor: Acordes. No entrena un modelo ni conecta Gemini. La biblioteca es una colección finita, revisable y ampliable; añadir volumen por sí solo no garantiza mejores composiciones.

## Disponible en v0.4.5

- **68 entradas:** 36 recetas armónicas (18 mayores, 18 menores) y 32 fichas: 12 escalas, 2 conceptos armónicos, 5 recursos melódicos, 4 rítmicos, 4 de estructura y 5 de escritura de letras.
- Explorador con búsqueda sin distinción de acentos, filtros, explicación, ejercicio y procedencia. Las recetas preparan un borrador en Acordes. Las demás fichas se identifican como consulta.
- Selección automática por modo, complejidad mínima, familia de género, emoción y controles de exploración, tensión y movimiento armónico. Son etiquetas y heurísticas editoriales, no medidas objetivas de emoción o calidad. Género/emoción orientan la selección, sin producir arreglos estilísticos completos.
- Color opcional: diatónico, préstamos del modo paralelo, dominantes aplicadas o ambos. Permitir un color no obliga a usarlo. Una receta fija elude la selección ponderada; los tres deslizadores orientan únicamente el modo automático.
- Tríadas, séptimas y novenas diatónicas con identificación de novena bemol cuando corresponde. Los cromatismos se habilitan explícitamente. La escala global continúa siendo mayor o menor natural; las otras diez escalas son consulta, sin activación modal.
- Conducción de voces opcional: elección local de inversiones y desplazamientos de octava para reducir la suma de saltos entre voces ordenadas, en registro MIDI 36–84. Es un algoritmo voraz, sin garantía de contrapunto clásico ni mínimo global.
- Referencia de receta, versión, controles aplicados, semilla, selección fija/automática y marca de edición manual dentro de la pista. JSON y MIDI conservan las notas reales, incluidos cromatismos y extensiones.

## Uso

1. Abre **Biblioteca**. Filtra Armonía y pulsa **Preparar en Acordes** en una receta. Se ajustan modo, complejidad mínima y color del borrador; se conserva la tónica elegida en el proyecto.
2. Ajusta tónica, longitud, tipo de acorde y demás controles. **Generar progresión** aplica el borrador. **Regenerar** reemplaza los acordes; la opción automática evita la última receta si hay alternativas. Una receta fija puede producir exactamente las mismas notas.
3. Revisa la ficha de partida, escucha y edita. La edición conserva la referencia como procedencia, marcándola como modificada. No se afirma que una progresión editada siga cumpliendo la receta.
4. Exporta JSON para conservar datos y ajustes, o MIDI para llevar las notas al DAW. Los ajustes de borrador se descartan al salir sin generar.
5. Para comparar con el motor anterior, desmarca **Usar biblioteca creativa** y genera. Un proyecto anterior no cambia sus notas al abrirse.

Un acorde ocupa un compás al generar; el ciclo de la receta se repite o recorta a la longitud pedida. Por ello un fragmento puede terminar antes de resolver su dominante aplicada. Cambiar duraciones después permite modificar el ritmo armónico. El control Movimiento puntúa el recorrido de la receta, no densidad rítmica ni tempo.

Las melodías y bajos existentes se conservan al reemplazar acordes y muestran el aviso de armonía desactualizada. Al regenerar líneas, el motor existente usa notas de los acordes en los apoyos y la escala global en ciertos pasos; todavía no implementa una escala particular para cada acorde prestado. La batería conserva su motor anterior.

## Arquitectura y compatibilidad

- `src/knowledge/data/library.v1.json`: contenido original estático, fuentes y etiquetas.
- `src/knowledge/schema.ts`: validación estricta, procedencia, unicidad de identificadores/secuencias, intervalos ordenados y resolución de dominantes dentro del ciclo completo.
- `src/knowledge/catalog.ts`: filtros duros y puntuación, sorteo con semilla, preparación de recetas, búsqueda y contexto acotado para un futuro proveedor.
- `src/music/knowledgeHarmony.ts`: realización por tónica/modo y conducción de voces. `harmony.ts` mantiene el motor básico cuando no se pide biblioteca.
- `src/features/knowledge/`: explorador; `src/features/chords/`: controles y explicación de la receta aplicada.

El proyecto sigue en JSON v1 con metadatos `harmonyKnowledge` opcionales exclusivamente en la pista de acordes. La versión actual importa proyectos anteriores sin migrarlos ni rehacer sus notas. Una aplicación antigua con esquema estricto puede rechazar el nuevo campo: esta compatibilidad es hacia atrás, no una promesa de lectura por versiones antiguas. Una referencia de receta desconocida no impide recuperar las notas; la interfaz muestra el identificador y permite pasar a selección automática.

No hay nuevas dependencias, servicios, credenciales ni solicitudes de red para generar. Las referencias externas se abren únicamente al pulsar sus enlaces. El catálogo se carga bajo demanda con los módulos musicales o el explorador.

`buildKnowledgeContext` prepara datos JSON, sin llamar a un modelo: máximo 6 recursos y presupuesto de 512–10000 caracteres serializados (4000 por defecto). Esto no equivale a tokens ni a una integración RAG completa. Su futura conexión debe validar entradas y salidas, tratar el contenido como datos y mantener las claves en servidor.

## Procedencia y ampliación

Redacción, ejercicios y recetas preparados para el proyecto, sin transcribir canciones ni importar letras, libros o catálogos. Los patrones representan funciones musicales generales. La licencia de distribución la decide el propietario del proyecto.

Referencias conceptuales: Open Music Theory sobre [mezcla modal](https://viva.pressbooks.pub/openmusictheory/chapter/modal-mixture/), [tonicización](https://viva.pressbooks.pub/openmusictheory/chapter/tonicization/) y [teoría del jazz](https://viva.pressbooks.pub/openmusictheory/part/jazz/). No se copió su contenido a la colección.

Para añadir una entrada: asignar ID único, fuente real, explicación propia, ejercicio y etiquetas; en recetas, declarar modo, complejidad y criterios, comprobar realización musical y agregar pruebas cuando introduzca una capacidad nueva. La validación automática detecta errores estructurales; la selección editorial y la escucha siguen siendo necesarias.

## Próximas entregas de la ampliación

1. Biblioteca y Acordes: implementados aquí, con revisión visual/auditiva manual pendiente.
2. Consumidores de motivos, fraseo, ritmos, bajos y batería: pendientes. Sus fichas ya pueden consultarse.
3. Más escalas activas, formas por secciones y evaluación de diversidad musical: pendientes; añadir pruebas y escucha antes de activar categorías nuevas.
4. Contexto de escritura/forma conectado al servidor de letras en [Fase 5](phase5.md). Su activación real con Gemini sigue pendiente de credenciales y despliegue. La biblioteca y la guía local no necesitan API key.
