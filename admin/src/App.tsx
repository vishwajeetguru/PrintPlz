import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './lib/auth';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Maintenance } from './pages/Maintenance';
import { Notices } from './pages/Notices';
import { Requests } from './pages/Requests';
import { ShopDetail } from './pages/ShopDetail';
import { Shops } from './pages/Shops';

function Guard({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!me) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Dashboard /></Guard>} />
          <Route path="/shops" element={<Guard><Shops /></Guard>} />
          <Route path="/shops/:id" element={<Guard><ShopDetail /></Guard>} />
          <Route path="/requests" element={<Guard><Requests /></Guard>} />
          <Route path="/notices" element={<Guard><Notices /></Guard>} />
          <Route path="/maintenance" element={<Guard><Maintenance /></Guard>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
