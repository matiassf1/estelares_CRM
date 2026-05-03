import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import Login from './pages/Login.tsx';
import CheckIn from './pages/CheckIn.tsx';
import Carnet from './pages/Carnet.tsx';
import Portero from './pages/Portero.tsx';
import Admin from './pages/Admin.tsx';
import Preview from './pages/Preview.tsx';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4">
        <img src="/shield.jpg" alt="Estelares" width={56} style={{ filter: 'invert(1)', opacity: 0.5 }} />
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
      <Route path="/check-in" element={isMember ? <CheckIn /> : <Navigate to="/login" replace />} />
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
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
