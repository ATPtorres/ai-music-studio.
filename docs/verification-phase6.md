# Verificación Fase 6 — 19 de octubre de 2026

## Pruebas automáticas

**140 pruebas en 23 archivos**, incluidas las 118 de fases anteriores y 22 nuevas. Comando: `npm test -- --maxWorkers=4`.

- Render: repetición, recorte, silencios entre secciones, reinicio de clips por sección, duración en 4/4, 6/8 y 7/8, swing y ciclo propio de batería, acordes canónicos y notas importadas sin acordes, vínculos duplicados/vacíos y límites de expansión/duración/pistas.
- Compatibilidad: fuentes sin mutar, JSON v1 y letras conservadas; orden de secciones con IDs, vínculos y texto; aplicar un nuevo borrador de letras sin alterar el arreglo musical.
- MIDI real leído con `@tonejs/midi` y `midi-file`: notas/ticks/duraciones/velocidades idénticos al render dentro de la cuantización, cuatro canales/programas, tempo y 6/8, marcadores, End Of Track incluyendo silencio final y Note On/Off balanceados. Rechazo de canales duplicados, arreglos sin sonido y nota que redondea fuera de sección.
- Audio simulado: 16 pistas con un reloj, rechazo de más pistas, posicionamiento, reanudación de notas sostenidas sin volver a disparar percusión pasada y final que libera el grafo/retorna a cero antes de repetir reproducción. Se conservan las pruebas previas de loop, mezcla y limpieza.
- Interfaz en DOM simulado: vínculos, orden, duplicación/eliminación confirmada/cancelada, letra, compases y tempo con validación, mezcla sin reconfigurar el reloj, canales, reproducción desde sección, exportación, accesos a otros editores y liberación al salir.

`npm run lint`, `npm run build` (incluido TypeScript de cliente/servidor/pruebas) y `git diff --check`: correctos. Permanecen los avisos no bloqueantes de anotaciones de optimización de Zod durante build.

## Instalación y navegador en esta máquina

- `npm ci --cache /workspace/.npm --no-audit --no-fund`: correcto con manifiesto y lockfile de 0.6.0, sin paquetes nuevos. Un intento previo de actualizar solo el lockfile en modo offline falló por un artefacto opcional de Tailwind no cacheado; se conservaron las versiones resueltas y la instalación normal posterior pasó.
- Chromium headless con **Web Audio real**, sin mocks de Tone: proyecto existente de cuatro pistas, estructura inicial, edición de duración, letra, reordenación, duplicación, eliminación cancelada/confirmada y desvinculación.
- Reproducir, pausar con reloj estable, reanudar, mezclar durante reproducción sin detener, terminar, comenzar de nuevo, loop más allá del final, reproducción desde una sección intermedia y edición que detiene el transporte. No hubo errores JavaScript. Esto demuestra funcionamiento del transporte en ese navegador, no una revisión auditiva humana.
- Letras compartidas con el editor Fase 5; descarga del MIDI desde la interfaz y comprobación binaria de sus cinco pistas SMF y duración final con silencio.
- Exportación JSON, creación de proyecto nuevo, importación y recarga. Se conservaron secciones, letras, IDs y mezcla; las notas/acordes/patrón fuente permanecieron exactamente iguales al proyecto original.
- Capturas de escritorio a 1440 px y viewport móvil a 390 px revisadas. Sin desbordamiento horizontal del documento; el timeline se desplaza dentro de su panel. No se ha probado en teléfono físico ni Safari.

## Ejemplo generado y leído

`examples/proyecto-fase6.json` y `examples/arreglo-demo.mid`: cinco secciones, cuatro pistas, 13 compases en 4/4, 100 BPM, 386 notas, 31,2 s incluyendo un compás de silencio final. Proyecto validado con Zod y renderizado con el mismo motor usado por la interfaz. La lectura binaria posterior comprueba 386 Note On, 386 Note Off, cinco marcadores y final en 24960 ticks a 480 PPQ en todas las pistas.

## Pendiente

- Escucha humana, importación del MIDI en DAW, Safari y dispositivos físicos. El sonido sigue siendo síntesis básica; no se afirma calidad de producción.
- Despliegue Netlify y llamada real de Gemini/Redis: siguen pendientes de cuentas y credenciales, tal como se documentó en Fase 5. Fase 6 no los requiere ni los activa.
- Automatización, clips con offsets/fuentes distintas dentro de una misma pista, transporte persistente entre pantallas y generación de audio/voces no forman parte de esta entrega. Ver [semántica y límites](phase6.md).
