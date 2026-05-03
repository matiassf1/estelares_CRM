import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { useTheme } from './hooks/useTheme.ts';
import Login from './pages/Login.tsx';
import CheckIn from './pages/CheckIn.tsx';
import Carnet from './pages/Carnet.tsx';
import Portero from './pages/Portero.tsx';
import Admin from './pages/Admin.tsx';
import Preview from './pages/Preview.tsx';

// Preserves ?t=<token> through the login redirect so a QR scan
// that lands on /check-in?t=xxx still works even if not yet logged in.
function CheckInGuard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  if (!user || user.type !== 'member') {
    const t = searchParams.get('t');
    const redirect = t ? `/check-in?t=${t}` : '/check-in';
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return <CheckIn />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4">
        <img src="/shield.png" alt="Estelares" width={56} style={{ filter: 'invert(1)', opacity: 0.5 }} />
        <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isMember = user?.type === 'member';
  const isStaff  = user?.type === 'portero' || user?.type === 'admin';
  const isAdmin  = user?.type === 'admin';

  return (
    <Routes>
      <Route path="/login"    element={!user ? <Login />   : <Navigate to="/" replace />} />
      <Route path="/check-in" element={<CheckInGuard />} />
      <Route path="/carnet"   element={isMember ? <Carnet />  : <Navigate to="/login" replace />} />
      <Route path="/portero"  element={isStaff  ? <Portero /> : <Navigate to="/login" replace />} />
      <Route path="/admin"    element={isAdmin  ? <Admin />   : <Navigate to="/login" replace />} />
      <Route
        path="/"
        element={
          !user     ? <Navigate to="/login"    replace /> :
          isMember  ? <Navigate to="/carnet"   replace /> :
          isAdmin   ? <Navigate to="/admin"    replace /> :
                      <Navigate to="/portero"  replace />
        }
      />
      <Route path="/preview" element={<Preview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useTheme(); // initializes theme from localStorage on mount
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
