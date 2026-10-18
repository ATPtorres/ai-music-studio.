# Verificación de Fase 3 — 18 de octubre de 2026

- **49 pruebas correctas en 10 archivos**, incluyendo las 28 de fases anteriores y 21 nuevas.
- Generación de ambas líneas en las 24 combinaciones de tonalidad/modo: rango, escala, anclaje en acordes y monofonía. Fundamentales con inversiones, semillas, densidad/síncopa, huecos y duraciones fraccionarias.
- Variaciones: pitches distintos conservando inicios, duraciones y velocidades. Regeneración mantiene IDs y asigna canales disponibles distintos del canal 10.
- Esquemas y JSON conservan notas, parámetros aplicados y referencia armónica. Cambiar tempo no invalida esa referencia; cambiar acordes sí, sin borrar las líneas.
- MIDI leído mediante @tonejs/midi y midi-file: pitches, posiciones/duraciones en ticks, canales, programas, tempo/compás y Note On/Off balanceados en tres pistas.
- Ejemplo real en disco: `examples/proyecto-fase3.json`, melodía y bajo individuales y `examples/fase3-acompanamiento.mid`. La lectura de este último confirma SMF tipo 1, 480 PPQ, 100 BPM, 16 notas de acordes, 32 de melodía y 32 de bajo, en canales 0/1/2 con primer tick 0.
- Interacciones React en happy-dom: generación, selección por teclado, edición, eliminación y adición, rechazo de duración solapada, variación, aviso de armonía y preview con tres pistas. Mute/volumen no reconstruyen el transporte y la mezcla se reaplica después de cambiar BPM.
- Transporte con Tone simulado: reloj único, programación en ticks, pausa y reanudación selectiva, mezcla, cancelación de un inicio pendiente y liberación de nodos aun ante fallos parciales.
- `npm run lint`: correcto. `npm run build`: TypeScript y Vite correctos. Auditoría npm de dependencias no opcionales: **0 vulnerabilidades**. No se añadieron dependencias.

## Revisión manual pendiente

El navegador integrado bloqueó el acceso al estudio en esta sesión durante Fase 2; no se ha intentado eludir esa restricción. Las verificaciones de Fase 3 son automáticas y DOM/audio simulados: **no se ha escuchado el nuevo preview ni revisado visualmente el piano roll en navegador o móvil físico, ni abierto los MIDI en un DAW**.

Para completar esa revisión: seguir README → Probar Fase 3, escuchar cada línea y el acompañamiento, probar pausa/reanudación/loop/volumen, cambiar BPM y volver a reproducir, salir mientras suena y abrir los MIDI en un DAW. Revisar el piano roll en escritorio y a 390 px; recorrer sus páginas y editar con ratón y teclado. No se avanza a Fase 4 en esta entrega.

Se mantienen los avisos de anotaciones de optimización de Zod y fin de soporte de ESLint 9 registrados en Fase 1; no impiden compilar ni ejecutar las pruebas.
