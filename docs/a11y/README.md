# Accesibilidad (a11y)

Más allá de la validación de marcado HTML (`docs/w3c-validation/`), este
proyecto corre **axe-core** —el motor que usa Lighthouse y la extensión
"axe DevTools"— contra las mismas vistas reales usadas para esa
validación (login, home × 2 roles, registrar incidencia, listado × 2 roles,
seguimiento). Es un análisis distinto al de W3C: HTML puede ser válido y
seguir siendo inaccesible (un botón sin texto ni `aria-label` valida
perfecto como HTML, pero un lector de pantalla no puede anunciarlo).

## Cómo correrlo

```bash
npm test
```

`src/a11y.spec.ts` monta cada vista con el mismo mecanismo que usa la
validación W3C (`src/testing/render-view.ts`, con el `MockApi` real
respondiendo datos), corre `axe.run()` sobre el documento, y:

- Hace fallar el test si aparece alguna violación **crítica** o **seria**
  en cualquiera de las vistas.
- Vuelca todo lo que encuentra (incluidas violaciones *moderate*/*minor*,
  que no rompen el build) en [`reporte.md`](./reporte.md) — se regenera en
  cada corrida, no se edita a mano.

## Estado actual

Las 7 vistas están **sin violaciones críticas ni serias**, y sin violaciones
de ningún nivel a la fecha de este reporte (ver `reporte.md`). En el camino
se encontraron y corrigieron 4 problemas reales:

| Problema | Dónde | Fix |
|---|---|---|
| `label` (critical) — el campo de contraseña del login no tenía label asociado | `login.html` | `p-password` expone el `id` real del `<input>` interno vía el input `inputId`, no `id` (que solo etiqueta el host del componente). Se cambió `id="password"` → `inputId="password"`. |
| `button-name` (critical) — 3 botones de solo ícono sin nombre accesible | `list.html` (ver detalle, confirmar asignación), `insert.html` (quitar adjunto) | `[attr.aria-label]` dinámico con el contexto (ej. `"Ver seguimiento de " + ticketCode`) + `pTooltip` a juego, para que también ayude a usuarios sin lector de pantalla. |
| `role-img-alt` (serious) — los `<canvas>` de los gráficos del dashboard no tenían nombre accesible | `home.html` | `p-chart` acepta `ariaLabel` directamente; se agregó a los dos gráficos. |
| `empty-table-header` / `image-redundant-alt` (minor) | `list.html`, `insert.html`, `follow-up.html` | Encabezado de la columna de solo-ícono con texto `.sr-only` (visible solo para lectores de pantalla); miniaturas de adjuntos marcadas como decorativas (`alt=""`) ya que el nombre del archivo ya es texto visible al lado. |

Las tablas de reportes agregadas en `home.html` (Administrador OTI) usan
`p-table` con encabezados (`<th>`) reales en todas las columnas, así que
no repitieron ninguno de estos problemas — se revalidó después de
agregarlas y el resultado siguió en cero violaciones.

## Reglas excluidas y por qué

jsdom (el DOM simulado que usan los tests) no tiene motor gráfico: no
calcula layout ni pinta píxeles. Cuatro reglas de axe-core dependen de eso
y se excluyen explícitamente en `a11y.spec.ts`, con el motivo documentado
en el propio código:

- **`color-contrast`** — necesita el color renderizado final (después de
  cascada CSS + capas superpuestas); jsdom no pinta nada.
- **`target-size`** — necesita el tamaño real en píxeles de los elementos
  interactivos tras layout, que jsdom no calcula (siempre reporta 0×0).
- **`scrollable-region-focusable`** — depende de si un contenedor
  efectivamente desborda su tamaño visual, que tampoco existe sin layout.
- **`aria-dialog-name`**, solo para el caso puntual del `<p-confirmdialog>`
  global montado en `app.html`: PrimeNG lo mantiene siempre en el DOM,
  cerrado, en todas las páginas, y solo resuelve su nombre accesible
  cuando `visible=true` (verificado manualmente: al abrirse sí lo tiene,
  vía `header: 'Confirmación'` que ya le pasa `insert.ts`). En un
  navegador real un diálogo cerrado queda fuera del árbol de accesibilidad
  sin importar sus atributos ARIA; jsdom no siempre replica ese cálculo de
  visibilidad, así que axe lo marca aunque no sea un problema real.

## Cómo complementar esto con Lighthouse (navegador real)

Este análisis con jsdom es rápido y corre en cada `npm test`, pero un
navegador real sí puede evaluar contraste de color y tamaños de foco. Para
completar el cuadro:

```bash
npm run build
npx http-server dist/sigi-web/browser -p 8080 &
npx lighthouse http://localhost:8080 --only-categories=accessibility --view
```

(o, más simple: abrir la app ya desplegada — ver `DEPLOY.md` — en Chrome
DevTools → pestaña Lighthouse → categoría Accessibility.) Repetir por cada
ruta relevante, ya que Lighthouse audita una URL a la vez, a diferencia de
`a11y.spec.ts` que recorre las 7 vistas en una sola corrida.
