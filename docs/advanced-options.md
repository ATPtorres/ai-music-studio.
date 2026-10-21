# Vista básica y opciones avanzadas

Cada módulo empieza en vista básica. El botón «Opciones avanzadas» despliega la configuración técnica y los editores detallados del módulo. Plegar no borra los valores ni altera el proyecto, las notas, la reproducción o la exportación. Los valores avanzados existentes siguen aplicándose al generar; no se restablecen automáticamente al ocultarlos. Al salir y volver a un módulo, vuelve a mostrarse su vista básica.

| Módulo | Siempre visible | Opciones avanzadas |
| --- | --- | --- |
| Acordes | Sonido, tonalidad, modo, género, emoción, longitud, generar, símbolos de acordes, transporte y MIDI | Complejidad, tipo de acorde, compás, biblioteca creativa, recetas, exploración, tensión, movimiento, color, conducción de voces, grados, notas y duraciones individuales |
| Melodías y bajos | Sonido, densidad, patrón rítmico, generar, escuchar con acompañamiento, volumen y MIDI | Registro, complejidad, piano roll, variación y edición de notas, tiempos y velocidades |
| Batería | Máquina, género, longitud, generar, secuenciador, variación, acompañamiento, transporte y MIDI | Compás, swing, números GM y velocidades de golpes |
| Letras | Tema, idioma, asistencia, consentimiento de Gemini, generar, revisar/aplicar, escritura manual y TXT | Forma del borrador e indicaciones adicionales |
| Estructura | Familia, generar, transporte, línea de tiempo, asignar frases/silencios, ordenar y editar secciones, MIDI | Receta fija, fraseo, exploración, referencia de la biblioteca, editor de variantes, asignación detallada y mezcla con canales MIDI |

En la línea de tiempo, elegir una frase mantiene la vista básica. Al desplegar las opciones avanzadas, «Editar frase» lleva a la biblioteca correspondiente. Los botones para editar cada bloque se ocultan en la vista básica. Avisos de error, confirmaciones de reemplazo y consentimiento de Gemini permanecen visibles.

El botón usa `aria-expanded` y `aria-controls`. El contenido plegado lleva `hidden`, sale de la navegación por teclado y conserva sus componentes montados. Las ediciones realizadas se mantienen al plegar y desplegar; la persistencia del proyecto sigue las reglas de cada control (por ejemplo, generar para aplicar un borrador de configuración).

Validación: pruebas de los seis módulos, conservación de valores al plegar, ausencia de escrituras al alternar, consentimiento visible y apertura explícita de variantes. Revisión real en navegador móvil y escritorio, incluidos ambos estados del panel y ausencia de desbordamiento horizontal.
