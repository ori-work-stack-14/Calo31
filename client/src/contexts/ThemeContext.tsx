import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof lightColors | typeof darkColors;
}

const lightColors = {
  primary: '#10b981',
  primaryLight: '#34d399',
  primaryDark: '#059669',
  secondary: '#6366f1',
  background: '#ffffff',
  surface: '#f8fafc',
  card: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  textLight: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  gradient: ['#10b981', '#059669'],
  gradientLight: ['#ecfdf5', '#f0fdf4'],
};

const darkColors = {
  primary: '#10b981',
  primaryLight: '#34d399',
  primaryDark: '#059669',
  secondary: '#818cf8',
  background: '#111827',
  surface: '#1f2937',
  card: '#374151',
  text: '#f9fafb',
  textSecondary: '#d1d5db',
  textLight: '#9ca3af',
  border: '#4b5563',
  borderLight: '#374151',
  success: '#10b981',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  gradient: ['#10b981', '#059669'],
  gradientLight: ['#064e3b', '#065f46'],
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme_preference');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    try {
      await AsyncStorage.setItem('theme_preference', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};