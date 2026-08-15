# Categorías Acordeón Expandible

**Fecha:** 2026-08-13  
**Archivo principal:** `frontend/src/pages/Admin.tsx`

## Objetivo

Permitir ver los jugadores de cada categoría directamente desde la pestaña Categorías, sin navegar a otra pantalla, mediante un acordeón expandible por tap.

## Comportamiento

- Cada fila de categoría es clickeable (excepto el botón eliminar).
- Al hacer click, se expande un panel debajo mostrando los jugadores de esa categoría.
- Solo una categoría puede estar expandida a la vez (click en otra colapsa la anterior).
- Hacer click en la misma categoría expandida la colapsa.
- Un chevron animado (▶ colapsado / ▼ expandido) en el lado izquierdo indica el estado.

## Estado nuevo

```ts
const [expandedCat, setExpandedCat] = useState<number | null>(null);
```

Toggle: si `expandedCat === c.id` → set null; si no → set c.id.

## Panel de jugadores expandido

- Jugadores filtrados por `categoria_id === c.id`.
- Ordenados alfabéticamente por `apellido` (o `nombre` si no hay apellido).
- Cada jugador se muestra como una pill/chip: `#dorsal Apellido Nombre` (dorsal solo si existe).
- Si no hay jugadores: texto "Sin jugadores asignados" en gris muted.
- Layout: flex wrap de pills dentro del card, con padding interno.

## Interfaz `Member` relevante

```ts
categoria_id?: number | null
categoria_nombre?: string | null
nombre: string
// si existen en el tipo: apellido, numero_dorsal
```

Verificar campos disponibles en `api.ts` antes de implementar; adaptar pills según los campos reales.

## Animación

- El panel expandible usa `max-height` con transición CSS para un colapso/expansión suave.
- El chevron rota 90° con `transition-transform`.

## Cambios en Admin.tsx

1. Agregar estado `expandedCat`.
2. Envolver la fila existente en un `<div>` clickeable con handler de toggle.
3. Asegurar que el click en el botón eliminar no propague al toggle (`e.stopPropagation()`).
4. Renderizar el panel de jugadores condicionalmente debajo de la fila.

## Sin cambios en

- API (`api.ts`) — los datos ya están disponibles en `members`.
- Backend — no se necesitan nuevos endpoints.
- Otras pestañas (Jugadores, Parking).
