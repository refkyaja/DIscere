import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { apiRequest } from './api';
import { resetSocket } from './socket';

export interface User {
  id: string;
  nama: string;
  email: string;
  role: 'guru' | 'admin' | string;
  sekolah: string | null;
  status: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  daftar: (data: { nama: string; email: string; kataSandi: string; sekolah?: string }) => Promise<User>;
  masuk: (data: { email: string; kataSandi: string }) => Promise<User>;
  keluar: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: User }>('/auth/saya');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const daftar = async (data: { nama: string; email: string; kataSandi: string; sekolah?: string }) => {
    const res = await apiRequest<{ user: User }>('/auth/daftar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    resetSocket();
    setUser(res.user);
    return res.user;
  };

  const masuk = async (data: { email: string; kataSandi: string }) => {
    const res = await apiRequest<{ user: User }>('/auth/masuk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    resetSocket();
    setUser(res.user);
    return res.user;
  };

  const keluar = async () => {
    try {
      await apiRequest('/auth/keluar', { method: 'POST' });
    } finally {
      resetSocket();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, daftar, masuk, keluar, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
}

export function RequireRole({ allowedRole }: { allowedRole: 'guru' | 'admin' }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D7262E]" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-500">Memeriksa sesi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/masuk" state={{ from: location }} replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/guru'} replace />;
  }

  return <Outlet />;
}

