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

  return (
    <AdminLayout
      section={section}
      onSection={setSection}
      onPortero={() => navigate('/portero')}
      onLogout={logout}
    >
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
