# Fase 4: secuenciador de batería

## Modelo musical

`MusicTrack` añade el campo opcional `drumPattern`: género, 1–8 compases, compás propio, swing 0–0,6 y seis filas de velocidades enteras 0–127. Cada fila tiene exactamente `compases × numerador × 16 / denominador` pasos. 0 significa sin golpe. El esquema rechaza filas de longitud incorrecta, hats abierto/cerrado simultáneos y patrones en pistas que no sean batería. El canal es siempre 9 de índice cero (canal humano 10). Los proyectos v1 anteriores se siguen leyendo; el campo opcional nuevo puede ser rechazado por lectores antiguos con esquema estricto.

Mapa General MIDI consistente con `music/theory.ts`: kick 36, snare 38, clap 39, closedHat 42, openHat 46, shaker/maracas 70. El patrón es la fuente de verdad del módulo y de la exportación cuando existe. `notes` se sincroniza al editar para compartir eventos con otros consumidores. Para pistas importadas sin `drumPattern` se usan sus notas existentes y se advierte si contienen percusión fuera del mapa de preview.

## Generación y swing

Diez plantillas amplias: pop, rock, funk, reggaetón, trap, hip-hop, R&B, jazz, electrónica y latina. Son grooves simplificados, no copias de grabaciones ni una implementación exhaustiva de cada tradición rítmica. Las referencias de 16 pasos se adaptan a la longitud del compás y, en compases compuestos de octava, se colocan acentos por grupos de tres corcheas. En 6/8 hay 12 pasos y tres negras de duración, con BPM de negras.

Cada paso dura 0,25 negras. Swing retrasa los índices locales impares (pasos visibles 2, 4, etc.) en `0,25 × swing` negras, reiniciando las parejas en cada compás, incluso si tiene un número impar de pasos. 0 es recto; el máximo desplaza esos golpes en 0,15 negras. Las notas MIDI duran 0,06 negras y no exceden el ciclo. Los sonidos sintetizados son one-shots con envolventes propias; sus colas no equivalen a la duración del Note Off MIDI.

La variación cambia un golpe y conserva el resto. Editar un hat excluye el otro en el mismo paso. El editor muestra un compás, selección por clic/Mayús+clic o Tab, velocidad individual y velocidad para nuevos golpes. Vaciar pide confirmación. Los ajustes de género/longitud/compás son borradores hasta generar; swing se aplica al patrón activo directamente.

## Reproducción y exportación

`TrackPlayer` soporta hasta cuatro pistas con un solo transporte. Para batería usa `DrumKit`: bombo con MembraneSynth, cinco voces de ruido filtrado para caja, clap, hats y shaker. El cerrado libera la envolvente del abierto. No hay fetch de muestras. Pausar libera voces; reanudar recupera las notas tonales aún activas pero no vuelve a golpear percusión pasada. Stop y desmontar liberan Part, kit, filtros y ganancias; un inicio pendiente queda cancelado.

Al acompañar, `drumSelection` repite el ciclo hasta la frase más larga seleccionada, redondeada a compases del patrón. La selección está limitada a 4096 negras y 15.000 eventos de preview para evitar expansiones arbitrarias. El MIDI conjunto usa exactamente esa repetición expandida. El MIDI individual exporta un único ciclo. Todos los eventos preservan velocidades y swing en ticks, con canal de percusión 10 y metadatos globales de tempo/compás.

Si el compás global cambia, se conserva el patrón original y se avisa: no se reorganizan pasos a escondidas. Regenerar adapta el patrón al compás actual. El cambio de altura de acordes no afecta a la batería. Los módulos de melodía y bajo conservan su preview anterior; el nuevo preview de cuatro pistas está en Batería. Todavía no es un arreglo por secciones o timeline completo.

No se añadieron dependencias, claves ni servicios. Gemini y letras corresponden a Fase 5.
