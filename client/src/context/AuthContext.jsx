/**
 * RecruitFlow — Authentication Context
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { candidatePortalService } from '../services/candidatePortalService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from local storage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('recruitflow_token');
      const storedUser = localStorage.getItem('recruitflow_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Failed to restore authentication session:', err);
      localStorage.removeItem('recruitflow_token');
      localStorage.removeItem('recruitflow_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('recruitflow_token', res.token);
      localStorage.setItem('recruitflow_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  const candidateLogin = async (email, password) => {
    const res = await candidatePortalService.login(email, password);
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('recruitflow_token', res.token);
      localStorage.setItem('recruitflow_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.message || 'Candidate login failed');
  };

  const candidateSignup = async (data) => {
    const res = await candidatePortalService.signup(data);
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('recruitflow_token', res.token);
      localStorage.setItem('recruitflow_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.message || 'Candidate registration failed');
  };


  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('recruitflow_token');
    localStorage.removeItem('recruitflow_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isCandidate: user?.role === 'CANDIDATE',
        isHR: user?.role === 'HR' || user?.role === 'ADMIN',
        loading,
        login,
        candidateLogin,
        candidateSignup,
        logout
      }}
    >
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
