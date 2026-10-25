import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api';
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
  // "Asignar cochera" venía de una pestaña propia: tiene que aterrizar en
  // cocheras, no en la vista por defecto de Club.
  const [clubView, setClubView] = useState<'categorias' | 'cocheras'>('categorias');

  const irA = (s: AdminSection) => {
    if (s !== 'club') setClubView('categorias');
    setSection(s);
  };

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

  return (
    <AdminLayout
      section={section}
      onSection={irA}
      onPortero={() => navigate('/portero')}
      onLogout={logout}
      flagged={flagged}
    >
      {section === 'inicio' && <InicioPage onSection={irA} />}
      {section === 'jugadores' && (
        <JugadoresPage onIrACocheras={() => { setClubView('cocheras'); setSection('club'); }} />
      )}
      {section === 'club' && <ClubPage initialView={clubView} />}
      {section === 'analitica' && <Analytics />}
      {section === 'config' && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
          Configuración — próximamente.
        </p>
      )}
    </AdminLayout>
  );
}
