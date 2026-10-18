# Verificación Fase 4.5 — 18 de octubre de 2026

## Comprobado automáticamente

- **86 pruebas en 17 archivos**: las 69 anteriores y 17 nuevas.
- Biblioteca de 68 entradas, fuentes existentes, ausencia de IDs/secuencias duplicadas, intervalos ordenados y resolución de dominantes en el ciclo completo. Rechazo de catálogos incorrectos.
- Filtros de modo, color y complejidad; preparación compatible de las 36 recetas. Semilla reproducible, exclusión de la receta anterior y más de ocho recetas distintas en 400 semillas de un contexto fijo. Los tres controles afectan las puntuaciones según sus etiquetas. Esto demuestra comportamiento del selector, no una evaluación subjetiva de calidad.
- **1296 realizaciones**: 36 recetas × 12 tonalidades × tríadas/séptimas/novenas; límites de alturas y tiempos en 6/8. Préstamo iv en Do mayor, D7 como V/V y llegada a G7. Novenas diatónicas y nombres con novena bemol.
- Conducción: conservación de clases de altura, reproducción determinista y reducción de saltos en un ejemplo controlado. Sin promesa de mínimo global.
- JSON v1, metadatos opcionales, mezcla, referencias de sección, IDs y notas preservados; recuperación de una referencia desconocida y vuelta al motor básico.
- MIDI real con @tonejs/midi: 20 notas de acordes extendidos, cromatismo y duración conservados. Se mantienen las pruebas anteriores de eventos binarios, canal, tempo y compás.
- DOM simulado con React/happy-dom: 68 tarjetas, filtros, búsqueda sin coincidencias, acción de preparar receta, borrador sin escribir notas, generación cromática, procedencia, marca de edición y desactivación del motor ampliado.
- Presupuesto del contexto JSON respetado y máximo seis entradas. Ninguna integración de IA.
- Lint y compilación de producción correctos; sin nuevas dependencias.
- Auditoría npm completa: **0 vulnerabilidades** en las dependencias actuales.
- Ejemplo generado con el motor real y leído desde disco: `examples/proyecto-biblioteca.json` y `biblioteca-demo.mid`. Cmaj9 → Fmaj9 → Fm9 → Cmaj9, con conducción de voces. SMF tipo 1, 480 PPQ, 100 BPM, 4/4, canal 0, 20 Note On y 20 Note Off, duración 9,6 segundos; incluye la clase de altura La bemol del préstamo.

## Revisión manual pendiente

El acceso al estudio desde el navegador integrado fue bloqueado en Fase 2. No se intentó eludir esa restricción. Esta entrega usa DOM y audio simulados para las pruebas: **no se ha revisado visualmente en navegador/móvil real, escuchado las nuevas progresiones ni abierto el MIDI en un DAW**.

Para completar la revisión: abrir Biblioteca a 390 px y escritorio, buscar y filtrar; preparar una receta prestada y otra con dominante aplicada; comprobar que no se sustituyen notas hasta generar; comparar conducción de voces, tríadas y novenas; escuchar, editar y exportar; recargar/importar el JSON y abrir el MIDI en un DAW. Verificar el aviso de armonía desactualizada en líneas previas y comparar el motor básico desactivando la biblioteca.

Persisten los avisos no bloqueantes de anotaciones de optimización de Zod durante build. La Fase 5 y los consumidores nuevos de melodía/ritmo/estructura/letras permanecen pendientes.
