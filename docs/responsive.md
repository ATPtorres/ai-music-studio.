# Revisión de interfaz adaptable — 20 de octubre de 2026

Se revisaron las once pantallas del estudio en Chromium con tamaños de móvil, tableta, escritorio y orientación horizontal. Se mantuvieron la paleta clara, los colores por instrumento y el estilo de bordes rectos.

## Cambios

- Navegación inferior fija con iconos y nombres visibles en móvil/tableta; estado de página activa y acceso a Estudio, Herramientas, Proyectos y Biblioteca.
- Cabecera compacta y selector de módulo en los seis editores para cambiar de herramienta sin volver al listado.
- Campos de 16 px y altura mínima de 46 px; botones principales de al menos 44 px en la presentación táctil. Casillas con etiquetas amplias y sliders de 44 px de alto.
- Textos de ayuda, títulos, márgenes y paneles reorganizados para evitar letras diminutas y encabezados apretados. El distintivo de versión de Acordes ya no comprime el título en una columna estrecha.
- Formularios, tarjetas, editor de notas y mezclador se apilan según el espacio. Los nombres largos y los selectores mantienen su contenedor.
- Rejilla de batería con celdas de 44 × 44 px y etiquetas de instrumento fijas. Desplazamiento propio para batería, piano roll y arreglo, con indicaciones visibles en móvil.
- El arreglo conserva sus proporciones musicales y etiquetas fijas; el editor de sección permite asignar frases con controles de ancho completo. El piano roll conserva su precisión y ofrece el editor numérico como alternativa a tocar notas pequeñas.
- Espacio reservado para la barra inferior, insets de dispositivos con recortes, `svh`, orientación horizontal y movimiento reducido. No se desactiva el zoom del navegador.
- Salto al contenido, foco en el contenido al cambiar de pantalla, regreso al inicio y navegación activa identificada con `aria-current`.
- Barra lateral de escritorio desplazable para que las herramientas inferiores sigan accesibles en ventanas bajas.
- Corrección del buscador de Biblioteca: en determinados anchos, el selector de categoría podía consumir todo el espacio y dejar el campo de búsqueda con ancho cero. Ahora cada control conserva su espacio.

La capa compartida está en `src/responsive.css`. Los cambios de React se limitan a navegación y presentación; los motores musicales y los datos del proyecto no se modifican.

## Matriz comprobada en navegador

| Ventana | Uso |
| --- | --- |
| 320 × 740 | Teléfono estrecho |
| 360 × 800 | Teléfono compacto |
| 390 × 844 | Teléfono estándar |
| 430 × 932 | Teléfono grande |
| 768 × 1024 | Tableta vertical |
| 844 × 390 | Teléfono horizontal |
| 1024 × 768 | Ventana intermedia |
| 1440 × 900 | Escritorio |

**88 comprobaciones de pantalla/tamaño:** Estudio, Herramientas, Proyectos, Biblioteca, Guía y los seis módulos musicales. No se detectó desbordamiento horizontal del documento ni controles de formulario sin ancho. En la presentación móvil, los botones principales externos a los lienzos musicales cumplen el tamaño de 44 px y los campos de edición usan al menos 16 px. Los controles compactos de escritorio no se evaluaron como objetivos táctiles.

El desplazamiento horizontal de las rejillas es intencionado y permanece dentro de su panel. Se verificaron desplazamientos por teclado de 120 px en batería/arreglo y 80 px en piano roll, con etiquetas de instrumento fijas donde corresponde. Se capturaron y revisaron las vistas de Estudio móvil/escritorio y los editores de batería/arreglo. No se registraron errores de aplicación en la instancia de prueba.

Se usó el ejemplo `proyecto-estructura-aleatoria.json`, con cuatro pistas, variantes y siete secciones, en un origen local de prueba distinto (`127.0.0.1:5174`). El proyecto del usuario en `127.0.0.1:5173` no se reemplazó ni se editó durante esta revisión.

- [Reporte de medidas por pantalla](responsive-audit.json).
- [Estudio móvil](screenshots/mobile-studio.jpg).
- [Arreglo móvil](screenshots/mobile-arrangement.jpg).
- [Batería móvil](screenshots/mobile-drums.jpg).
- [Estudio de escritorio](screenshots/desktop-studio.jpg).

## Pruebas y alcance

**184 pruebas en 28 archivos**, incluidas dos regresiones de navegación: acceso al contenido/página activa y cambio entre los seis módulos sin modificar el proyecto. Lint y compilación de producción correctos; persisten los avisos no bloqueantes de anotaciones de Zod.

Esta revisión usa ventanas de Chromium, no teléfonos físicos. Queda pendiente comprobar Safari/iOS, teclado virtual, rotación real, lectores de pantalla y comportamiento de las zonas seguras en dispositivos con recorte. Los rectángulos de notas del piano roll y ciertos bloques musicales muy cortos siguen siendo objetivos densos; el editor inferior ofrece la alternativa para ajustes precisos. No se presenta la revisión como una certificación de accesibilidad.
