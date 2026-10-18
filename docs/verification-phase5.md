# Verificación Fase 5 — 18 de octubre de 2026

## Comprobado en esta entrega

- **118 pruebas en 20 archivos**, incluidas las 86 anteriores y 32 nuevas. `npm test -- --maxWorkers=4`.
- Contratos estrictos de solicitud y borrador; guía local en español e inglés para tres estructuras; límites de campos, texto total y propiedades inesperadas.
- Aplicación de texto sin mutar el proyecto de entrada, conservando pistas, notas, IDs, compases, referencias y secciones adicionales. Creación de IDs únicos; ida y vuelta por el parser JSON v1; exportación a texto.
- Proveedor desacoplado: solo endpoint del sitio, sin credenciales del servidor en la solicitud cliente. Fallback ante error HTTP, red/formato y cuerpo excesivo; cancelación explícita sin fallback ni aplicación automática; sin reintentos.
- Editor en DOM simulado: escritura manual, borrador separado, confirmación aceptada/cancelada, descarte, eliminación, consentimiento, fallback etiquetado y respuesta tardía después de cancelar.
- Función con servicios simulados: origen, método, encabezados, tamaño con/sin Content-Length, JSON inválido, falta de configuración/IP de plataforma, destinos no admitidos, cuota agotada y caída del almacén. Se comprueba que no se llama a Gemini en estos casos. Validación del comando Redis EVAL y del envío de contexto acotado; IP ausente en texto plano de las claves; errores de proveedor sin exponer cuerpos ni claves.
- Timeout simulado de 20 s, respuestas truncadas/bloqueadas, JSON incompatible y cuerpos del proveedor excesivos. Presupuesto persistente reservado antes de la llamada del modelo.
- `npm run lint` y `npm run build`: TypeScript incluye cliente, servidor, adaptador Netlify y pruebas. Build de Vite correcto. Persisten los avisos no bloqueantes de anotaciones de optimización de Zod.
- Bundle independiente del adaptador con esbuild para Node 22 e invocación del bundle sin credenciales: devuelve 503 `ai_not_configured` con origen permitido. Sin origen permitido devuelve 403. Esta invocación no equivale a un despliegue de Netlify.
- Inspección de `dist`: no contiene los nombres de credenciales del servidor, el host de Gemini ni `x-goog-api-key`.

## Navegador real en esta máquina

Chromium headless, escritorio 1440 px y viewport móvil 390 px:

- Generación previa de acordes y apertura de Letras e IA desde el menú.
- Edición manual de título/sección/letra; guía local sin sobrescritura; rechazo y aceptación de la confirmación de aplicación.
- Conservación exacta de pistas e ID de sección después de aplicar y editar.
- Persistencia tras recarga; descarga TXT con contenido esperado; descarga JSON, nuevo proyecto e importación, recuperando letra y música.
- Formulario remoto bloqueado sin consentimiento; respuesta 503 simulada que produce una guía local y conserva la letra.
- Sin errores JavaScript ni desbordamiento horizontal en el editor a 390 px. Capturas revisadas de escritorio y móvil; no se ha usado un dispositivo físico.

## Pendiente y límites de la evidencia

No hay cuentas ni credenciales configuradas de Netlify, Gemini o Upstash en esta sesión. **No se ejecutó una llamada real de Gemini, una operación contra Redis real ni un despliegue Netlify/Netlify Dev.** El JSON de modelo, los estados de cuota y los fallos remotos se probaron con dobles de servicio. No se afirma haber verificado la ejecución distribuida de Lua contra una base desplegada ni la identidad IP suministrada por Netlify.

Para activar IA: seguir [Fase 5](phase5.md), configurar los secretos solo en Functions, desplegar y verificar un borrador real. Comprobar también el límite de cuota con llamadas controladas y el fallo cerrado al retirar la conexión de cuotas. Los intentos de prueba consumen presupuesto; no hay reintentos automáticos ni garantía de cuota gratuita disponible.

La guía local es un andamio de escritura, no una canción compuesta por IA. No hay generación vocal, revisión auditiva de letras ni arreglo de clips/timeline de Fase 6. Los planes y el tratamiento de datos de los servicios externos deben revisarse al activarlos; no se verificaron sus condiciones actuales en esta sesión.
