# Categorías Acordeón Expandible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que cada categoría en la pestaña Categorías sea expandible con un tap, mostrando la lista de jugadores asignados ordenados alfabéticamente.

**Architecture:** Todo el cambio vive en `Admin.tsx` — se agrega un estado `expandedCat` y se modifica el render de la lista de categorías para mostrar un panel de jugadores inline cuando la categoría está expandida. No se necesitan cambios en la API ni en el backend porque `members` ya está disponible en el componente.

**Tech Stack:** React, TypeScript, Tailwind CSS (clases existentes del proyecto)

---

### Task 1: Agregar estado expandedCat y hacer la fila clickeable

**Files:**
- Modify: `frontend/src/pages/Admin.tsx` (sección categorías, líneas ~481–500)

- [ ] **Step 1: Agregar estado**

Buscar el bloque de estados al inicio del componente `Admin` (cerca de donde están `tab`, `members`, `categorias`) y agregar:

```tsx
const [expandedCat, setExpandedCat] = useState<number | null>(null);
```

Asegurarse que `useState` ya está importado (lo está).

- [ ] **Step 2: Modificar la fila de categoría para ser clickeable con chevron**

Reemplazar el bloque del `categorias.map` (líneas ~481–500 en Admin.tsx):

```tsx
{categorias.map(c => {
  const count = members.filter(m => m.categoria_id === c.id).length;
  const isExpanded = expandedCat === c.id;
  return (
    <div key={c.id} className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
      {/* Fila principal clickeable */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpandedCat(isExpanded ? null : c.id)}
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
            style={{
              color: 'var(--brand-muted)',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <p className="text-white font-semibold text-sm">{c.nombre}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
              {count} jugador{count !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); handleDeleteCategoria(c); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[rgba(204,34,34,0.4)] border border-[rgba(204,34,34,0.15)] bg-transparent transition-all duration-150 active:scale-90 hover:bg-[rgba(204,34,34,0.12)] hover:border-[rgba(204,34,34,0.45)] hover:text-[#FF6B6B]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Panel expandible de jugadores */}
      {isExpanded && (
        <PlayerList members={members} categoriaId={c.id} />
      )}
    </div>
  );
})}
```

- [ ] **Step 3: Verificar que el archivo compila**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: error sobre `PlayerList` no definido (lo definimos en Task 2). Ignorar ese error por ahora.

- [ ] **Step 4: Commit parcial**

```bash
git add frontend/src/pages/Admin.tsx
git commit -m "feat: fila de categoría clickeable con chevron expandible"
```

---

### Task 2: Implementar el componente PlayerList

**Files:**
- Modify: `frontend/src/pages/Admin.tsx` (agregar componente antes del export default)

- [ ] **Step 1: Agregar el componente PlayerList**

Antes de la línea `export default function Admin()` en `Admin.tsx`, agregar:

```tsx
function PlayerList({ members, categoriaId }: { members: import('../lib/api').Member[]; categoriaId: number }) {
  const players = members
    .filter(m => m.categoria_id === categoriaId)
    .sort((a, b) => {
      const apellidoA = (a.apellido || '').toLowerCase();
      const apellidoB = (b.apellido || '').toLowerCase();
      if (apellidoA !== apellidoB) return apellidoA.localeCompare(apellidoB, 'es');
      return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase(), 'es');
    });

  return (
    <div
      className="px-4 pb-3 pt-1"
      style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
    >
      {players.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
          Sin jugadores asignados
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {players.map(m => (
            <span
              key={m.id}
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)',
                border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)',
                color: 'var(--brand-muted)',
              }}
            >
              {m.apellido} {m.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

> **Nota:** Si `Member` ya está importado en el archivo (búsqueda: `import.*Member.*from`), usar `Member` directamente sin el `import(...)` inline. Revisar los imports al tope del archivo antes de escribir.

- [ ] **Step 2: Verificar que el archivo compila sin errores**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin errores de TypeScript.

- [ ] **Step 3: Verificar en browser**

Iniciar el dev server si no está corriendo:

```bash
cd frontend && npm run dev
```

Navegar a la pestaña Categorías en el admin. Verificar:
1. Cada categoría muestra un chevron `>` a la izquierda.
2. Al hacer click en la fila, el chevron rota 90° y aparece el panel de jugadores.
3. Los jugadores están ordenados alfabéticamente por apellido.
4. Al hacer click en otra categoría, la anterior se colapsa.
5. El botón eliminar (papelera) no abre/cierra el acordeón.
6. Una categoría sin jugadores muestra "Sin jugadores asignados".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Admin.tsx
git commit -m "feat: acordeón de jugadores por categoría con orden alfabético"
```
