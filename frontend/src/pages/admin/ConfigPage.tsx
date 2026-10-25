import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, type AdminUser, type AdminUserRole } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { lockBodyScroll } from '../../utils/scrollLock';
import ActionMenu from '../../components/admin/ActionMenu';
import ConfirmModal from '../../components/admin/ConfirmModal';
import ClubShield from '../../components/ClubShield';
import Toast from '../../components/admin/Toast';

const MIN_PASSWORD_LENGTH = 8;

function Kicker({ children }: { children: string }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.17em] mb-2" style={{ color: 'var(--brand-muted)' }}>
      {children}
    </p>
  );
}

const CARD_STYLE = {
  backgroundColor: 'var(--brand-surface)',
  border: '1px solid rgb(var(--brand-border-rgb) / 0.9)',
};

const FIELD_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
};

function RoleBadge({ role }: { role: AdminUserRole }) {
  const gold = role === 'admin';
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
      style={gold
        ? { backgroundColor: 'rgba(201,168,76,0.14)', color: 'var(--brand-gold)' }
        : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--brand-muted)' }}
    >
      {role}
    </span>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Formulario de usuario ─────────────────────────────────────────────────────
// Mismo lenguaje que MembershipSheet: hoja inferior en mobile, tarjeta centrada
// en escritorio. Sirve para el alta y para el cambio de contraseña; cambian los
// campos visibles, no la estructura.

type UserFormMode = { kind: 'create' } | { kind: 'password'; user: AdminUser };

function UserSheet({
  mode,
  onClose,
  onDone,
}: {
  mode: UserFormMode;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminUserRole>('portero');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const creating = mode.kind === 'create';

  useEffect(() => {
    const unlock = lockBodyScroll();
    const t = requestAnimationFrame(() => setVisible(true));
    return () => { unlock(); cancelAnimationFrame(t); };
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  const submit = async () => {
    setError('');
    if (creating && !username.trim()) {
      setError('Indicá un nombre de usuario');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    setLoading(true);
    try {
      if (creating) {
        const u = await api.createAdminUser({ username: username.trim(), password, role });
        onDone(`Usuario ${u.username} creado`);
      } else {
        await api.updateAdminUserPassword(mode.user.id, password);
        onDone(`Contraseña de ${mode.user.username} actualizada`);
      }
      close();
    } catch (err) {
      // El mensaje del backend es el que explica el conflicto real
      // (usuario duplicado, contraseña corta): se muestra tal cual.
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end backdrop-blur-mobile"
      style={{
        backgroundColor: `rgba(0,0,0,${visible ? 0.6 : 0})`,
        transition: 'background-color 0.25s ease',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full rounded-t-2xl md:max-w-md md:mx-auto md:mb-8 md:rounded-2xl"
        style={{
          backgroundColor: '#1a1a1c',
          border: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </div>

        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="font-semibold text-white text-base">
            {creating ? 'Nuevo usuario' : 'Cambiar contraseña'}
          </p>
          {!creating && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
              {mode.user.username}
            </p>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          {creating && (
            <>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  value={username}
                  maxLength={50}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={e => setUsername(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={FIELD_STYLE}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
                  Rol
                </label>
                <div className="flex gap-1.5">
                  {(['portero', 'admin'] as AdminUserRole[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider"
                      style={role === r
                        ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }
                        : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--brand-muted)' }}>
                  {role === 'admin'
                    ? 'Acceso completo al panel: jugadores, membresías y usuarios.'
                    : 'Sólo registra ingresos en la puerta.'}
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={FIELD_STYLE}
            />
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--brand-muted)' }}>
              Mínimo {MIN_PASSWORD_LENGTH} caracteres.
            </p>
          </div>
        </div>

        {error && (
          <p className="px-5 pb-2 text-xs leading-snug" style={{ color: 'var(--brand-danger)' }}>
            {error}
          </p>
        )}

        <div className="px-4 pt-1 flex gap-2">
          <button
            onClick={close}
            className="flex-1 py-3.5 rounded-xl text-sm font-medium active:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold active:opacity-60 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
          >
            {loading ? 'Guardando…' : creating ? 'Crear usuario' : 'Cambiar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadError, setLoadError] = useState('');
  const [sheet, setSheet] = useState<UserFormMode | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    try {
      setUsers(await api.getAdminUsers());
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const adminCount = users.filter(u => u.role === 'admin').length;
  const isMe = (u: AdminUser) => !!user?.username && u.username === user.username;

  /**
   * El backend es la autoridad —rechaza con 409 el autoborrado y el borrado del
   * último admin—, pero ofrecer un botón que siempre va a fallar es mala UX: en
   * esos dos casos la opción directamente no aparece.
   */
  const canDelete = (u: AdminUser) => !isMe(u) && !(u.role === 'admin' && adminCount <= 1);

  const confirmDelete = async () => {
    if (!deleting) return;
    const nombre = deleting.username;
    try {
      await api.deleteAdminUser(deleting.id);
      setToast(`Usuario ${nombre} eliminado`);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No se pudo eliminar el usuario');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      {/* ── Usuarios ── */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <Kicker>Usuarios</Kicker>
          <button
            onClick={() => setSheet({ kind: 'create' })}
            className="font-display tracking-widest text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
          >
            + USUARIO
          </button>
        </div>

        {loadError && (
          <p className="text-xs mb-2" style={{ color: 'var(--brand-danger)' }}>{loadError}</p>
        )}

        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="rounded-xl p-3 flex items-center justify-between gap-3" style={CARD_STYLE}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-sm truncate">{u.username}</p>
                  <RoleBadge role={u.role} />
                  {isMe(u) && (
                    <span className="text-[10px]" style={{ color: 'var(--brand-ok)' }}>vos</span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                  Alta {shortDate(u.created_at)}
                </p>
              </div>
              <ActionMenu
                header={{ title: u.username, subtitle: u.role }}
                items={[
                  { label: 'Cambiar contraseña', onClick: () => setSheet({ kind: 'password', user: u }) },
                  ...(canDelete(u)
                    ? [{ separator: true as const, label: 'Eliminar usuario', color: 'red' as const, onClick: () => setDeleting(u) }]
                    : []),
                ]}
              />
            </div>
          ))}
          {users.length === 0 && !loadError && (
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>Cargando…</p>
          )}
        </div>
      </section>

      {/* ── Datos del club ── */}
      <section className="mb-6">
        <Kicker>Datos del club</Kicker>
        <div className="rounded-xl p-3" style={CARD_STYLE}>
          <div className="flex items-center gap-3">
            <ClubShield size={34} />
            <div>
              <p className="font-display text-white tracking-widest text-base leading-none">ESTELARES</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>
                Club de futsal
              </p>
            </div>
          </div>
          <p className="text-[11px] mt-3 leading-snug" style={{ color: 'var(--brand-muted)' }}>
            El nombre y el escudo se configuran en el código del panel. Para cambiarlos hace falta
            una nueva versión: todavía no hay una pantalla que los edite.
          </p>
        </div>
      </section>

      {/* ── Reglas de membresía ── */}
      <section className="mb-4">
        <Kicker>Reglas de membresía</Kicker>
        <div className="rounded-xl p-3" style={CARD_STYLE}>
          <ul className="text-xs space-y-1.5" style={{ color: 'var(--brand-muted)' }}>
            <li>· Retroactividad máxima de una fecha efectiva: 60 días.</li>
            <li>· La baja libera la cochera asignada.</li>
            <li>· Un jugador suspendido no puede ingresar al club.</li>
          </ul>
          <p className="text-[11px] mt-3 leading-snug" style={{ color: 'var(--brand-muted)' }}>
            Son fijas: se vuelven editables cuando exista un segundo club con reglas propias.
          </p>
        </div>
      </section>

      {sheet && (
        <UserSheet
          mode={sheet}
          onClose={() => setSheet(null)}
          onDone={message => { setToast(message); load(); }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Eliminar usuario"
          body={
            <>
              <p>
                Se eliminará el usuario <strong style={{ color: 'white' }}>{deleting.username}</strong> ({deleting.role}).
              </p>
              <p className="mt-2">
                No podrá volver a entrar al panel. Los registros que haya hecho se conservan.
              </p>
            </>
          }
          confirmLabel="Eliminar"
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </>
  );
}
