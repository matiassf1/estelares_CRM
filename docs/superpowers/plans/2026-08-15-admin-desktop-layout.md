# Admin Desktop Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un layout responsive al panel admin: sidebar fija en desktop (≥768px) con navegación vertical, manteniendo el layout mobile actual intacto.

**Architecture:** Todo en `frontend/src/pages/Admin.tsx`. Se envuelve el contenido existente en un flex container responsive. En mobile los tabs horizontales quedan igual; en desktop se ocultan (`md:hidden`) y aparece un sidebar con nav vertical (`hidden md:flex`). No se crean archivos nuevos ni se cambia lógica de negocio.

**Tech Stack:** React, TypeScript, Tailwind CSS (clases `md:` para breakpoint 768px)

---

### Task 1: Restructurar el layout raíz para soportar sidebar en desktop

**Files:**
- Modify: `frontend/src/pages/Admin.tsx` — wrapper del contenido (líneas ~247–278)

El return actual tiene esta estructura:
```tsx
<div className="min-h-screen pattern-lines" style={{ backgroundColor: 'var(--brand-bg)' }}>
  {/* Header */}
  <div className="sticky top-0 z-50 ...">...</div>

  <div className="p-5 max-w-lg mx-auto">
    {/* Stats */}
    {/* Tabs */}
    {/* Tab content */}
  </div>
</div>
```

- [ ] **Step 1: Reemplazar el wrapper interior**

Reemplazar:
```tsx
<div className="p-5 max-w-lg mx-auto">
```

Con:
```tsx
<div className="flex min-h-[calc(100vh-56px)]">
```

> Nota: `56px` es la altura aproximada del header. Ajustar si el header tiene otra altura real (medir con DevTools si es necesario — el header tiene `py-3` y texto ~20px, total ~56px).

- [ ] **Step 2: Agregar el sidebar (visible solo en desktop)**

Inmediatamente dentro del nuevo wrapper, ANTES del contenido existente (stats/tabs), agregar:

```tsx
{/* Sidebar desktop */}
<aside
  className="hidden md:flex flex-col w-52 flex-shrink-0 sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto"
  style={{ backgroundColor: 'var(--brand-surface)', borderRight: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}
>
  {/* Logo + título */}
  <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
    <ClubShield size={24} className="opacity-90" />
    <div>
      <p className="text-white text-xs font-semibold leading-tight">Estelares Futsal</p>
      <p className="text-[10px] leading-tight" style={{ color: 'var(--brand-muted)' }}>Panel Admin</p>
    </div>
  </div>

  {/* Navegación */}
  <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
    {(['jugadores', 'categorias', 'parking'] as const).map(t => (
      <button
        key={t}
        onClick={() => setTab(t)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-left"
        style={tab === t
          ? { backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.12)', color: 'var(--brand-primary)', borderLeft: '2px solid var(--brand-primary)', paddingLeft: '10px' }
          : { color: 'var(--brand-muted)', borderLeft: '2px solid transparent', paddingLeft: '10px' }
        }
      >
        {t === 'jugadores' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ) : t === 'categorias' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        )}
        {t === 'jugadores' ? 'Jugadores' : t === 'categorias' ? 'Categorías' : 'Parking'}
      </button>
    ))}
  </nav>

  {/* Stats en sidebar */}
  <div className="px-5 py-4" style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--brand-muted)' }}>Ingresos hoy</span>
        <span className="text-sm font-bold text-white">{stats.today}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--brand-muted)' }}>Activos</span>
        <span className="text-sm font-bold text-white">{stats.total}</span>
      </div>
    </div>
  </div>
</aside>
```

- [ ] **Step 3: Envolver el contenido principal en un div flex-1**

El contenido que sigue al sidebar (stats + tabs + contenido) debe quedar envuelto en:

```tsx
<div className="flex-1 p-5 md:p-8 md:max-w-3xl">
  {/* Stats — ocultar en desktop porque ya están en sidebar */}
  <div className="grid grid-cols-2 gap-3 mb-6 mt-2 md:hidden">
    {/* ... stats existentes sin cambios ... */}
  </div>

  {/* Tabs — ocultar en desktop */}
  <div className="flex gap-1 mb-5 p-1 rounded-xl animate-slide-up md:hidden" ...>
    {/* ... tabs existentes sin cambios ... */}
  </div>

  {/* Título de sección en desktop */}
  <div className="hidden md:block mb-6">
    <h2 className="text-lg font-semibold text-white">
      {tab === 'jugadores' ? 'Jugadores' : tab === 'categorias' ? 'Categorías' : 'Parking'}
    </h2>
  </div>

  {/* Tab content — sin cambios */}
  <div key={tab} className="animate-fade-in">
    {/* ... todo el contenido existente de tabs ... */}
  </div>
</div>
```

- [ ] **Step 4: Ocultar el título "Estelares Futsal / Panel Admin" del header en desktop**

En el header, el bloque con `ClubShield` y el texto "Estelares Futsal / Panel Admin" puede ocultarse en desktop ya que el sidebar lo repite:

```tsx
<div className="flex items-center gap-3 md:hidden">
  <ClubShield size={30} className="opacity-90" />
  <div>
    <p className="text-white text-sm font-semibold leading-tight">Estelares Futsal</p>
    <p className="text-xs leading-tight" style={{ color: 'var(--brand-muted)' }}>Panel Admin</p>
  </div>
</div>
```

Y agregar un placeholder vacío para que el header mantenga `justify-between`:
```tsx
<div className="hidden md:block" /> {/* spacer desktop */}
```

- [ ] **Step 5: Verificar en browser en mobile Y desktop**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend/frontend
npm run dev
```

Verificar en mobile (< 768px):
1. Layout exactamente igual al anterior — stats, tabs horizontales, contenido.
2. Sidebar NO visible.

Verificar en desktop (≥ 768px / DevTools > 768px):
1. Sidebar fija a la izquierda con nav vertical.
2. Ítem activo resaltado con borde rojo izquierdo.
3. Stats en la parte inferior del sidebar.
4. Contenido principal a la derecha con más padding.
5. Tabs horizontales NO visibles.
6. Al hacer click en nav del sidebar, cambia la sección sin recargar.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/sferm/orca/workspaces/estelares/Estelares-Agent-Frontend
git add frontend/src/pages/Admin.tsx
git commit -m "feat: layout desktop admin con sidebar responsiva"
```
