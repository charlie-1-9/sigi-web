# Validación W3C — metodología y resultados

## Por qué no basta con pegar la URL en validator.w3.org

sigi-web es una SPA (Single Page Application): `index.html` es solo el cascarón
(`<app-root></app-root>`) y Angular arma cada vista en el navegador. Si pegas la
URL de la app directamente en https://validator.w3.org, el validador solo ve ese
cascarón vacío — no el contenido real de cada página.

Para validar de verdad **el HTML que el usuario efectivamente ve**, hay dos
caminos: (a) abrir cada vista en el navegador, copiar el "Outer HTML" del
`<html>` desde el inspector, y pegarlo en la pestaña "Direct Input" del
validador; o (b) renderizar cada vista de forma automatizada y correrla contra
el mismo motor que usa validator.w3.org. Se hizo lo segundo, para que el
resultado quede documentado y sea reproducible.

## Metodología

1. `src/export-html.spec.ts` monta la aplicación real (mismo `App`, mismas
   rutas, mismos providers de `app.config.ts`, incluido el `MockApi`) usando
   `TestBed` + Angular Router, navega a cada ruta con una sesión simulada
   (rol Solicitante, Técnico o Administrador OTI según corresponda), espera a
   que se resuelvan los datos simulados, y vuelca `document.documentElement.outerHTML`
   a un archivo `.html` completo por vista. Esto se ejecuta con:

   ```bash
   npx ng test
   ```

   Los archivos quedan en `w3c-snapshots/` (7 vistas: login, home como
   Solicitante y como Administrador OTI, registrar incidencia, listado como
   Solicitante y como Administrador OTI, y seguimiento con una incidencia
   real cargada).

2. Cada archivo se valida con **vnu.jar** (el "Nu Html Checker"), que es
   literalmente el mismo motor de validación que corre detrás de
   validator.w3.org:

   ```bash
   java -jar vnu.jar w3c-snapshots/*.html
   ```

Los 7 HTML resultantes están copiados en `docs/w3c-validation/` como evidencia.

## Resultado

Sin errores de marcado propios del proyecto: la jerarquía de encabezados es
correcta (un solo `<h1>` por vista), no hay IDs duplicados, no hay etiquetas
sin cerrar ni mal anidadas, y las tablas usan `<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>`
correctamente.

Lo único que el validador reporta son atributos que **Angular y PrimeNG**
agregan internamente y que están fuera del código de este proyecto:

- `_nghost-*` / `_ngcontent-*` / `ng-version`: Angular los añade a *todos* los
  elementos para aislar los estilos de cada componente (View Encapsulation).
  No siguen la convención `data-*` que exige el estándar, por lo que el
  validador los marca — esto ocurre en **cualquier** aplicación Angular con
  encapsulación por defecto, no es específico de este proyecto. Evitarlo del
  todo implicaría mover toda la app a Shadow DOM, lo cual rompe el theming de
  PrimeNG y las utilidades de Tailwind (que dependen de una hoja de estilos
  global).
- `autofocus="true"` duplicado y el rol `row`/`rowgroup` en la tabla: son
  parte de la implementación interna de los componentes `p-button`, `p-select`
  y `p-table` de PrimeNG 21, no de las plantillas de este proyecto (se
  verificó con `grep -rn "autofocus" src/` que el atributo no aparece en
  ningún archivo propio).
- El aviso de "falta el atributo lang" es un artefacto del método de
  snapshot (TestBed no parte del `index.html` real): el `index.html` que
  efectivamente se despliega sí declara `<html lang="es">`.

Se filtraron estos casos y se corrigió todo lo demás (jerarquía de
encabezados, principalmente). Comando usado para aislar los problemas
realmente accionables:

```bash
java -jar vnu.jar w3c-snapshots/*.html \
  | grep -v "not needed and should be omitted" \
  | grep -v "_nghost-\|_ngcontent-\|ng-version\|not allowed on element .* at this point"
```

## Revalidación tras agregar tests, dashboard, notificaciones, modo oscuro y exportación

Después de sumar esas 5 mejoras (que tocan `app.html`, `home.html` y
`list.html`), se corrió el mismo proceso de nuevo para confirmar que no se
había introducido ningún error nuevo. El filtro sí encontró uno real:

- **`Bad value "220px" for attribute "height" on element "canvas"`** en las
  dos vistas de `Inicio` (una por cada gráfico `p-chart`). Causa: al usar
  `[responsive]="true"` junto con `height="220px"`, PrimeNG vuelca ese valor
  tal cual al atributo HTML `height` del `<canvas>`, que exige un número
  puro (el `canvas` interpreta `height="220px"` como `NaN`, no como CSS). La
  altura ya estaba controlada por el `<div style="height: 220px">` que
  envuelve al gráfico, así que la solución fue simplemente quitar el input
  `height` de `<p-chart>` y dejar que el modo responsive tome la altura del
  contenedor — no hacía falta.

Fuera de ese caso, todo lo que reporta el validador en la nueva pasada son
las mismas categorías de ruido ya explicadas arriba (`_nghost-*`/
`_ngcontent-*`/`ng-version` de Angular; `autofocus` duplicado y roles
`row`/`rowgroup` que vienen de dentro de `p-button`, `p-inputtext` y
`p-table` de PrimeNG, no de las plantillas de este proyecto; y el aviso de
`lang` que es un artefacto del método de snapshot). Los 7 HTML en esta
carpeta corresponden a esta segunda pasada, ya con el fix aplicado.
