# Agente de composición

El agente convierte una petición en lenguaje natural en llamadas a las herramientas que ya usa el estudio. **No genera audio ni MIDI directamente**: elige funciones locales verificadas y el proyecto resultante se puede editar, reproducir y exportar como cualquier otro.

## Qué puede hacer

| Herramienta | Efecto |
| --- | --- |
| `get_project_summary` | Lee parámetros, pistas, acordes, patrones y secciones. |
| `configure_project` | Cambia tonalidad, modo, BPM, compás, género, emoción, tema, complejidad y nombre. |
| `generate_chords` | Genera una progresión de 2–16 compases. |
| `generate_line` | Genera melodía o bajo sobre los acordes existentes. |
| `generate_drums` | Genera un patrón de 1–8 compases con swing opcional. |
| `generate_structure` | Crea secciones y las vincula a las pistas. |
| `clear_track` | Elimina una pista y sus vínculos en las secciones. |

La interfaz guarda un punto de restauración antes de cada petición: **Deshacer último cambio** vuelve al estado anterior.

## Activación (2 minutos)

1. Copia `.env.example` a `.env`.
2. Elige un proveedor compatible con OpenAI **y con tool calling**:

```sh
# Gemini (nivel gratuito de Google AI Studio)
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-3.5-flash
LLM_API_KEY=tu_clave

# Groq (nivel gratuito)
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
LLM_API_KEY=tu_clave

# OpenRouter (modelos con sufijo :free)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
LLM_API_KEY=tu_clave

# Ollama local (sin cuenta ni clave)
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=qwen3:4b
LLM_API_KEY=
```

3. Reinicia `npm run dev`.
4. Abre **Agente IA** en el lateral.

Los límites y modelos gratuitos cambian con el tiempo: revisa las condiciones del proveedor antes de usar letras privadas. El agente envía solo el texto de la conversación y el resumen del proyecto, no las notas completas ni archivos.

> Si Gemini responde 404 «model no longer available», consulta la lista de modelos de tu cuenta (`GET https://generativelanguage.googleapis.com/v1beta/models`) y usa el `gemini-…-flash` más reciente que aparezca con `generateContent`.

## Seguridad

- La clave se lee en el servidor de Vite y se añade a la petición desde `server/agent.ts`. **Nunca llega al navegador** y nunca debe llevar el prefijo `VITE_`.
- El endpoint solo existe con `npm run dev` o `npm run preview`. Un `dist/` estático no tiene proxy: para publicar el agente harían falta funciones propias (Netlify, Cloudflare Workers, etc.).
- El proxy limita tamaño de entrada/salida, valida mensajes y herramientas, aplica timeout y no reenvía cuerpos de error del proveedor.
- El modelo no puede leer archivos, ejecutar código ni acceder a la red. Solo dispone de las herramientas musicales.

## Diagnóstico

| Síntoma | Causa probable |
| --- | --- |
| «Sin configurar» o 503 | Falta `LLM_MODEL`/`LLM_API_KEY` o no reiniciaste Vite. |
| 502 con «clave rechazada» | `LLM_API_KEY` incorrecta, modelo inexistente o sin acceso. |
| 429 | Cuota o límite de solicitudes del proveedor. |
| Responde pero no cambia el proyecto | El modelo no soporta *tool calling*; prueba otro modelo. |
| Ollama no responde | Comprueba `ollama list` y que el puerto 11434 esté activo. |

## Diseño

- `server/agent.ts`: proxy y validación de fronteras.
- `server/viteAgent.ts`: middleware de Vite para desarrollo y preview.
- `src/agent/tools.ts`: esquemas (Zod → JSON Schema) y ejecución de herramientas.
- `src/agent/agentLoop.ts`: bucle de conversación, herramientas y límites.
- `src/features/agent/AgentWorkbench.tsx`: interfaz, trazas y deshacer.
