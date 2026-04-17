import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('evenstocks_dark_theme');
      return saved !== null ? JSON.parse(saved) : true; // default dark
    } catch { return true; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('evenstocks_dark_theme', JSON.stringify(isDark));
    } catch {}
    // Force body background so no white bar shows on any page
    document.body.style.background = isDark ? '#0f0f0f' : '#ffffff';
    document.body.style.color = isDark ? '#e0e0e0' : '';
  }, [isDark]);

  const toggleTheme = () => setIsDark(d => !d);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
