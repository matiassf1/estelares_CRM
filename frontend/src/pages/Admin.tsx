import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api';
import AdminLayout, { type AdminSection } from './admin/AdminLayout';
import InicioPage from './admin/InicioPage';
import JugadoresPage, { type MemberFilter } from './admin/JugadoresPage';
import ClubPage from './admin/ClubPage';
import ConfigPage from './admin/ConfigPage';
import Analytics from './Analytics';

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>('inicio');
  const [flagged, setFlagged] = useState<AdminSection[]>([]);
  // "Asignar cochera" venía de una pestaña propia: tiene que aterrizar en
  // cocheras, no en la vista por defecto de Club.
  const [clubView, setClubView] = useState<'categorias' | 'horarios' | 'cocheras'>('categorias');
  const [jugadoresFilter, setJugadoresFilter] = useState<MemberFilter>('todos');
  const [clubCategoriaId, setClubCategoriaId] = useState<number | null>(null);

  const irA = (s: AdminSection) => {
    if (s !== 'club') { setClubView('categorias'); setClubCategoriaId(null); }
    if (s !== 'jugadores') setJugadoresFilter('todos');
    setSection(s);
  };

  const verJugadores = (filtro?: MemberFilter) => {
    setJugadoresFilter(filtro ?? 'todos');
    setSection('jugadores');
  };

  const verCategoria = (id: number) => {
    setClubView('categorias');
    setClubCategoriaId(id);
    setSection('club');
  };

  const verHorarios = () => {
    setClubView('horarios');
    setClubCategoriaId(null);
    setSection('club');
  };

  useEffect(() => {
    let cancelled = false;
    api.getDashboard()
      .then(d => {
        if (cancelled) return;
        const f: AdminSection[] = [];
        if (d.pendientes.solicitudes || d.pendientes.descolgados || d.pendientes.a_revisar || d.pendientes.sin_foto) f.push('jugadores');
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
      {section === 'inicio' && (
        <InicioPage onVerJugadores={verJugadores} onVerCategoria={verCategoria} onVerHorarios={verHorarios} />
      )}
      {section === 'jugadores' && (
        <JugadoresPage
          onIrACocheras={() => { setClubView('cocheras'); setClubCategoriaId(null); setSection('club'); }}
          initialFilter={jugadoresFilter}
        />
      )}
      {section === 'club' && <ClubPage initialView={clubView} initialCategoriaId={clubCategoriaId} />}
      {section === 'analitica' && <Analytics />}
      {section === 'config' && <ConfigPage />}
    </AdminLayout>
  );
}
