# Player List Visual e Interactiva — Design Spec

**Fecha:** 2026-08-15
**Archivo principal:** `frontend/src/pages/Admin.tsx` (componente `PlayerList`)

## Objetivo

Reemplazar los chips de texto plano en el acordeón de categorías por una lista de jugadores visual con avatares, badges de estado, y acciones rápidas inline.

## Layout del panel expandido

Cada jugador ocupa una fila que contiene:

1. **Avatar circular** — círculo de 32px con las iniciales del jugador (primera letra de `apellido` + primera de `nombre`). El color de fondo se deriva del nombre con una función hash determinista para que sea consistente por jugador. Texto blanco sobre el fondo.
2. **Nombre completo** — `Apellido, Nombre` en font-semibold texto-sm blanco.
3. **Badge de estado** — pill pequeña: verde con texto "ACTIVO" si `activo === true`, gris con "INACTIVO" si `false`.
4. **Chevron `>`** a la derecha — indica que la fila es tappeable.

## Interacción al tocar un jugador

Al hacer tap en una fila de jugador, se expande un panel de acciones **inline** (debajo de la fila, dentro del mismo acordeón). Solo un jugador puede tener el panel abierto a la vez.

El panel contiene 3 acciones:

### 👁 Ver detalle
Expande una sub-fila con los datos del jugador:
- DNI
- Patente (si existe)
- Categoría actual (nombre)

### ↔ Cambiar categoría
Muestra un `<select>` con todas las categorías disponibles, pre-seleccionada la actual. Al cambiar el valor, llama `api.updateMember(id, { categoria_id: newId })` inmediatamente. Muestra feedback visual (spinner o check) durante la llamada.

### ⚡ Activar / Desactivar
Botón toggle. Si `activo === true` muestra "Desactivar", si `false` muestra "Activar". Al presionar, llama `api.updateMember(id, { activo: !m.activo })`. Tras la llamada exitosa, actualiza el estado local `members` para reflejar el cambio sin recargar toda la lista.

## Estado nuevo en Admin

```ts
const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
```

Toggle: si `expandedPlayer === m.id` → set null; si no → set m.id. Al colapsar la categoría, el panel de jugador también colapsa (no necesita manejo especial si `PlayerList` es recreado en cada render).

## API

- `api.updateMember(id: string, data: Partial<Member>): Promise<Member>` — ya existe.
- Tras actualizar, hacer `setMembers(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m))` para actualidad local.

## Función de color de avatar

```ts
function avatarColor(name: string): string {
  const colors = ['#c0392b','#8e44ad','#2980b9','#16a085','#d35400','#27ae60','#2c3e50'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
```

## Sin cambios en

- API (`api.ts`) — `updateMember` ya existe.
- Backend — no se necesitan nuevos endpoints.
- Otras pestañas.
