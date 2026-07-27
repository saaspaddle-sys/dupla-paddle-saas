# Design System (v0)


## 1. Paleta de colores

Tokens actuales (definidos en `src/app/globals.css`):

- `padel-green`: `#ccff00`
- `padel-green-title`: `#556b2f`
- `padel-border-green`: `#556b2f`
- `deep-onyx`: `var(--background-secondary)`
- `text-main`, `text-muted`, `text-dark-main`, `text-dark-muted`

Fondos base:

- `--background`: `#f9fbe5`
- `--background-secondary`: `#121824`

## 2. Tipografias

- Fuente principal: Geist Sans.
- Fuente mono: Geist Mono.
- Cargadas via `next/font/google` en layout raiz.

## 3. Espaciados (guia)

- Internos comunes: `p-4`, `p-6`, `p-8`, `p-10`.
- Separacion vertical entre bloques: `space-y-4`, `space-y-6`, `space-y-8`.
- Radio predominante: `rounded-xl`, `rounded-2xl`.

## 4. Botones

Patrones vigentes:

- Primario oscuro con acento verde en hover.
- Primario verde para CTA de alta visibilidad.
- Secundario con borde y fondo claro.

Reglas:

- Priorizar `font-semibold` o `font-bold`.
- Estados `hover`, `active` y `focus` deben ser visibles.

## 5. Inputs y selects

Base:

- `border-2 border-gray-200`
- `rounded-xl`
- `bg-gray-50/50` o `bg-gray-50/70`
- `focus:outline-none focus:border-padel-green`

Recomendacion de foco visible:

- complementar con `focus:ring-2 focus:ring-padel-green/20`.

## 6. Cards

- Uso de `Card` en home.
- Estructura vertical con icono, titulo, descripcion y link.
- Contraste fuerte con `bg-deep-onyx` + acentos verdes.

## 7. Modales

- Backdrop con blur (`bg-black/50 backdrop-blur-sm`).
- Cierre por:
  - boton `X`
  - click en backdrop
  - tecla `Esc`
- Bloqueo de scroll del body mientras el modal esta abierto.

## 8. Tablas

- Aun no hay tabla final implementada.
- Guia sugerida para proxima iteracion:
  - encabezado sticky en desktop.
  - zebra rows suaves.
  - scroll horizontal en mobile.

## 9. Iconografia

- Mixto actual: emojis y SVG inline.
- Recomendado a futuro: normalizar en una libreria unica (por ejemplo Lucide).

## 10. Breakpoints responsive

- `sm`, `md`, `lg` como base.
- Menu principal desktop en `md+`.

## 11. Reglas Tailwind

- Usar tokens semanticos (`text-padel-green`, `bg-deep-onyx`) antes que hex directos.
- Evitar clases extremadamente largas sin extraer componente cuando se repiten.
- Mantener consistencia entre pantallas publicas y privadas.
