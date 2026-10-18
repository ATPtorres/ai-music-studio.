# GitHub y Netlify

La Fase 1 se desarrolla localmente. No se crea un repositorio remoto ni se publica automáticamente. Un repositorio Git local puede inicializarse sin subir archivos; verifica `git status` y secretos antes de hacer commit.

## GitHub

1. Crear un repositorio vacío en tu cuenta, sin añadir otro README.
2. Desde esta carpeta, si aún no existe Git:

```sh
git init
git add .
git commit -m "Foundation for AI Music Studio"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/ai-music-studio.git
git push -u origin main
```

Los valores TU_USUARIO y el nombre remoto son ejemplos: sustituirlos. Autenticarse mediante GitHub CLI/gestor de credenciales; no pegar tokens en archivos o URLs. `package-lock.json` debe subirse, `node_modules`, `dist` y `.env` no.

## Netlify

1. Crear o usar una cuenta en el plan Free; verificar límites y requisitos actuales.
2. Importar un proyecto existente desde GitHub y autorizar solo el repositorio necesario.
3. Rama de producción `main`, comando `npm run build`, directorio `dist`, Node 22; `netlify.toml` contiene esta configuración.
4. Revisar el deploy y abrir la URL asignada. Navegación es estado local; no requiere reescritura SPA en esta fase.
5. Probar cambios de parámetros, recarga, exportación e importación tanto en desktop como móvil. Cada origen tiene almacenamiento independiente: localhost y el dominio Netlify no comparten proyectos; trasladar mediante JSON.

Fase 1 no requiere variables. En Fase 5 configurar GEMINI_API_KEY y GEMINI_MODEL como secretos solo del servidor para Netlify Functions; nunca en `VITE_`, Git o archivos públicos. La función de Gemini todavía no existe. No basta con añadir las variables para activar IA.

## Desarrollo local y producción

`npm run dev` ofrece recarga en desarrollo. `npm run build` genera archivos estáticos en dist. `npm run preview` revisa esa compilación. No servir la raíz del repositorio públicamente con Apache; desplegar solo dist. Las cabeceras de netlify.toml las aplica Netlify, no Vite ni Apache.

Si se agotan los créditos gratuitos, revisar el panel y esperar la renovación o ajustar consumo; no habilitar pagos para mantener el objetivo de costo cero. No hay garantía de disponibilidad ilimitada.
