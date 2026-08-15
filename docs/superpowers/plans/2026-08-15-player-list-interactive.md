# Player List Visual e Interactiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los chips de texto en el acordeón de categorías por filas visuales con avatar, badge de estado, y panel de acciones rápidas (ver detalle, cambiar categoría, activar/desactivar).

**Architecture:** Todo vive en `frontend/src/pages/Admin.tsx`. Se reescribe el componente `PlayerList` para mostrar filas interactivas, se agrega estado `expandedPlayer` en el componente, y se usan las funciones `api.updateMember` ya existentes para las acciones. Los cambios optimistas actualizan `members` en estado local sin recargar toda la lista.

**Tech Stack:** React, TypeScript, Tailwind CSS, `api.updateMember` (ya existe en `frontend/src/lib/api.ts`)

---

### Task 1: Función avatarColor + refactor PlayerList a filas con avatar y badge

**Files:**
- Modify: `frontend/src/pages/Admin.tsx` — función `avatarColor` y componente `PlayerList` (líneas 49–87)

- [ ] **Step 1: Agregar función avatarColor antes de PlayerList**

Insertar antes de `function PlayerList(...)`:

```tsx
function avatarColor(name: string): string {
  const colors = ['#c0392b','#8e44ad','#2980b9','#16a085','#d35400','#27ae60','#2c3e50'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
```

- [ ] **Step 2: Actualizar la firma de PlayerList para recibir props adicionales**

Reemplazar la firma actual:
```tsx
function PlayerList({ members, categoriaId }: { members: Member[]; categoriaId: number })
```
Por:
```tsx
function PlayerList({
  members, categoriaId, categorias, onUpdateMember,
}: {
  members: Member[];
  categoriaId: number;
  categorias: Categoria[];
  onUpdateMember: (id: string, changes: Partial<Member>) => Promise<void>;
})
```

- [ ] **Step 3: Reemplazar el cuerpo de PlayerList completo**

Reemplazar todo el contenido del componente `PlayerList` (desde `const players = ...` hasta el `return`) con:

```tsx
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const players = members
    .filter(m => m.categoria_id === categoriaId)
    .sort((a, b) => {
      const apellidoA = (a.apellido || '').toLowerCase();
      const apellidoB = (b.apellido || '').toLowerCase();
      if (apellidoA !== apellidoB) return apellidoA.localeCompare(apellidoB, 'es');
      return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase(), 'es');
    });

  return (
    <div style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
      {players.length === 0 ? (
        <p className="text-xs px-4 py-3" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
          Sin jugadores asignados
        </p>
      ) : (
        <div>
          {players.map(m => {
            const initials = `${(m.apellido || '')[0] || ''}${(m.nombre || '')[0] || ''}`.toUpperCase();
            const bgColor = avatarColor(`${m.apellido}${m.nombre}`);
            const isOpen = expandedPlayer === m.id;
            return (
              <div key={m.id}>
                {/* Fila del jugador */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none transition-colors"
                  style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.06)' }}
                  onClick={() => setExpandedPlayer(isOpen ? null : m.id)}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ backgroundColor: bgColor }}
                  >
                    {initials}
                  </div>
                  {/* Nombre */}
                  <span className="flex-1 text-sm font-medium text-white">
                    {m.apellido}, {m.nombre}
                  </span>
                  {/* Badge estado */}
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={m.activo
                      ? { backgroundColor: 'rgb(39 174 96 / 0.15)', color: '#27ae60', border: '1px solid rgb(39 174 96 / 0.3)' }
                      : { backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }
                    }
                  >
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  {/* Chevron */}
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
                    style={{ color: 'var(--brand-muted)', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Panel de acciones — Task 2 lo implementa */}
                {isOpen && (
                  <PlayerActions
                    member={m}
                    categorias={categorias}
                    onUpdateMember={onUpdateMember}
                    onClose={() => setExpandedPlayer(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
```

> Nota: `PlayerActions` se define en Task 2. El archivo no compilará hasta entonces.

- [ ] **Step 4: Actualizar los call sites de PlayerList en el JSX del componente Admin**

Buscar `<PlayerList members={members} categoriaId={c.id} />` y reemplazar con:

```tsx
<PlayerList
  members={members}
  categoriaId={c.id}
  categorias={categorias}
  onUpdateMember={handlePlayerUpdate}
/>
```

- [ ] **Step 5: Agregar handler handlePlayerUpdate en el componente Admin**

En la sección de handlers (cerca de `handleToggle`, línea ~170), agregar:

```tsx
const handlePlayerUpdate = async (id: string, changes: Partial<Member>) => {
  await api.updateMember(id, changes);
  setMembers(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
};
```

- [ ] **Step 6: Commit parcial**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend
git add frontend/src/pages/Admin.tsx
git commit -m "feat: PlayerList con avatar, badge de estado y estructura de acciones"
```

---

### Task 2: Componente PlayerActions con las 3 acciones

**Files:**
- Modify: `frontend/src/pages/Admin.tsx` — agregar `PlayerActions` antes de `PlayerList`

- [ ] **Step 1: Agregar componente PlayerActions**

Insertar antes de `function avatarColor(...)`:

```tsx
function PlayerActions({
  member, categorias, onUpdateMember, onClose,
}: {
  member: Member;
  categorias: Categoria[];
  onUpdateMember: (id: string, changes: Partial<Member>) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleToggleActivo = async () => {
    setLoading('activo');
    await onUpdateMember(member.id, { activo: !member.activo });
    setLoading(null);
    onClose();
  };

  const handleCategoriaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newCatId = val === '' ? null : parseInt(val);
    setLoading('cat');
    await onUpdateMember(member.id, { categoria_id: newCatId });
    setLoading(null);
  };

  return (
    <div
      className="px-4 pb-3 pt-1 flex flex-col gap-2"
      style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.03)', borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}
    >
      {/* Ver detalle */}
      <button
        className="flex items-center gap-2 text-xs py-1.5 text-left w-full"
        style={{ color: 'var(--brand-muted)' }}
        onClick={() => setShowDetail(v => !v)}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Ver detalle
      </button>

      {showDetail && (
        <div className="rounded-lg px-3 py-2 text-xs flex flex-col gap-1"
          style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.06)', color: 'var(--brand-muted)' }}>
          <span><span className="opacity-50">DNI:</span> {member.dni}</span>
          {member.patente && <span><span className="opacity-50">Patente:</span> {member.patente}</span>}
          <span><span className="opacity-50">Categoría:</span> {member.categoria_nombre || '—'}</span>
        </div>
      )}

      {/* Cambiar categoría */}
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <select
          className="flex-1 text-xs rounded-lg px-2 py-1.5 appearance-none"
          style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)', color: 'var(--brand-muted)' }}
          value={member.categoria_id ?? ''}
          onChange={handleCategoriaChange}
          disabled={loading === 'cat'}
        >
          <option value="">Sin categoría</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        {loading === 'cat' && (
          <span className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>Guardando…</span>
        )}
      </div>

      {/* Activar / Desactivar */}
      <button
        className="flex items-center gap-2 text-xs py-1.5 text-left w-full"
        style={{ color: member.activo ? '#e74c3c' : '#27ae60' }}
        onClick={handleToggleActivo}
        disabled={loading === 'activo'}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={member.activo
            ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
        </svg>
        {loading === 'activo' ? 'Guardando…' : member.activo ? 'Desactivar jugador' : 'Activar jugador'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que el archivo compila sin errores**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend/frontend
npx tsc --noEmit 2>&1
```

Si `tsc` no está disponible, verificar visualmente que no haya referencias a tipos o funciones indefinidas.

- [ ] **Step 3: Verificar en browser**

Iniciar dev server:
```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend/frontend
npm run dev
```

Navegar a `/admin` → pestaña Categorías → expandir una categoría. Verificar:
1. Cada jugador muestra avatar circular con iniciales de color único.
2. Badge verde "Activo" / gris "Inactivo" correcto.
3. Al tocar jugador, aparece panel con 3 opciones.
4. "Ver detalle" muestra DNI, patente, categoría.
5. "Cambiar categoría" actualiza sin recargar toda la página.
6. "Activar/Desactivar" cambia el badge inmediatamente.
7. Solo un jugador puede tener el panel abierto a la vez.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend
git add frontend/src/pages/Admin.tsx
git commit -m "feat: acciones rápidas en jugadores (detalle, cambiar categoría, activar)"
```
