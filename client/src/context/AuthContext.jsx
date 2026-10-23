/**
 * RecruitFlow — Authentication Context
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { candidatePortalService } from '../services/candidatePortalService';

const AuthContext = createContext(null);

const TOKEN_KEY = 'recruitflow_token';
const USER_KEY = 'recruitflow_user';

/**
 * Reads the exp claim from a JWT without verifying it (the server verifies every request);
 * used only to avoid restoring a session that has already expired.
 */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * Landing page for each role after login.
 */
export function homePathForRole(role) {
  if (role === 'CANDIDATE') return '/candidate/dashboard';
  if (role === 'INTERVIEWER') return '/interviews';
  return '/dashboard';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from local storage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser && !isTokenExpired(storedToken)) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } catch (err) {
      console.error('Failed to restore authentication session:', err);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const storeSession = (res, fallbackMessage) => {
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.message || fallbackMessage);
  };

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    return storeSession(res, 'Login failed');
  };

  const candidateLogin = async (email, password) => {
    const res = await candidatePortalService.login(email, password);
    return storeSession(res, 'Candidate login failed');
  };

  const candidateSignup = async (data) => {
    const res = await candidatePortalService.signup(data);
    return storeSession(res, 'Candidate registration failed');
  };

  /**
   * Keeps the cached user (e.g. display name) in sync after a profile update.
   */
  const updateUser = useCallback((changes) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isCandidate: user?.role === 'CANDIDATE',
        isHR: user?.role === 'HR' || user?.role === 'ADMIN',
        isInterviewer: user?.role === 'INTERVIEWER',
        loading,
        login,
        candidateLogin,
        candidateSignup,
        updateUser,
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
