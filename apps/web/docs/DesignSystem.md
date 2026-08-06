# Design System (v0)

## 1. Paleta de colores

Tokens actuales (definidos en `src/app/globals.css`):

- `padel-green`: `#ccff00`
- `padel-green-title`: `#556b2f`
- `padel-dark`: `#121824`
- `padel-clay`: `#d27d2d`
- `brand-red`: `#ec3237`
- `deep-onyx`: `var(--background-secondary)`
- `text-main`, `text-muted`, `text-dark-main`, `text-dark-muted`

Fondos base:

- `--background`: `#f9fbe5`
- `--background-secondary`: `#121824`

## 2. Tipografías

- Fuente principal declarada en el layout: Geist Sans.
- Fuente efectiva del body: Arial, Helvetica, sans-serif, porque `globals.css` pisa la variable del layout.
- Fuente mono: Geist Mono.
- Cargadas vía `next/font/google` en el layout raíz.

### Pendiente técnico

- Corregir el `body` para que use la fuente declarada por el layout, sin sobrescritura.

## 3. Espaciados (guía)

- Internos comunes: `p-4`, `p-6`, `p-8`, `p-10`.
- Separación vertical entre bloques: `space-y-4`, `space-y-6`, `space-y-8`.
- Radio predominante: `rounded-xl`, `rounded-2xl`.

## 4. Botones

Patrones vigentes:

- Primario oscuro con acento verde en hover.
- Primario verde para CTA de alta visibilidad.
- Secundario con borde y fondo claro.

Reglas:

- Priorizar `font-semibold` o `font-bold`.
- Los estados `hover`, `active` y `focus` deben ser visibles.

## 5. Inputs y selects

Base:

- `border-2 border-gray-200`
- `rounded-xl`
- `bg-gray-50/50` o `bg-gray-50/70`
- `focus:outline-none focus:border-padel-green`

Recomendación de foco visible:

- complementar con `focus:ring-2 focus:ring-padel-green/20`.

## 6. Cards

- Uso de `Card` en la home.
- Estructura vertical con ícono, título, descripción y link.
- Contraste fuerte con `bg-deep-onyx` más acentos verdes.

## 7. Modales

- Backdrop con blur (`bg-black/50 backdrop-blur-sm`).
- Cierre por:
  - botón `X`
  - click en el backdrop
  - tecla `Esc`
- Bloqueo del scroll del body mientras el modal está abierto.
- `role="dialog"` y `aria-modal="true"` en el contenedor.

## 8. Tablas

- Todavía no hay una tabla definitiva implementada.
- Guía sugerida para la próxima iteración:
  - encabezado sticky en desktop.
  - zebra rows suaves.
  - scroll horizontal en mobile.

## 9. Iconografía

- Mixto actual: emojis y SVG inline.
- Recomendado a futuro: normalizar en una librería única (por ejemplo Lucide).

## 10. Breakpoints responsive

- `sm`, `md`, `lg` como base.
- Menú principal de desktop en `md+`.

## 11. Reglas de Tailwind

- Tailwind v4 es CSS-first: **no hay `tailwind.config.*`** a propósito. Los tokens nuevos se agregan como custom properties en `globals.css` dentro de `@theme`, nunca en un config de JS.
- Usar tokens semánticos (`text-padel-green`, `bg-deep-onyx`) antes que hex directos.
- Evitar clases extremadamente largas sin extraer componente cuando se repiten.
- Mantener consistencia entre pantallas públicas y privadas.
