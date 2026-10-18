# Fase 5 — Letras e IA opcional

La versión 0.5.0 añade un editor de letras y un proveedor opcional de Gemini. Los motores musicales siguen funcionando sin servidor, sin cuentas y sin pagos obligatorios. No genera voz ni audio a partir de texto. El arreglo de clips y el transporte de estudio completo corresponden a Fase 6.

## Uso sin cuentas ni claves

1. Ejecuta `npm ci` y `npm run dev`; abre **Letras e IA** desde Herramientas o el lateral.
2. Añade secciones y escribe su nombre y letra. El título es el nombre del proyecto. El guardado automático y la exportación/importación JSON conservan el trabajo.
3. Para un punto de partida, indica tema, idioma y estructura, y pulsa **Preparar guía local**. Es una plantilla de ejercicios de escritura, no una canción terminada ni una respuesta de IA. Género, emoción e indicaciones son referencias de edición; el proveedor local no las interpreta.
4. Revisa el borrador. **Aplicar borrador al proyecto** pide confirmación antes de reemplazar título y texto. **Descartar** deja intacta la letra guardada. Puedes seguir editando después de aplicar.
5. **Descargar letra TXT** exporta el título y el texto de las secciones. El JSON conserva además la música y los datos del proyecto.

El tema y las opciones del generador son un borrador de sesión y no se guardan al salir del módulo. Solo el título y las secciones aplicadas/editadas se guardan en el proyecto. Una solicitud cancelada o una respuesta que llega después de abandonar el módulo no se aplica.

## Compatibilidad con proyectos anteriores

Se mantiene JSON v1: se reutilizan `name` y `sections[].lyrics`, sin campos nuevos. Un borrador se aplica por posición a las primeras secciones: conserva sus IDs, compases y referencias a pistas, y actualiza nombre y letra. Si faltan secciones, crea nuevas con ocho compases y sin pistas vinculadas. Las secciones adicionales se conservan tal como estaban. No se modifica ninguna pista, nota, acorde, mezcla o parámetro musical.

Eliminar una sección pide confirmación y elimina su letra y sus referencias, sin borrar las pistas. No se implementa todavía un timeline o la repetición de clips.

## Asistencia de Gemini

Selecciona Gemini y acepta el envío antes de crear un borrador. El navegador llama exclusivamente al endpoint del propio sitio `/.netlify/functions/lyrics`. El servidor añade un contexto de hasta seis recursos de escritura/forma de la biblioteca y llama a `generateContent` con salida JSON estructurada.

Se envían tema, género, emoción, idioma e indicaciones. No se envían pistas, MIDI, letra guardada, nombre del proyecto ni la clave del servidor. Los textos del modelo se muestran como texto de React, sin ejecutar HTML. El resultado debe pasar el esquema estricto de Zod antes de convertirse en borrador.

Un fallo de red, timeout, cuota, configuración o formato produce una **guía local identificada como tal**, con un aviso. No hay reintentos automáticos. Cancelar no dispara fallback ni modifica el proyecto; una llamada ya enviada puede consumir cuota aunque el usuario cancele.

## Activación posterior en Netlify

No se necesita activar IA para usar el editor. Para activarla cuando tengas las cuentas:

1. Importa el repositorio en Netlify. El build es `npm run build`, publicación `dist`, funciones `netlify/functions`, Node 22. Netlify debe incluir las funciones; un alojamiento estático que sirva solo `dist` no ejecuta Gemini.
2. Crea un proyecto de Gemini y una base Redis REST de Upstash con `EVAL` habilitado. Revisa las condiciones, regiones, tratamiento de datos y cuotas de sus planes gratuitos vigentes. No habilites facturación o recargas si quieres mantener costo cero. No se crean cuentas ni servicios automáticamente.
3. En **las variables de entorno de Netlify para las Functions**, configura `GEMINI_API_KEY`, `GEMINI_MODEL`, `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Usa un modelo Gemini disponible para tu cuenta que admita JSON estructurado, con su identificador `gemini-…`. No hay un modelo predeterminado que pueda consumir cuota por accidente. La URL Redis debe ser HTTPS de tu instancia `*.upstash.io`, sin ruta, puerto ni parámetros.
4. Netlify proporciona `URL` y `DEPLOY_PRIME_URL`. Se usan como orígenes permitidos. Si utilizas un dominio alternativo, comprueba que coincide con el dominio configurado del sitio. No se permite `*` ni se aceptan orígenes proporcionados en el cuerpo de la solicitud.
5. Vuelve a desplegar y crea un borrador corto desde el sitio. Confirma que se identifica como **Borrador de Gemini**, que su aplicación exige confirmación y que no sustituye notas ni letra automáticamente. Revisa el consumo en los paneles de Gemini y Upstash.

No pongas secretos en `VITE_`, Git, el navegador, proyectos JSON o mensajes del chat. No compartas la clave de Redis con clientes. Los cuatro nombres anteriores son requisitos del servidor; `.env.example` no contiene credenciales reales. Para desarrollo con Functions puedes usar Netlify Dev con esas variables solo en servidor; `npm run dev` y `npm run preview` ejecutan únicamente Vite. El despliegue real y Netlify Dev no se han validado en esta entrega.

Referencias oficiales para revisar al activar: [Gemini: contenido estructurado](https://ai.google.dev/gemini-api/docs/structured-output), [precios](https://ai.google.dev/gemini-api/docs/pricing), [cuotas](https://ai.google.dev/gemini-api/docs/rate-limits), [Upstash Redis REST](https://upstash.com/docs/redis/features/restapi) y [variables en Functions](https://docs.netlify.com/build/functions/environment-variables/). Estas referencias no constituyen una verificación de precios o disponibilidad actuales.

## Límites y abuso del endpoint

- Solo POST JSON del origen configurado, con encabezado de solicitud explícito; no hay CORS abierto. Esto restringe solicitudes de otros sitios en navegadores, **no autentica** a una persona: clientes externos pueden imitar encabezados.
- Cuerpo máximo 12000 bytes, comprobado durante lectura incluso sin `Content-Length`. Tema/indicaciones: 1000 caracteres cada uno. Género/emoción: 100 cada uno. La estructura y el idioma son enumeraciones cerradas.
- Timeout del servicio de 25 s, de Redis de 3 s y de Gemini de 20 s. Salida del proveedor limitada a 150000 bytes, 3072 tokens de salida y validación posterior: título de 100 caracteres, 1–16 secciones, 4000 caracteres por sección y 24000 en total. El número de secciones debe coincidir con la estructura pedida. Respuestas incompletas, bloqueadas o con campos extra se rechazan.
- Redis reserva presupuesto **antes** de llamar a Gemini mediante una sola operación Lua atómica. Máximo 5 intentos por minuto calendario y 20 por día UTC por IP; 100 al día UTC globales para todas las instancias que comparten esa base y prefijo. Las llamadas fallidas también consumen intentos. IP de Netlify `context.ip`, nunca `X-Forwarded-For` del cliente; claves con hash diario de la IP y caducidad. No se registra contenido de letras ni credenciales.
- Sin credenciales, modelo, origen o IP confiable, el servicio se bloquea. Si Redis falla o devuelve un resultado no válido, tampoco se llama al modelo. No existe un contador en memoria que se presente como un límite distribuido.
- Los límites reducen consumo; no impiden que un atacante agote el presupuesto global y provoque fallback para otros usuarios. Para exposición de mayor escala, añadir autenticación/protección de plataforma y revisar estos límites. El máximo de intentos de aplicación no reemplaza las cuotas de los proveedores.

## Archivos

- `src/features/lyrics/`: editor, borrador separado y aplicación compatible con el proyecto.
- `src/services/ai/`: contratos compartidos, interfaz de proveedor, guía local y cliente del endpoint.
- `server/lyrics.ts`: validación, contexto, cuota persistente y conexión de Gemini.
- `netlify/functions/lyrics.ts`: adaptador de Netlify con credenciales exclusivamente del proceso servidor.

Ver [comprobaciones y límites de esta entrega](verification-phase5.md).
