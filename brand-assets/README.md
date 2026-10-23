# Ownly Malta · Recursos de marca

Abre **index.html** para ver el kit. Empieza por **guidelines/GUIA-DE-MARCA.md** para trabajar con él.

Preparado el 23 de octubre de 2026 a partir de la identidad implementada en la web. Las piezas sociales son diseños iniciales nuevos: revisa el mensaje antes de publicarlas.

| Carpeta | Contenido |
| --- | --- |
| logos/originals | Logo con texto editable e icono vectorial original de la web |
| logos/exports | SVG con texto convertido en trazados y PNG transparentes; reverso con placa verde |
| colors-and-type | Paleta visual, códigos JSON/CSS, fuentes Geist y licencia |
| templates/originals | Plantillas SVG con texto editable para publicaciones, historia, perfil y portada |
| social/exports | PNG listos para subir y SVG con textos en trazados |
| social/images | Imagen existente de La Valeta conservada sin modificar |
| guidelines | Guía, inventario, encargo para colaboradores y vista previa |
| tools | Generadores reproducibles de los SVG y PNG |

## Empezar

1. Instala los dos archivos TTF de `colors-and-type/fonts/`.
2. Abre una plantilla de `templates/originals/` en Inkscape, Illustrator o un editor que conserve texto SVG. Figma permite importar SVG, pero conviene comprobar que los textos siguen siendo editables. Si el editor los convierte en curvas, usa Inkscape para editar el original.
3. Duplica el archivo, cambia el mensaje y conserva el tamaño del lienzo. Guarda el editable en una carpeta de campaña dentro de `social/working/`.
4. Exporta a PNG, sRGB, con el tamaño original. Guarda la versión final en una carpeta de campaña dentro de `social/exports/`.
5. Comprueba el recorte y la legibilidad en móvil antes de publicar.

Los SVG de `exports/` no necesitan instalar Geist para mostrar el logo o el texto: están trazados. Los SVG de `originals/` conservan texto editable.

## Fuente de verdad y mantenimiento

El logo procede de `app/components/Brand.tsx` y `public/favicon.svg`; los colores de `app/globals.css`; Geist de `app/layout.tsx`. El lockup exportado usa Geist Bold 700 como peso portátil; la web usa 760 para la palabra de marca y puede mostrar una pequeña diferencia de peso.

`public/og.png` se excluye: contiene Clearlyield. No se ha corregido esa imagen en la aplicación como parte de este kit.

Para regenerar las piezas: `python brand-assets/tools/build-kit.py` (requiere fontTools) y `node brand-assets/tools/export-png.mjs` (usa sharp del proyecto). Los generadores sobrescriben las piezas base: crea duplicados para tus campañas.
