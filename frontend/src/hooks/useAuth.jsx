import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { hasSupabaseConfig, supabase } from '../lib/supabase';

const AuthContext = createContext(null);

function toProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.fullName ?? profile.name ?? profile.email,
    role: profile.role ?? 'student',
    active: profile.active !== false
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (accessToken) => {
    if (!accessToken) {
      setUser(null);
      return null;
    }
    try {
      const data = await apiRequest('/api/me', { token: accessToken });
      const profile = toProfile(data.user ?? data.profile ?? data);
      setUser(profile);
      setError(null);
      return profile;
    } catch (err) {
      setUser(null);
      if (err.code === 'ACCOUNT_INACTIVE') setError('This account has been deactivated.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        await loadProfile(data.session?.access_token);
      })
      .finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await loadProfile(session?.access_token);
    });

    const onUnauthorized = () => {
      supabase.auth.signOut().finally(() => setUser(null));
    };
    window.addEventListener('unauthorized', onUnauthorized);

    return () => {
      subscription.subscription.unsubscribe();
      window.removeEventListener('unauthorized', onUnauthorized);
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    if (!hasSupabaseConfig) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
      const { data } = await supabase.auth.getSession();
      await loadProfile(data.session?.access_token);
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role || 'visitor',
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      isStudent: user?.role === 'student',
      login,
      logout,
      loading,
      error
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
