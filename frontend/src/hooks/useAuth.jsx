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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/** Turns a network/CORS failure into something a human can act on. */
function explainAuthError(err) {
  if (err instanceof TypeError) {
    return `Could not reach the API at ${API_URL}. Is the backend running?`;
  }
  return err.message || 'Sign in failed';
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
    const data = await apiRequest('/api/me', { token: accessToken });
    const profile = toProfile(data.user ?? data.profile ?? data);
    setUser(profile);
    setError(null);
    return profile;
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
      .catch((err) => {
        // Bootstrap failure must not throw, but it should not be silent either.
        setUser(null);
        if (err.code === 'ACCOUNT_INACTIVE') setError('This account has been deactivated.');
      })
      .finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        await loadProfile(session?.access_token);
      } catch (err) {
        setUser(null);
        if (err.code === 'ACCOUNT_INACTIVE') setError('This account has been deactivated.');
      }
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
      const profile = await loadProfile(data.session?.access_token);

      // Signed in with Supabase but the API could not confirm the profile.
      // Report it, instead of navigating to a page that bounces straight back.
      if (!profile) {
        throw new Error('Signed in, but your profile could not be loaded from the API.');
      }
      return { success: true };
    } catch (err) {
      throw new Error(explainAuthError(err));
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
