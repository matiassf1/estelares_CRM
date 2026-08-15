# Admin Desktop Layout — Design Spec

**Fecha:** 2026-08-15
**Archivo principal:** `frontend/src/pages/Admin.tsx`

## Objetivo

Hacer el panel de admin usable y cómodo en desktop (≥768px) manteniendo el mismo design system (blanco/negro, brand variables) y sin romper el layout mobile actual.

## Principio

Un único componente `Admin` con layout responsive. Mobile queda exactamente igual. Desktop agrega un sidebar fijo a la izquierda con navegación y el contenido principal a la derecha.

## Layout Mobile (sin cambios)

- Header con stats arriba
- Tabs (Jugadores | Categorías | Parking) como barra horizontal
- Contenido debajo

## Layout Desktop (≥768px via clase `md:`)

```
┌─────────────────────────────────────────────┐
│  HEADER: Estelares Futsal | stats | SALIR   │
├──────────────┬──────────────────────────────┤
│              │                              │
│   SIDEBAR    │     CONTENIDO PRINCIPAL      │
│              │                              │
│  • Jugadores │   (lista / formularios)      │
│  • Categorías│                              │
│  • Parking   │                              │
│              │                              │
│  ─────────── │                              │
│  62 activos  │                              │
│  4 ingresos  │                              │
│              │                              │
└──────────────┴──────────────────────────────┘
```

### Sidebar (desktop only)
- Ancho fijo: 220px
- Fondo: `var(--brand-surface)` con borde derecho sutil
- Navegación vertical: 3 ítems (Jugadores, Categorías, Parking)
- Ítem activo: fondo ligeramente iluminado + acento de color izquierdo (borde-left 2px brand-primary)
- Stats (activos hoy, ingresos) como texto pequeño muted en la parte inferior del sidebar
- El sidebar no scrollea — es `sticky top-0 h-screen`

### Contenido principal (desktop)
- Ocupa el resto del ancho
- Padding generoso: `p-8` en desktop vs `p-4` en mobile
- `max-width: 900px` centrado dentro del panel derecho para no estirar demasiado en pantallas muy anchas

### Header (desktop)
- El header actual se mantiene pero en desktop puede ser más compacto (sin tabs, ya que la nav es el sidebar)
- En mobile: header + tabs como hoy

## Implementación

- Usar clases Tailwind con prefijo `md:` para todo el responsive
- El estado `tab` se renombra a `section` conceptualmente pero sigue siendo el mismo `useState` — no hay cambio de lógica
- Los tabs horizontales se ocultan en desktop (`md:hidden`) y el sidebar se muestra (`hidden md:flex`)
- No se extraen componentes nuevos — todo en `Admin.tsx` para mantener consistencia con el archivo actual

## Design tokens (los mismos de mobile)

- `var(--brand-surface)` — fondo del sidebar
- `var(--brand-primary)` — acento del ítem activo
- `var(--brand-muted)` — texto secundario en sidebar
- `var(--brand-accent-rgb)` — bordes sutiles

## Sin cambios en

- API, backend, lógica de negocio
- Componentes hijo (PlayerList, etc.)
- CSS global / variables
