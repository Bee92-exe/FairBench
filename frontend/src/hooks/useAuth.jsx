import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockDb } from '../mocks/mockDb';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => mockDb.getCurrentUser());
  const [loading, setLoading] = useState(false);

  // Quick switch profile for development, testing, and demonstrations
  const switchUser = (userIdOrRole) => {
    const nextUser = mockDb.setCurrentUser(userIdOrRole);
    setUser({ ...nextUser });
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      // If email matches one of the mock profiles
      const profiles = mockDb.getProfiles();
      const match = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      if (match) {
        mockDb.setCurrentUser(match.id);
        setUser({ ...match });
      } else {
        // Default student login
        const newStudent = {
          id: `usr-${Date.now().toString().slice(-4)}`,
          email,
          name: email.split('@')[0],
          role: email.includes('admin') || email.includes('haque') ? 'admin' : 'student',
          weeklyHoursUsed: 0,
          openRequestsCount: 0
        };
        mockDb.setCurrentUser(newStudent);
        setUser(newStudent);
      }
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
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
      switchUser,
      loading
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
