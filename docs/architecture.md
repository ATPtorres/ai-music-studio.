# Arquitectura del MVP y viabilidad

Actualización histórica Fase 4: armonía, melodías/bajos, secuenciador de batería, audio y MIDI ya implementados. Consulta [acordes](phase2.md), [melodías y bajos](phase3.md), [batería](phase4.md) y [verificación vigente](verification-phase4.md). Las decisiones de planificación siguientes se conservan como contexto de la fundación; la estructura vigente está en el README.

La Fase 5 añade el editor de letras y una conexión opcional de Gemini con cuotas persistentes. Ver [arquitectura y activación](phase5.md) y [verificación](verification-phase5.md); las credenciales y el despliegue real siguen pendientes.

## Alcance y decisiones

React + TypeScript estricto + Vite para una SPA estática; Tailwind CSS 4 integrado con Vite y CSS semántico para el diseño de estudio. React hooks para estado: no hace falta Redux ni un router para cuatro vistas sin URL propia. Zod valida fronteras de confianza y deriva tipos compartidos. Vitest y ESLint verifican la base. Iconos Lucide, sin fuentes ni imágenes remotas obligatorias.

La propuesta es viable sin pagos obligatorios para un MVP local y un despliegue pequeño. El núcleo procesa música en el navegador; no requiere servidor, base de datos ni registro. Gemini aporta asistencia opcional; no controla los eventos MIDI. No se promete una producción de audio realista ni generación de canciones de audio por IA.

## Estructura

```text
src/
  App.tsx                  shell, navegación y paneles de fundación
  styles.css               tema y diseño adaptable
  models/project.ts        esquemas estrictos y tipos v1
  state/useProject.ts      estado y guardado automático
  services/persistence.ts  validación, importación/exportación JSON
  music/theory.ts           unidades, notas y mapa de percusión
  music/theory.test.ts
  services/persistence.test.ts
docs/                      arquitectura, fases, despliegue
```

En cada fase se extraerán componentes visuales de App a `components/` y se crearán `features/chords`, `features/melody`, `features/bass`, `features/drums`, `features/lyrics` y `features/arrangement`, únicamente al implementar esas funciones. Motores puros en `music/engines/`, reproducción en `audio/`, escritura MIDI en `midi/`, proveedor opcional en `services/ai/` y endpoint en `netlify/functions/`. Estos directorios futuros no contienen implementaciones falsas.

Dependencias: UI → estado/servicios → modelos y motores puros. Audio y exportación consumen las mismas notas validadas. No generar MIDI a partir de texto libre de Gemini.

## Contrato musical compartido

`MusicProject`: version literal 1, id UUID local, nombre, fechas ISO, parámetros, pistas y secciones. El esquema ejecutable es `src/models/project.ts`.

Parámetros: tónica cromática C–B con sostenidos, modo major/minor, tempo entero 30–300, compás [numerador, denominador], género, emoción, complejidad, instrumentos, referencias estilísticas generales, tema y duración objetivo en segundos. Algunos parámetros se almacenan para las fases siguientes y todavía no tienen controles.

`MusicNote`: pitch entero 0–127, start ≥ 0, duration > 0, velocity 1–127. **start y duration usan negras**; BPM también cuenta negras. C4 = MIDI 60. Para 6/8 cada compás contiene tres negras. Duración = compases × numerador × (4/denominador) × 60/BPM. En una futura interfaz de tempo de negra con puntillo habrá que convertir explícitamente.

`MusicTrack`: id, nombre, tipo chords/melody/bass/drums, canal 0–15, muted, volumen 0–1, notas y acordes. Canal 9 de índice cero (canal 10 humano) reservado para batería. Mapa GM: kick 36, snare 38, clap 39, closedHat 42, openHat 46, shaker 70. Referencia: [General MIDI percussion map](https://midi.org/general-midi).

`Chord`: id, símbolo, grado, inicio y duración en negras y pitches MIDI. `Section`: id, nombre, compases, referencias a pistas y letra editable. Las secciones se ordenan por posición en el array. El esquema rechaza referencias inexistentes e identificadores duplicados. En fase de arreglo se definirá la repetición y recorte de clips por sección.

El formato v1 no permite propiedades desconocidas. Versiones nuevas requerirán migraciones explícitas. Hasta entonces versiones incompatibles se rechazan sin sustituir el proyecto.

## Persistencia y límites

Un proyecto activo en localStorage, límite propio de 2 MB para evitar archivos enormes y bloqueo prolongado. Es suficiente para parámetros y primeras pistas; la cuota real depende del navegador. Migrar a IndexedDB cuando crezca el arreglo. Capturar errores de lectura/escritura y conservar copias corruptas hasta confirmación. Exportación JSON para respaldos y traslado manual; no hay nube ni sincronización entre pestañas/dispositivos. Usar una pestaña de edición por proyecto.

## Servicios gratuitos: verificación 18 de octubre de 2026

- [Netlify Free](https://www.netlify.com/pricing/): 300 créditos mensuales, límite estricto; despliegues y tráfico comparten recursos. Consultar [consumo de créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) antes de publicar. No seleccionar planes pagos ni recargas para cumplir costo cero.
- [Gemini billing](https://ai.google.dev/gemini-api/docs/billing): nivel gratuito para ciertos modelos, sujeto a disponibilidad. [Cuotas](https://ai.google.dev/gemini-api/docs/rate-limits) por proyecto y modelo, visibles en AI Studio, sin garantía de capacidad. [Precios y tratamiento de datos](https://ai.google.dev/gemini-api/docs/pricing): revisar condiciones antes de enviar letras privadas; el nivel gratuito puede usar contenido para mejorar productos. No activar facturación para el MVP gratuito. Elegibilidad regional y modelos deben verificarse al integrar.
- GitHub almacena el código; no es necesario para ejecutar localmente. Las bibliotecas de la base son abiertas, sin licencia comercial obligatoria. Auditar licencias de muestras y nuevas dependencias antes de agregarlas.

## Riesgos y mitigaciones

Cuotas/caídas: desactivar solo asistencia IA y mostrar error; motores locales siguen disponibles. Proxy público: una clave oculta no evita abuso; fase 5 necesita límite de cuerpo, timeout, validación estricta, controles de origen y un mecanismo de límites persistente o protección de plataforma. Un contador en memoria de una función no es un límite global fiable. No activar el endpoint antes de resolverlo.

Audio móvil: requiere gesto del usuario, puede suspenderse en segundo plano y exige liberar nodos; probar con dispositivos reales. Temporización: Tone.js para agenda de audio, no temporizadores de UI. MIDI: PPQ, canales, Note Off, tempo y compás deben verificarse mediante lectura de archivos reales y pruebas en DAW en fase 2. Los previews usarán síntesis sencilla, sin equipararla con audio final.

Sin IA deben funcionar: parámetros, proyectos, teoría, armonía, melodía, bajo, batería, edición de notas, duración, estructura, reproducción y MIDI. Letras y explicaciones podrán usar IA, con edición manual disponible y confirmación antes de reemplazar texto.
