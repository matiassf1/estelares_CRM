# Panel de administración — base e Inicio · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar un solo tema visual, partir `Admin.tsx` en una página por sección con navegación de cinco destinos, y construir la pantalla de Inicio que hoy no existe.

**Architecture:** Un endpoint nuevo `GET /api/admin/dashboard` concentra los contadores del Inicio para no encadenar cinco llamadas al abrir. En el frontend, `Admin.tsx` (846 líneas) se parte en `AdminLayout` más una página por sección; las páginas se mueven **sin reescribirse** para que el refactor no arrastre cambios de comportamiento. El tema único se logra colapsando el bloque `[data-theme="escudo"]` en `:root`, lo que permite borrar diez reglas de override, incluida una que matchea por substring del atributo `style` inline.

**Tech Stack:** Express + TypeScript + `pg` (sin ORM) · React + Vite + Tailwind · Vitest + supertest contra PostgreSQL real.

**Spec:** `docs/superpowers/specs/2026-10-24-panel-admin-rediseno-design.md`

**Alcance:** piezas 1 y 2 del spec. Los horarios de entrenamiento (pieza 3), acciones masivas (pieza 4) y Config (pieza 5) tienen su propio plan.

---

## Preparación del entorno

Los tests de integración necesitan PostgreSQL:

```bash
docker run -d --name estelares-test-pg \
  -e POSTGRES_DB=estelares_test -e POSTGRES_USER=estelares -e POSTGRES_PASSWORD=estelares \
  -p 55432:5432 postgres:16-alpine
```

Verificar que la suite actual está verde antes de empezar:

```bash
npm run test:int
# Esperado: Tests 72 passed (72)
```

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/routes/admin-dashboard.ts` | **Crear.** Endpoint con los contadores del Inicio |
| `src/routes/__tests__/dashboard.int.test.ts` | **Crear.** Tests de integración del endpoint |
| `src/app.ts` | **Modificar.** Montar el router nuevo |
| `frontend/src/index.css` | **Modificar.** Colapsar tema, borrar overrides |
| `frontend/src/App.tsx` | **Modificar.** Quitar `useTheme()` |
| `frontend/src/hooks/useTheme.ts` | **Borrar.** |
| `frontend/src/components/ThemeToggle.tsx` | **Borrar.** Ya era código muerto |
| `frontend/src/lib/api.ts` | **Modificar.** Tipos y método del dashboard |
| `frontend/src/pages/admin/AdminLayout.tsx` | **Crear.** Topbar, navegación, ruteo de secciones |
| `frontend/src/pages/admin/InicioPage.tsx` | **Crear.** Pendientes, pulso, categorías |
| `frontend/src/pages/admin/JugadoresPage.tsx` | **Crear.** Extraído de `Admin.tsx`, sin cambios de comportamiento |
| `frontend/src/pages/admin/ClubPage.tsx` | **Crear.** Categorías + cocheras extraídas de `Admin.tsx` |
| `frontend/src/components/admin/PendingCard.tsx` | **Crear.** Tarjeta accionable del Inicio |
| `frontend/src/pages/Admin.tsx` | **Modificar.** Queda como cáscara que renderiza `AdminLayout` |

---

## Task 1: Tema único

**Files:**
- Modify: `frontend/src/index.css:1-80`
- Modify: `frontend/src/index.css:173` (`.btn-red:active`)
- Modify: `frontend/src/App.tsx:3`, `frontend/src/App.tsx:94`
- Delete: `frontend/src/hooks/useTheme.ts`
- Delete: `frontend/src/components/ThemeToggle.tsx`

- [ ] **Step 1: Confirmar que `ThemeToggle` no se usa**

```bash
cd frontend && grep -rn "ThemeToggle" src/ --include=*.tsx
```
Esperado: sólo la línea de su propia definición en `src/components/ThemeToggle.tsx:3`. Si aparece renderizado en alguna página, **detenerse** y reportarlo: el plan asume que es código muerto.

- [ ] **Step 2: Reemplazar los bloques de tema en `index.css`**

Sustituir todo el contenido desde la línea 1 hasta `@tailwind base;` (exclusive) por:

```css
/* Tema único: negro, blanco y dorado.
   Antes había dos temas (`clasico` rojo y `escudo` monocromo) conmutados por
   un toggle que nunca se renderizaba. Los valores de abajo son los de `escudo`,
   que era el que corría por defecto. `--brand-gold` no se redefinía en aquel
   bloque: por eso el dorado sobrevivía, y es el tercer color de la identidad. */
:root {
  /* hex directo — para var(--brand-xxx) en estilos inline */
  --brand-primary: #E8E8E8;
  --brand-primary-dark: #C0C0C0;
  --brand-primary-darker: #909090;
  /* Texto sobre fondo primario. Reemplaza al hack que matcheaba
     button[style*="brand-primary"] por substring del atributo style. */
  --brand-on-primary: #000000;
  --brand-accent: #909090;
  --brand-gold: #C9A84C;
  --brand-accent-lt: #D0D0D0;
  --brand-bg: #000000;
  --brand-surface: #0C0C0C;
  --brand-surface-2: #181818;
  --brand-border: #2E2E2E;
  --brand-muted: #5A5A5A;
  --brand-input-bg: #080808;
  --brand-danger: #f87171;
  --brand-ok: #3FB56B;
  /* RGB separado por espacios — para rgb(var() / alpha) de Tailwind */
  --brand-primary-rgb: 232 232 232;
  --brand-primary-dark-rgb: 192 192 192;
  --brand-accent-rgb: 144 144 144;
  --brand-gold-rgb: 201 168 76;
  --brand-accent-lt-rgb: 208 208 208;
  --brand-bg-rgb: 0 0 0;
  --brand-surface-rgb: 12 12 12;
  --brand-surface-2-rgb: 24 24 24;
  --brand-border-rgb: 46 46 46;
  --brand-muted-rgb: 90 90 90;
}
```

- [ ] **Step 3: Ajustar las dos reglas que tenían hardcodeado el rojo**

En `index.css`, reemplazar la línea del hero del login:

```css
/* El hero del login usa brand-primary, ahora casi blanco → fondo oscuro explícito */
.animate-diagonal-in:not(.pattern-lines) {
  background: linear-gradient(135deg, #1C1C1C 0%, #0D0D0D 55%, transparent 55%);
}
```

Y reemplazar `.btn-red:active` (línea 173), que tenía el glow rojo `rgba(204,34,34,0.55)`:

```css
.btn-red:active { box-shadow: 0 0 20px rgba(232, 232, 232, 0.35); }
```

- [ ] **Step 4: Hacer visibles las líneas diagonales sobre negro puro**

Reemplazar el bloque `.pattern-lines` (línea 117) por la variante que antes vivía bajo `[data-theme="escudo"]`:

```css
.pattern-lines {
  background-image: repeating-linear-gradient(
    -55deg, transparent 0px, transparent 6px,
    rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px
  );
  background-attachment: fixed;
}
```

- [ ] **Step 5: Verificar que no quedó ninguna regla de tema**

```bash
cd frontend && grep -c "data-theme" src/index.css
```
Esperado: `0`

- [ ] **Step 6: Quitar el hook de App.tsx y borrar los archivos muertos**

En `frontend/src/App.tsx`, borrar la línea 3 (`import { useTheme } from './hooks/useTheme.ts';`) y la línea 94 (`useTheme(); // initializes theme from localStorage on mount`), dejando:

```tsx
export default function App() {
  return (
    <AssocAuthProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </AssocAuthProvider>
  );
}
```

```bash
cd frontend && rm src/hooks/useTheme.ts src/components/ThemeToggle.tsx
```

- [ ] **Step 7: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sin salida (exit 0). Si aparece `Cannot find module './hooks/useTheme.ts'`, quedó un import sin borrar.

- [ ] **Step 8: Revisión visual**

```bash
cd frontend && npm run dev
```
Abrir `/login`, `/carnet` y `/admin`. Verificar que **ningún botón queda con texto blanco sobre fondo blanco**: era lo que compensaba el hack borrado. Los botones con `backgroundColor: 'var(--brand-primary)'` necesitan `color: 'var(--brand-on-primary)'` explícito — anotar cuáles lo necesitan y arreglarlos en este mismo paso.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/index.css frontend/src/App.tsx
git add -u frontend/src/hooks frontend/src/components
git commit -m "refactor: tema visual único negro, blanco y dorado

Había dos temas conmutados por un toggle que nunca se renderizaba: escudo
era el que corría. Se colapsa en :root y se borran las diez reglas
[data-theme], incluida la que matcheaba button[style*=\"brand-primary\"] por
substring del atributo style inline. La reemplaza el token
--brand-on-primary."
```

---

## Task 2: Endpoint del dashboard

**Files:**
- Create: `src/routes/admin-dashboard.ts`
- Create: `src/routes/__tests__/dashboard.int.test.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/routes/__tests__/dashboard.int.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { suspend } from '../../services/membership';
import { resetDb, getAdminId, createMember, addCheckIn } from '../../services/__tests__/helpers';

const app = createApp();
let adminId: string;
let token: string;

beforeEach(async () => {
  await resetDb();
  adminId = await getAdminId();
  token = signToken({ id: adminId, type: 'admin' });
});

afterAll(async () => {
  await pool.end();
});

const auth = () => ({ Authorization: `Bearer ${token}` });
const get = () => request(app).get('/api/admin/dashboard').set(auth());

describe('GET /api/admin/dashboard', () => {
  it('exige rol admin', async () => {
    await request(app).get('/api/admin/dashboard').expect(401);
    const { rows } = await pool.query(`SELECT id FROM admins WHERE role='portero' LIMIT 1`);
    await request(app)
      .get('/api/admin/dashboard')
      .set({ Authorization: `Bearer ${signToken({ id: rows[0].id, type: 'portero' })}` })
      .expect(403);
  });

  it('cuenta a los que se descolgaron: activos con historial y sin venir hace +21 días', async () => {
    const viejo = await createMember();
    await addCheckIn(viejo, 40);
    const reciente = await createMember();
    await addCheckIn(reciente, 3);
    await createMember(); // sin historial: no se descolgó, nunca vino

    const res = await get().expect(200);
    expect(res.body.pendientes.descolgados).toBe(1);
  });

  it('un suspendido no cuenta como descolgado', async () => {
    const id = await createMember();
    await addCheckIn(id, 40);
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });

    const res = await get().expect(200);
    expect(res.body.pendientes.descolgados).toBe(0);
  });

  it('cuenta los pendientes de revisión, sin foto y los horarios cargados', async () => {
    const id = await createMember();
    await pool.query(
      `INSERT INTO membership_periods
         (member_id, kind, effective_from, reason, created_by, legacy_migrated)
       VALUES ($1,'SUSPENSION',CAST((NOW() - INTERVAL '3 hours') AS DATE),'migrado',$2,true)`,
      [id, adminId]
    );
    const conFoto = await createMember();
    await pool.query(`UPDATE members SET foto_url='x' WHERE id=$1`, [conFoto]);
    await createMember(); // activo sin foto

    const res = await get().expect(200);
    expect(res.body.pendientes.a_revisar).toBe(1);
    expect(res.body.pendientes.sin_foto).toBe(1);
    expect(res.body.pendientes.horarios).toBe(0);
  });

  it('devuelve el pulso del club', async () => {
    const a = await createMember();
    await createMember();
    await addCheckIn(a, 2);
    await suspend({ memberId: a, reason: 'x', actorId: adminId });

    const res = await get().expect(200);
    expect(res.body.club.activos).toBe(1);
    expect(res.body.club.suspendidos).toBe(1);
    expect(res.body.club.ingresos_7d).toBe(1);
    expect(res.body.club.jugadores_7d).toBe(1);
  });

  it('clasifica las categorías por necesidad de atención', async () => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('AlDia'),('Tibia'),('Parada') RETURNING id, nombre`
    );
    const byName = Object.fromEntries(rows.map(r => [r.nombre, r.id]));

    const alDia = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.AlDia, alDia]);
    await addCheckIn(alDia, 1);

    const tibia = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Tibia, tibia]);
    await addCheckIn(tibia, 10);

    const parada = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Parada, parada]);
    await addCheckIn(parada, 40);

    const res = await get().expect(200);
    const estado = Object.fromEntries(
      res.body.categorias.map((c: { nombre: string; estado: string }) => [c.nombre, c.estado])
    );
    expect(estado.AlDia).toBe('ok');
    expect(estado.Tibia).toBe('warn');
    expect(estado.Parada).toBe('alert');
  });

  it('ordena las categorías poniendo primero las que necesitan atención', async () => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('Uno'),('Dos') RETURNING id, nombre`
    );
    const byName = Object.fromEntries(rows.map(r => [r.nombre, r.id]));
    const ok = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Uno, ok]);
    await addCheckIn(ok, 1);
    const mal = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Dos, mal]);
    await addCheckIn(mal, 40);

    const res = await get().expect(200);
    expect(res.body.categorias[0].nombre).toBe('Dos');
  });

  it('una categoría sin jugadores activos no aparece', async () => {
    await pool.query(`INSERT INTO categorias (nombre) VALUES ('Vacia')`);
    const res = await get().expect(200);
    expect(res.body.categorias.map((c: { nombre: string }) => c.nombre)).not.toContain('Vacia');
  });

  it('una base vacía devuelve ceros sin romperse', async () => {
    const res = await get().expect(200);
    expect(res.body.pendientes).toEqual({ descolgados: 0, a_revisar: 0, sin_foto: 0, horarios: 0 });
    expect(res.body.club.activos).toBe(0);
    expect(res.body.categorias).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm run test:int -- dashboard
```
Esperado: FAIL — todas con `404` porque la ruta todavía no existe.

- [ ] **Step 3: Implementar el endpoint**

Crear `src/routes/admin-dashboard.ts`:

```ts
import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

/** Días sin registrar ingreso a partir de los cuales se considera que alguien se descolgó. */
const DIAS_DESCOLGADO = 21;
/** Días sin actividad a partir de los cuales una categoría pasa a "atención". */
const DIAS_CATEGORIA_TIBIA = 7;

/**
 * Contadores del Inicio en una sola llamada. Son conteos sobre tablas chicas
 * (cientos de filas); si el club creciera, acá es donde hay que medir.
 */
router.get('/dashboard', async (_req, res) => {
  const [pendientes, club, categorias] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM (
            SELECT m.id FROM members m
            JOIN member_membership_state s ON s.member_id = m.id AND s.status = 'ACTIVE'
            JOIN check_ins ci ON ci.member_id = m.id
            GROUP BY m.id
            HAVING MAX(ci.checked_in_at) < NOW() - ($1::int * INTERVAL '1 day')
          ) q) AS descolgados,
         (SELECT COUNT(*) FROM member_membership_state WHERE needs_review) AS a_revisar,
         (SELECT COUNT(*) FROM members m
            JOIN member_membership_state s ON s.member_id = m.id AND s.status = 'ACTIVE'
            WHERE m.foto_url IS NULL) AS sin_foto,
         (SELECT COUNT(*) FROM training_schedules WHERE valid_until IS NULL) AS horarios`,
      [DIAS_DESCOLGADO]
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM member_membership_state WHERE status = 'ACTIVE') AS activos,
         (SELECT COUNT(*) FROM member_membership_state WHERE status = 'SUSPENDED') AS suspendidos,
         (SELECT COUNT(*) FROM member_membership_state WHERE status = 'TERMINATED') AS bajas,
         (SELECT COUNT(*) FROM check_ins WHERE checked_in_at > NOW() - INTERVAL '7 days') AS ingresos_7d,
         (SELECT COUNT(DISTINCT member_id) FROM check_ins
            WHERE checked_in_at > NOW() - INTERVAL '7 days') AS jugadores_7d`
    ),
    pool.query(
      `SELECT c.id, c.nombre,
              COUNT(DISTINCT m.id) AS activos,
              MAX(CAST((ci.checked_in_at - INTERVAL '3 hours') AS DATE)) AS ultimo_ingreso,
              CASE
                WHEN COALESCE(MAX(ci.checked_in_at), '-infinity'::timestamp)
                     < NOW() - ($1::int * INTERVAL '1 day') THEN 'alert'
                WHEN MAX(ci.checked_in_at) < NOW() - ($2::int * INTERVAL '1 day') THEN 'warn'
                ELSE 'ok'
              END AS estado
       FROM categorias c
       JOIN members m ON m.categoria_id = c.id
       JOIN member_membership_state s ON s.member_id = m.id AND s.status = 'ACTIVE'
       LEFT JOIN check_ins ci ON ci.member_id = m.id
       GROUP BY c.id, c.nombre
       ORDER BY CASE
                  WHEN COALESCE(MAX(ci.checked_in_at), '-infinity'::timestamp)
                       < NOW() - ($1::int * INTERVAL '1 day') THEN 0
                  WHEN MAX(ci.checked_in_at) < NOW() - ($2::int * INTERVAL '1 day') THEN 1
                  ELSE 2
                END,
                c.nombre`,
      [DIAS_DESCOLGADO, DIAS_CATEGORIA_TIBIA]
    ),
  ]);

  const p = pendientes.rows[0];
  const c = club.rows[0];
  const n = (v: string) => parseInt(v, 10);

  res.json({
    pendientes: {
      descolgados: n(p.descolgados),
      a_revisar: n(p.a_revisar),
      sin_foto: n(p.sin_foto),
      horarios: n(p.horarios),
    },
    club: {
      activos: n(c.activos),
      suspendidos: n(c.suspendidos),
      bajas: n(c.bajas),
      ingresos_7d: n(c.ingresos_7d),
      jugadores_7d: n(c.jugadores_7d),
    },
    categorias: categorias.rows.map(r => ({
      id: r.id,
      nombre: r.nombre,
      activos: n(r.activos),
      ultimo_ingreso: r.ultimo_ingreso
        ? new Date(r.ultimo_ingreso).toISOString().slice(0, 10)
        : null,
      estado: r.estado as 'ok' | 'warn' | 'alert',
    })),
  });
});

export default router;
```

- [ ] **Step 4: Montar el router**

En `src/app.ts`, agregar junto a los otros imports de admin:

```ts
import adminDashboardRoutes from './routes/admin-dashboard';
```

Y montarlo inmediatamente después de `app.use('/api/admin', adminMembershipRoutes);`:

```ts
  app.use('/api/admin', adminDashboardRoutes);
```

- [ ] **Step 5: Correr los tests**

```bash
npm run test:int -- dashboard
```
Esperado: `Tests 9 passed (9)`

- [ ] **Step 6: Verificar que no hubo regresión**

```bash
npm run test:int && npx tsc --noEmit
```
Esperado: `Tests 81 passed (81)` y `tsc` sin salida.

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin-dashboard.ts src/routes/__tests__/dashboard.int.test.ts src/app.ts
git commit -m "feat: endpoint de dashboard con los contadores del Inicio

Una sola llamada en vez de encadenar cinco al abrir el panel. Incluye los
jugadores que se descolgaron —activos con historial y sin venir hace más de
21 días—, que hoy no se informan en ninguna pantalla."
```

---

## Task 3: Cliente del dashboard

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Agregar los tipos**

En `frontend/src/lib/api.ts`, antes de `export const api = {`:

```ts
export interface DashboardCategoria {
  id: number;
  nombre: string;
  activos: number;
  ultimo_ingreso: string | null;
  estado: 'ok' | 'warn' | 'alert';
}

export interface DashboardData {
  pendientes: {
    descolgados: number;
    a_revisar: number;
    sin_foto: number;
    horarios: number;
  };
  club: {
    activos: number;
    suspendidos: number;
    bajas: number;
    ingresos_7d: number;
    jugadores_7d: number;
  };
  categorias: DashboardCategoria[];
}
```

- [ ] **Step 2: Agregar el método**

Dentro de `export const api = {`, junto a `getStats`:

```ts
  getDashboard: () =>
    request<DashboardData>('/admin/dashboard'),
```

- [ ] **Step 3: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sin salida.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: cliente del endpoint de dashboard"
```

---

## Task 4: Partir `Admin.tsx` sin cambiar comportamiento

Este task **mueve código, no lo reescribe**. Cualquier cambio de diseño va en los tasks siguientes. Si algo deja de funcionar acá, es un error de movimiento.

**Files:**
- Create: `frontend/src/pages/admin/AdminLayout.tsx`
- Create: `frontend/src/pages/admin/JugadoresPage.tsx`
- Create: `frontend/src/pages/admin/ClubPage.tsx`
- Modify: `frontend/src/pages/Admin.tsx`

- [ ] **Step 1: Capturar el comportamiento actual**

```bash
cd frontend && npm run dev
```
Recorrer las cuatro pestañas y anotar en un archivo temporal: cantidad de jugadores listados, cantidad de categorías, cantidad de cocheras, y que el menú `⋮` abre con sus opciones por estado. Es la referencia contra la que se compara al final del task.

- [ ] **Step 2: Crear `AdminLayout.tsx` con la navegación de cinco destinos**

```tsx
import { useState, type ReactNode } from 'react';
import ClubShield from '../../components/ClubShield.tsx';

export type AdminSection = 'inicio' | 'jugadores' | 'club' | 'analitica' | 'config';

const SECTIONS: { id: AdminSection; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'club', label: 'Club' },
  { id: 'analitica', label: 'Analítica' },
  { id: 'config', label: 'Config' },
];

interface Props {
  section: AdminSection;
  onSection: (s: AdminSection) => void;
  /** Secciones con novedades: muestran un punto dorado. */
  flagged?: AdminSection[];
  onLogout: () => void;
  children: ReactNode;
}

export default function AdminLayout({ section, onSection, flagged = [], onLogout, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen pattern-lines" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Topbar */}
        <div
          className="flex items-center justify-between py-4"
          style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.18)' }}
        >
          <div className="flex items-center gap-3">
            <ClubShield size={30} />
            <div>
              <p className="font-display text-white tracking-widest text-base leading-none">ESTELARES</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--brand-muted)' }}>Panel · admin</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-[11px] px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-border-rgb) / 0.6)' }}
          >
            Salir
          </button>
        </div>

        {/* Navegación — escritorio */}
        <nav
          className="hidden md:flex gap-1 mt-3"
          style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.14)' }}
        >
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => onSection(s.id)}
              className="font-display tracking-widest text-sm px-4 py-2.5"
              style={{
                color: section === s.id ? '#F5F5F0' : 'var(--brand-muted)',
                borderBottom: `2px solid ${section === s.id ? 'var(--brand-primary)' : 'transparent'}`,
              }}
            >
              {s.label}
              {flagged.includes(s.id) && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle"
                  style={{ backgroundColor: 'var(--brand-gold)' }}
                />
              )}
            </button>
          ))}
        </nav>

        <main className="py-5 pb-28 md:pb-10">{children}</main>
      </div>

      {/* Navegación — mobile */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 flex"
        style={{
          backgroundColor: 'var(--brand-surface)',
          borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.18)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => { onSection(s.id); setMenuOpen(false); }}
            className="flex-1 py-2.5 text-[9px] tracking-wider"
            style={{ color: section === s.id ? '#F5F5F0' : 'var(--brand-muted)' }}
          >
            <span className="block text-sm leading-none mb-1">
              {section === s.id ? '◆' : '◇'}
            </span>
            {s.label}
            {flagged.includes(s.id) && (
              <span
                className="inline-block w-1 h-1 rounded-full ml-1 align-middle"
                style={{ backgroundColor: 'var(--brand-gold)' }}
              />
            )}
          </button>
        ))}
      </nav>
      {menuOpen && null}
    </div>
  );
}
```

- [ ] **Step 3: Mover la sección de jugadores a `JugadoresPage.tsx`**

Cortar de `frontend/src/pages/Admin.tsx` el bloque **líneas 300–554** (`{tab === 'jugadores' && (` hasta la línea anterior a `{tab === 'categorias' && (`) junto con **todo** el estado y los handlers que usa: `members`, `stats`, `search`, `memberFilter`, `filterCatId`, `editPanel`, `sheetMember`, `membershipSheet`, `historyMember`, `toast`, `load`, `openCreate`, `openEdit`, `playerActionItems`, `isActive`, `CHIP_LABEL`, `filtered`, más los helpers `VehicleIcon` y `getInitials` que consume.

Pegarlo en `frontend/src/pages/admin/JugadoresPage.tsx` como un componente que no recibe props y maneja su propio estado. Ajustar las rutas de import sumando un nivel (`../../lib/api.ts`, `../../components/admin/...`).

**No cambiar ninguna lógica.** La acción «Asignar cochera» hacía `setTab('parking')`; reemplazarla por una prop `onIrACocheras: () => void` que `AdminLayout` cablea a `onSection('club')`.

- [ ] **Step 4: Mover categorías y cocheras a `ClubPage.tsx`**

Mismo procedimiento con los bloques **líneas 555–709** (`{tab === 'categorias' && (`) y **líneas 710–830** (`{tab === 'parking' && (`), más el estado que consumen: `categorias`, `catView`, `catDrawer`, `deleteCatTarget`, `handleDeleteCategoria`, `spots`, `loadSpots`, `newSpotNumber`, `spotError`, `addingSpot`, `assigningSpotId`, `handleAddSpot`, `handleAssign`, `handleUnassign`, `handleDeleteSpot`, `cocherasLibres`.

`ClubPage` maneja su propia sub-navegación con `useState<'categorias' | 'cocheras'>('categorias')`. La sub-vista de horarios se agrega en el plan de la pieza 3.

**Nota:** `ClubPage` también necesita la lista de jugadores para el selector de asignación de cochera (`members.filter(...)` en la línea 800). Carga su propia copia con `api.getMembers()` en lugar de recibirla por props: son dos secciones independientes y compartir estado entre ellas reintroduciría el acoplamiento que estamos deshaciendo.

- [ ] **Step 5: Dejar `Admin.tsx` como cáscara**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import AdminLayout, { type AdminSection } from './admin/AdminLayout';
import InicioPage from './admin/InicioPage';
import JugadoresPage from './admin/JugadoresPage';
import ClubPage from './admin/ClubPage';
import Analytics from './Analytics';

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>('inicio');

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <AdminLayout section={section} onSection={setSection} onLogout={handleLogout}>
      {section === 'inicio' && <InicioPage onSection={setSection} />}
      {section === 'jugadores' && <JugadoresPage onIrACocheras={() => setSection('club')} />}
      {section === 'club' && <ClubPage />}
      {section === 'analitica' && <Analytics />}
      {section === 'config' && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
          Configuración — próximamente.
        </p>
      )}
    </AdminLayout>
  );
}
```

`InicioPage` todavía no existe: crear un archivo mínimo para que compile, que se completa en el Task 6.

```tsx
// frontend/src/pages/admin/InicioPage.tsx
import type { AdminSection } from './AdminLayout';

export default function InicioPage({ onSection }: { onSection: (s: AdminSection) => void }) {
  void onSection;
  return null;
}
```

- [ ] **Step 6: Verificar compilación y comportamiento**

```bash
cd frontend && npx tsc --noEmit && npm run dev
```
Comparar contra lo anotado en el Step 1: misma cantidad de jugadores, categorías y cocheras; el menú `⋮` abre con las mismas opciones; suspender, dar de baja y reactivar siguen funcionando. **Si algo difiere, es un error de movimiento: corregirlo antes de commitear.**

- [ ] **Step 7: Verificar que `Admin.tsx` se achicó**

```bash
cd frontend && wc -l src/pages/Admin.tsx src/pages/admin/*.tsx
```
Esperado: `Admin.tsx` por debajo de 50 líneas; ninguna de las páginas nuevas por encima de ~450.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Admin.tsx frontend/src/pages/admin/
git commit -m "refactor: partir Admin.tsx en una página por sección

846 líneas con jugadores, categorías y parking inline. Se mueve sin
reescribir: los cambios de diseño van aparte. Navegación de cinco destinos
en AdminLayout, con barra inferior en mobile."
```

---

## Task 5: Componente `PendingCard`

**Files:**
- Create: `frontend/src/components/admin/PendingCard.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
interface Props {
  /** Cantidad a destacar. Si es 0, el llamador no debería renderizar la tarjeta. */
  value: number;
  title: string;
  detail: string;
  /** 'alert' pinta en rojo (algo está mal); 'warn' en dorado (requiere atención). */
  tone?: 'warn' | 'alert';
  onClick: () => void;
}

export default function PendingCard({ value, title, detail, tone = 'warn', onClick }: Props) {
  const color = tone === 'alert' ? 'var(--brand-danger)' : 'var(--brand-gold)';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 flex gap-3 items-start transition-all active:scale-[0.98]"
      style={{
        backgroundColor: 'var(--brand-surface)',
        border: '1px solid rgb(var(--brand-border-rgb) / 0.9)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span className="font-display text-2xl leading-none min-w-[34px]" style={{ color }}>
        {value}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-white">{title}</span>
        <span className="block text-[11px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>
          {detail}
        </span>
      </span>
      <span style={{ color: 'var(--brand-muted)' }}>›</span>
    </button>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sin salida.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/PendingCard.tsx
git commit -m "feat: tarjeta accionable para los pendientes del Inicio"
```

---

## Task 6: Pantalla de Inicio

**Files:**
- Modify: `frontend/src/pages/admin/InicioPage.tsx`

- [ ] **Step 1: Implementar la pantalla completa**

Reemplazar el contenido de `frontend/src/pages/admin/InicioPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api, type DashboardData } from '../../lib/api.ts';
import PendingCard from '../../components/admin/PendingCard';
import type { AdminSection } from './AdminLayout';

const TONE_COLOR: Record<'ok' | 'warn' | 'alert', string> = {
  ok: 'var(--brand-ok)',
  warn: 'var(--brand-gold)',
  alert: 'var(--brand-danger)',
};

function dmy(iso: string | null): string {
  if (!iso) return 'nunca';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function InicioPage({ onSection }: { onSection: (s: AdminSection) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getDashboard()
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error'); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="text-sm" style={{ color: 'var(--brand-danger)' }}>{error}</p>;
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--brand-surface)' }} />
        ))}
      </div>
    );
  }

  const { pendientes, club, categorias } = data;
  const hayPendientes =
    pendientes.descolgados > 0 || pendientes.a_revisar > 0 ||
    pendientes.sin_foto > 0 || pendientes.horarios === 0;

  const visibles = verTodas ? categorias : categorias.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Para resolver — si no hay nada, la sección entera no se renderiza */}
      {hayPendientes && (
        <section>
          <p className="text-[10px] uppercase tracking-[0.17em] mb-2" style={{ color: 'var(--brand-muted)' }}>
            Para resolver
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {pendientes.descolgados > 0 && (
              <PendingCard
                value={pendientes.descolgados}
                title="Se descolgaron"
                detail={`activos sin venir hace +21 días · ${Math.round((pendientes.descolgados / Math.max(club.activos, 1)) * 100)}% del plantel`}
                tone="alert"
                onClick={() => onSection('jugadores')}
              />
            )}
            {pendientes.a_revisar > 0 && (
              <PendingCard
                value={pendientes.a_revisar}
                title="Membresías a revisar"
                detail="migradas sin motivo registrado"
                onClick={() => onSection('jugadores')}
              />
            )}
            {pendientes.sin_foto > 0 && (
              <PendingCard
                value={pendientes.sin_foto}
                title="Sin foto de carnet"
                detail="el portero no puede validarlos visualmente"
                onClick={() => onSection('jugadores')}
              />
            )}
            {pendientes.horarios === 0 && (
              <PendingCard
                value={0}
                title="Horarios cargados"
                detail="sin esto no hay control de asistencia"
                onClick={() => onSection('club')}
              />
            )}
          </div>
        </section>
      )}

      {!hayPendientes && (
        <p className="text-sm" style={{ color: 'var(--brand-ok)' }}>Todo al día.</p>
      )}

      {/* El club */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.17em] mb-2" style={{ color: 'var(--brand-muted)' }}>
          El club
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Activos', value: club.activos, color: '#F5F5F0' },
            { label: 'Suspendidos', value: club.suspendidos, color: 'var(--brand-gold)' },
            { label: 'Ingresos 7d', value: club.ingresos_7d, color: '#F5F5F0' },
            { label: 'Jugadores 7d', value: club.jugadores_7d, color: '#F5F5F0' },
          ].map(m => (
            <div
              key={m.label}
              className="rounded-xl p-3"
              style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-border-rgb) / 0.9)' }}
            >
              <p className="font-display text-2xl leading-none" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--brand-muted)' }}>
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Categorías */}
      {categorias.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-[0.17em] mb-2" style={{ color: 'var(--brand-muted)' }}>
            Categorías · lo que necesita atención primero
          </p>
          <div className="space-y-1.5">
            {visibles.map(c => (
              <button
                key={c.id}
                onClick={() => onSection('club')}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left"
                style={{
                  backgroundColor: 'var(--brand-surface)',
                  border: `1px solid ${c.estado === 'ok'
                    ? 'rgb(var(--brand-border-rgb) / 0.9)'
                    : `color-mix(in srgb, ${TONE_COLOR[c.estado]} 30%, transparent)`}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE_COLOR[c.estado] }} />
                <span className="text-[13px] font-semibold text-white flex-1 truncate">{c.nombre}</span>
                <span className="text-[11px] text-right shrink-0" style={{ color: 'var(--brand-muted)' }}>
                  {c.activos} activos · {dmy(c.ultimo_ingreso)}
                </span>
              </button>
            ))}
          </div>
          {categorias.length > 6 && (
            <button
              onClick={() => setVerTodas(v => !v)}
              className="w-full text-center text-[11px] pt-2"
              style={{ color: 'var(--brand-muted)' }}
            >
              {verTodas ? 'ver menos' : `ver las ${categorias.length} ›`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sin salida.

- [ ] **Step 3: Verificar en el navegador contra datos reales**

```bash
cd frontend && npm run dev
```
Entrar al panel. Con la base de producción debería verse: 4 tarjetas de pendientes, el pulso del club, y las categorías con C13 en rojo primero. Verificar en 375px de ancho que las tarjetas apilan y la barra inferior no tapa contenido.

- [ ] **Step 4: Verificar el estado sin pendientes**

«Para resolver» desaparece sólo cuando los cuatro contadores están resueltos, **incluido que haya al menos un horario cargado**. Para probarlo contra la base de test:

```bash
docker exec -i estelares-test-pg psql -U estelares -d estelares_test -c \
  "INSERT INTO training_schedules (categoria_id, day_of_week, start_time)
   SELECT id, 2, '19:00' FROM categorias LIMIT 1"
```

Con eso y sin jugadores descolgados, sin revisiones pendientes y sin activos sin foto, el bloque no debe renderizarse y debe aparecer «Todo al día».

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/InicioPage.tsx
git commit -m "feat: pantalla de Inicio con pendientes accionables

Abrir el panel ya no cae en una tabla de 108 filas. Cada tarjeta navega a la
vista correspondiente, y sin pendientes la sección entera no se renderiza en
lugar de mostrar ceros."
```

---

## Task 7: Punto de novedades en la navegación

**Files:**
- Modify: `frontend/src/pages/Admin.tsx`

- [ ] **Step 1: Cablear el flag desde el dashboard**

Reemplazar el cuerpo de `Admin.tsx` para consultar el dashboard y marcar las secciones con novedades:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api.ts';
import AdminLayout, { type AdminSection } from './admin/AdminLayout';
import InicioPage from './admin/InicioPage';
import JugadoresPage from './admin/JugadoresPage';
import ClubPage from './admin/ClubPage';
import Analytics from './Analytics';

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>('inicio');
  const [flagged, setFlagged] = useState<AdminSection[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.getDashboard()
      .then(d => {
        if (cancelled) return;
        const f: AdminSection[] = [];
        if (d.pendientes.descolgados || d.pendientes.a_revisar || d.pendientes.sin_foto) f.push('jugadores');
        if (d.pendientes.horarios === 0) f.push('club');
        setFlagged(f);
      })
      .catch(() => { /* el punto es informativo: su ausencia no rompe nada */ });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <AdminLayout section={section} onSection={setSection} flagged={flagged} onLogout={handleLogout}>
      {section === 'inicio' && <InicioPage onSection={setSection} />}
      {section === 'jugadores' && <JugadoresPage onIrACocheras={() => setSection('club')} />}
      {section === 'club' && <ClubPage />}
      {section === 'analitica' && <Analytics />}
      {section === 'config' && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
          Configuración — próximamente.
        </p>
      )}
    </AdminLayout>
  );
}
```

- [ ] **Step 2: Verificación final completa**

```bash
cd frontend && npx tsc --noEmit && cd .. && npx tsc --noEmit && npm run test:int && npm run build
```
Esperado: `tsc` sin salida en ambos, `Tests 81 passed (81)`, build OK.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Admin.tsx
git commit -m "feat: punto dorado en las secciones con novedades"
```

---

## Task 8: Avatares sobrios (spec D5)

La foto del jugador ya tiene prioridad en el código actual (`m.foto_url ? <img> : initials`) y eso **no cambia**. Lo único que cambia es el fallback cuando no hay foto: iniciales sobre gris, en lugar de siete colores por hash del nombre. `avatarColor()` está **duplicada** en dos archivos y desaparece de ambos.

**Files:**
- Create: `frontend/src/components/admin/PlayerAvatar.tsx`
- Modify: `frontend/src/pages/admin/JugadoresPage.tsx`
- Modify: `frontend/src/components/admin/CategoryDetailView.tsx:22` (borrar `avatarColor`) y sus dos usos

- [ ] **Step 1: Crear el componente único**

```tsx
import { getInitials } from '../../utils/format';

interface Props {
  nombre: string;
  apellido: string;
  fotoUrl?: string | null;
  size?: number;
  /** Bordes redondeados en vez de círculo, para las tarjetas de mobile. */
  square?: boolean;
}

/**
 * La foto del jugador manda siempre. Las iniciales sobre gris son el fallback:
 * antes se pintaban con uno de siete colores por hash del nombre, lo que sobre
 * negro puro rompía la sobriedad del tema. Es también el motivo por el que
 * "sin foto de carnet" merece estar en los pendientes del Inicio.
 */
export default function PlayerAvatar({ nombre, apellido, fotoUrl, size = 36, square = false }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 ${square ? 'rounded-xl' : 'rounded-full'}`}
      style={{
        width: size,
        height: size,
        backgroundColor: fotoUrl ? 'var(--brand-bg)' : 'var(--brand-surface-2)',
        border: '1px solid rgb(var(--brand-border-rgb) / 0.9)',
        color: '#C8C8C8',
        fontSize: Math.round(size * 0.32),
        fontWeight: 700,
      }}
    >
      {fotoUrl
        ? <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
        : getInitials(apellido, nombre)}
    </span>
  );
}
```

- [ ] **Step 2: Reemplazar los cuatro usos**

En `JugadoresPage.tsx` (tabla de escritorio y tarjetas de mobile) y en `CategoryDetailView.tsx` (tabla y tarjetas), sustituir cada bloque de avatar por:

```tsx
<PlayerAvatar nombre={m.nombre} apellido={m.apellido} fotoUrl={m.foto_url} size={36} />
```

Usar `square` en las tarjetas de mobile, que hoy usan `rounded-xl`.

- [ ] **Step 3: Borrar la función duplicada**

```bash
cd frontend && grep -rn "avatarColor" src/
```
Esperado: sin resultados. Si queda alguno, borrarlo: la función estaba definida dos veces, en `pages/Admin.tsx` (ahora `JugadoresPage.tsx`) y en `components/admin/CategoryDetailView.tsx`.

- [ ] **Step 4: Verificar**

```bash
cd frontend && npx tsc --noEmit && npm run dev
```
Verificar que los jugadores con foto la siguen mostrando y los 25 sin foto muestran iniciales grises.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/PlayerAvatar.tsx frontend/src/pages/admin/JugadoresPage.tsx frontend/src/components/admin/CategoryDetailView.tsx
git commit -m "refactor: avatar único, foto primero e iniciales sobre gris

avatarColor() estaba duplicada en dos archivos y pintaba con siete colores
por hash del nombre, que sobre negro puro rompen la sobriedad del tema. La
foto sigue teniendo prioridad: sólo cambia el fallback."
```

---

## Criterios de aceptación de este plan

- [ ] No queda ninguna regla `[data-theme]` en `index.css` (`grep -c` devuelve 0)
- [ ] `useTheme.ts` y `ThemeToggle.tsx` no existen
- [ ] Ningún botón queda con texto blanco sobre fondo blanco
- [ ] `Admin.tsx` tiene menos de 50 líneas
- [ ] Al abrir el panel se ve el Inicio, no la tabla de jugadores
- [ ] Cada tarjeta de pendiente navega a su sección
- [ ] Sin pendientes, el bloque «Para resolver» no se renderiza
- [ ] Las cinco secciones son alcanzables en mobile sin submenús
- [ ] `npm run test:int` → 81 tests verdes
- [ ] Suspender, dar de baja y reactivar siguen funcionando igual que antes del refactor
- [ ] `grep -rn "avatarColor" frontend/src/` no devuelve nada
- [ ] Los jugadores con foto la siguen mostrando; el fallback es gris

## Fuera de alcance

Horarios de entrenamiento, filtros combinables, acciones masivas y Config real. Tienen su propio plan. En esta tanda, `Config` muestra «próximamente» y `ClubPage` expone sólo categorías y cocheras.
