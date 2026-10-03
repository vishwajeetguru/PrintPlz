import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens } from './api';

interface Me {
  user: { id: string; phone: string; name: string | null; role: string };
  maintenanceMode: boolean;
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ me: null, loading: true, refresh: async () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await api<Me>('/api/auth/me');
      if (data.user.role !== 'SUPER_ADMIN') {
        clearTokens();
        setMe(null);
      } else {
        setMe(data);
      }
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('pf.accessToken')) void refresh();
    else setLoading(false);
  }, []);

  const logout = () => {
    clearTokens();
    setMe(null);
  };

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
