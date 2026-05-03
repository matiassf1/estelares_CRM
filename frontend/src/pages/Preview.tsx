import { useNavigate } from 'react-router-dom';
import Carnet from './Carnet.tsx';
import ClubShield from '../components/ClubShield.tsx';

const MOCK_MEMBER = {
  nombre: 'Lucas',
  apellido: 'Fernández',
  dni: '28.451.230',
  patente: 'AB 123 CD',
  foto_url: null as string | null,
};

const MOCK_ENTRIES = [
  { nombre: 'Lucas',     apellido: 'Fernández', patente: 'AB 123 CD', checked_in_at: new Date(Date.now() - 2 * 60000).toISOString() },
  { nombre: 'Matías',    apellido: 'González',  patente: 'GH 456 IJ', checked_in_at: new Date(Date.now() - 8 * 60000).toISOString() },
  { nombre: 'Sebastián', apellido: 'Romero',    patente: undefined,   checked_in_at: new Date(Date.now() - 15 * 60000).toISOString() },
  { nombre: 'Diego',     apellido: 'Torres',    patente: undefined,   checked_in_at: new Date(Date.now() - 23 * 60000).toISOString() },
];

export default function Preview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pattern-lines" style={{ backgroundColor: '#0D0D0D' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 px-5 py-3 flex justify-between items-center"
        style={{ backgroundColor: '#0D0D0D', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
        <div className="flex items-center gap-3">
          <ClubShield size={28} className="opacity-80" />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Design Preview</p>
            <p className="text-xs leading-tight" style={{ color: '#C9A84C' }}>Estelares Futsal</p>
          </div>
        </div>
        <button onClick={() => navigate('/login')}
          className="text-xs uppercase tracking-wider active:text-white"
          style={{ color: '#7A7A7A' }}>
          ← Login
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-12">

        {/* ── SECTION: Carnet ── */}
        <Section title="Carnet Digital" subtitle="Vista del jugador al abrir la app">
          <Carnet mock={{ ...MOCK_MEMBER, status: { ingresado: false } }} />
        </Section>

        <Section title="Carnet — Ya ingresó" subtitle="Estado post check-in exitoso">
          <Carnet mock={{
            ...MOCK_MEMBER,
            status: { ingresado: true, hora: new Date(Date.now() - 12 * 60000).toISOString() }
          }} />
        </Section>

        {/* ── SECTION: Check-in success ── */}
        <Section title="Check-in: Ingreso autorizado" subtitle="Pantalla al escanear el QR del portero">
          <MockSuccess name="Lucas Fernández" />
        </Section>

        {/* ── SECTION: Check-in ya ingresó ── */}
        <Section title="Check-in: Ya ingresó" subtitle="Si el jugador intenta entrar dos veces">
          <MockAlready />
        </Section>

        {/* ── SECTION: Check-in no autorizado ── */}
        <Section title="Check-in: No autorizado" subtitle="QR expirado o inválido">
          <MockError />
        </Section>

        {/* ── SECTION: Portero panel ── */}
        <Section title="Portal Portero" subtitle="Panel que ve el portero en su dispositivo">
          <MockPortero entries={MOCK_ENTRIES} />
        </Section>

      </div>
    </div>
  );
}

/* ── Helper components ── */

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#CC2222' }} />
          <h2 className="font-display text-white tracking-widest text-xl">{title.toUpperCase()}</h2>
        </div>
        <p className="text-xs ml-3" style={{ color: '#C9A84C' }}>{subtitle}</p>
      </div>
      <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
        {children}
      </div>
    </div>
  );
}

function MockSuccess({ name }: { name: string }) {
  const [last] = name.split(' ').slice(-1);
  return (
    <div className="flex flex-col pattern-lines" style={{ backgroundColor: '#0D0D0D', minHeight: 420 }}>
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #16a34a, #15803d)' }} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-scale-in"
          style={{ backgroundColor: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
          <svg className="w-11 h-11 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path className="draw-path" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-1 animate-fade-in"
          style={{ color: 'rgba(74,222,128,0.7)' }}>Acceso autorizado</p>
        <h2 className="font-display text-white text-5xl tracking-wider mb-2 animate-slide-up">{last.toUpperCase()}</h2>
        <p className="text-lg mb-8 animate-slide-up" style={{ color: 'rgba(255,255,255,0.5)' }}>{name}</p>
        <div className="rounded-2xl px-8 py-4 animate-slide-up"
          style={{ border: '1px solid rgba(22,163,74,0.4)', backgroundColor: 'rgba(22,163,74,0.05)' }}>
          <p className="text-[10px] tracking-[0.4em] uppercase mb-0.5" style={{ color: 'rgba(74,222,128,0.5)' }}>Dirigir a</p>
          <p className="font-display text-2xl tracking-[0.2em]" style={{ color: '#4ade80' }}>ZONA JUGADORES</p>
        </div>
      </div>
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #16a34a, #15803d)' }} />
    </div>
  );
}

function MockAlready() {
  return (
    <div className="flex flex-col" style={{ backgroundColor: '#0D0D0D', minHeight: 380 }}>
      <div className="h-1.5 w-full" style={{ backgroundColor: '#C9A84C' }} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-scale-in"
          style={{ backgroundColor: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <svg className="w-10 h-10" style={{ color: '#C9A84C' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(201,168,76,0.7)' }}>Atención</p>
        <h2 className="font-display text-white text-4xl tracking-wider mb-3">YA INGRESASTE</h2>
        <p style={{ color: '#7A7A7A' }}>Tu ingreso ya fue registrado hoy.</p>
      </div>
      <div className="h-1.5 w-full" style={{ backgroundColor: '#C9A84C' }} />
    </div>
  );
}

function MockError() {
  return (
    <div className="flex flex-col" style={{ backgroundColor: '#0D0D0D', minHeight: 380 }}>
      <div className="h-1.5 w-full" style={{ backgroundColor: '#CC2222' }} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-scale-in"
          style={{ backgroundColor: 'rgba(204,34,34,0.1)', border: '1px solid rgba(204,34,34,0.3)' }}>
          <svg className="w-10 h-10" style={{ color: '#CC2222' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" className="draw-path" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(204,34,34,0.7)' }}>Denegado</p>
        <h2 className="font-display text-white text-4xl tracking-wider mb-3">NO AUTORIZADO</h2>
        <p style={{ color: '#7A7A7A' }}>QR inválido o expirado</p>
      </div>
      <div className="h-1.5 w-full" style={{ backgroundColor: '#CC2222' }} />
    </div>
  );
}

function MockPortero({ entries }: { entries: typeof MOCK_ENTRIES }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ backgroundColor: '#0D0D0D', minHeight: 480 }}>
      <div className="px-5 py-4 flex justify-between items-center"
        style={{ borderBottom: '1px solid rgba(201,168,76,0.2)', backgroundColor: '#141414' }}>
        <div className="flex items-center gap-3">
          <ClubShield size={28} className="opacity-80" />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Estelares Futsal</p>
            <p className="text-xs leading-tight" style={{ color: '#7A7A7A' }}>Portal Portero</p>
          </div>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C9A84C' }}>Admin</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Mock QR */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-center mb-3" style={{ color: '#7A7A7A' }}>
            Jugadores escanean este QR
          </p>
          <div className="rounded-2xl p-4 shadow-2xl" style={{ backgroundColor: '#fff' }}>
            <div className="aspect-square rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#F3F4F6' }}>
              <div className="text-center">
                <div className="font-display text-gray-400 text-4xl tracking-widest">QR</div>
                <p className="text-gray-400 text-xs mt-1">rotativo cada 30s</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
                <div className="h-full rounded-full" style={{ width: '60%', backgroundColor: '#22c55e' }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-medium" style={{ color: '#6B7280' }}>QR activo</span>
                <span className="text-[10px] font-mono font-bold" style={{ color: '#6B7280' }}>18s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-xl px-5 py-3 flex items-center justify-between"
          style={{ backgroundColor: '#141414', border: '1px solid rgba(201,168,76,0.2)' }}>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#C9A84C' }}>Ingresos hoy</p>
            <p className="font-display text-white leading-none mt-0.5" style={{ fontSize: '2.6rem' }}>
              {entries.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(204,34,34,0.1)', border: '1px solid rgba(204,34,34,0.2)' }}>
            <svg className="w-5 h-5" style={{ color: '#CC2222' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {/* Entries */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-3" style={{ color: '#C9A84C' }}>
            Últimos ingresos
          </p>
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="rounded-xl px-4 py-3 flex justify-between items-center"
                style={{
                  backgroundColor: '#141414',
                  border: i === 0 ? '1px solid rgba(204,34,34,0.3)' : '1px solid rgba(201,168,76,0.2)',
                }}>
                <div className="flex items-center gap-3">
                  {i === 0 && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#CC2222' }} />}
                  <div>
                    <p className="text-white text-sm font-semibold">{e.nombre} {e.apellido}</p>
                    {e.patente && <p className="text-xs" style={{ color: '#7A7A7A' }}>{e.patente}</p>}
                  </div>
                </div>
                <span className="text-xs font-mono" style={{ color: '#7A7A7A' }}>{fmt(e.checked_in_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
