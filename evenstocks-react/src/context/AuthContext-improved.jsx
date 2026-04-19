import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';

const AuthContext = createContext(null);

const TOKEN_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const TOKEN_WARNING_TIME = 60 * 60 * 1000; // Warn 1 hour before expiry

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tokenWarning, setTokenWarning] = useState(false);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);

  // Check and validate token on mount
  useEffect(() => {
    const username = Cookies.get('username');
    const userToken = Cookies.get('user_token');
    const expiresAt = localStorage.getItem('token_expires_at');

    if (username && userToken) {
      // Check if token is expired
      if (expiresAt && new Date().getTime() > parseInt(expiresAt)) {
        console.warn('Token expired, logging out');
        logout();
        return;
      }

      setUser({ username, token: userToken });
      setIsLoggedIn(true);
      setTokenExpiresAt(expiresAt ? parseInt(expiresAt) : null);

      // Set warning timer for token expiry
      if (expiresAt) {
        const timeUntilWarning = parseInt(expiresAt) - TOKEN_WARNING_TIME - new Date().getTime();
        if (timeUntilWarning > 0) {
          const warningTimer = setTimeout(() => {
            setTokenWarning(true);
            console.warn('Token will expire soon');
          }, timeUntilWarning);

          return () => clearTimeout(warningTimer);
        }
      }
    }
  }, []);

  // Set token expiry warning checks
  useEffect(() => {
    if (!tokenExpiresAt) return;

    const checkExpiry = setInterval(() => {
      const now = new Date().getTime();
      const timeLeft = tokenExpiresAt - now;

      if (timeLeft <= 0) {
        // Token expired
        logout();
        clearInterval(checkExpiry);
      } else if (timeLeft <= TOKEN_WARNING_TIME) {
        // Show warning
        setTokenWarning(true);
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(checkExpiry);
  }, [tokenExpiresAt]);

  const login = useCallback((username, token) => {
    const expiresAt = new Date().getTime() + TOKEN_EXPIRY_TIME;

    Cookies.set('username', username, { path: '/', expires: 7 });
    Cookies.set('user_token', token, { path: '/', expires: 7 });
    localStorage.setItem('token_expires_at', expiresAt.toString());

    setUser({ username, token });
    setIsLoggedIn(true);
    setTokenExpiresAt(expiresAt);
    setTokenWarning(false);
  }, []);

  const logout = useCallback(() => {
    Cookies.remove('username', { path: '/' });
    Cookies.remove('user_token', { path: '/' });
    localStorage.removeItem('token_expires_at');

    setUser(null);
    setIsLoggedIn(false);
    setTokenExpiresAt(null);
    setTokenWarning(false);
  }, []);

  // Extend session
  const extendSession = useCallback(() => {
    if (user) {
      const expiresAt = new Date().getTime() + TOKEN_EXPIRY_TIME;
      localStorage.setItem('token_expires_at', expiresAt.toString());
      setTokenExpiresAt(expiresAt);
      setTokenWarning(false);
    }
  }, [user]);

  const getTimeToExpiry = useCallback(() => {
    if (!tokenExpiresAt) return null;
    return Math.max(0, tokenExpiresAt - new Date().getTime());
  }, [tokenExpiresAt]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        login,
        logout,
        tokenWarning,
        extendSession,
        getTimeToExpiry,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
