# Verificación de Fase 4 — 18 de octubre de 2026

## Automatizado

- **69 pruebas correctas en 14 archivos**: 49 previas y 20 nuevas.
- Patrones distintos en diez géneros; notas del mapa GM, límites de velocidad y duración. Compases 4/4, 3/4, 6/8, 7/8 y parejas de swing reiniciadas en 3/16.
- Edición inmutable, exclusión de hats, variación reproducible y conservación de ID, mezcla, canal 10, pasos y notas al importar/exportar JSON. Rechazo de filas incorrectas.
- Repetición de ciclos sin aplicar swing dos veces, corte al final de una selección y límites de expansión.
- MIDI leído con midi-file y @tonejs/midi: canal 10, instrumentos GM, velocidad, swing en ticks, metadatos 6/8, Note On/Off balanceados y repeticiones de acompañamiento.
- React en happy-dom: batería sin acordes, generación, pasos y Mayús+clic, velocidades, navegación de compases, variación, confirmación de vaciado, control de swing, cuatro pistas y mezcla conservada después de cambiar BPM.
- Audio con Tone simulado: seis sonidos separados, velocidad, cierre del hat abierto, limpieza total/parcial, cuatro pistas en un reloj y ausencia de reataque de percusión al reanudar.
- `npm run lint` y `npm run build`: correctos. Se reutilizan las dependencias existentes.
- Auditoría npm completa de la versión 0.4.0: **0 vulnerabilidades**. No se añadieron dependencias.
- Ejemplo generado y leído desde disco: `examples/proyecto-fase4.json`, `bateria-demo.mid` y `fase4-acompanamiento.mid`. El MIDI conjunto es SMF tipo 1, 480 PPQ, 100 BPM y 4/4; contiene 70 golpes en canal 9, 16 notas de acordes en 0, 32 de melodía en 1 y 32 de bajo en 2, todos con primer tick 0. El ciclo original de dos compases tiene 35 golpes y se repite para cubrir cuatro compases.

## Pendiente manual

El navegador integrado bloqueó el acceso al estudio durante esta sesión en Fase 2. No se ha intentado eludir esa restricción. Esta fase se verifica con pruebas automáticas y DOM/audio simulados: **no se ha escuchado el kit ni revisado visualmente el secuenciador en navegador/móvil real, ni abierto los MIDI en un DAW**.

Para completar la revisión: seguir README → Probar Fase 4; alternar pasos y velocidades, comparar swing 0/50%, comprobar hats y los diez grooves, navegar compases, escuchar solo/con tres pistas, pausar/reanudar, cambiar BPM y volumen, salir del módulo mientras suena y abrir MIDI individual/conjunto en un DAW. Verificar 4/4 y 6/8 y desplazamiento horizontal a 390 px.

Se conservan los avisos conocidos de anotaciones de optimización de Zod y fin de soporte de ESLint 9. No se implementa ni se avanza a Fase 5 en esta entrega.
