/**
 * PersonaSync Theme Configuration
 */

import { Platform } from 'react-native';

// Ana Renkler
export const PersonaSyncColors = {
  // Primary - Koyu mavi-yeşil tonları
  primary: '#1D3D47',
  primaryLight: '#2A5A68',
  primaryDark: '#142B33',
  
  // Secondary - Açık mavi tonları
  secondary: '#A1CEDC',
  secondaryLight: '#C5E4ED',
  secondaryDark: '#7ABAC9',
  
  // Accent - Vurgu renkleri
  accent: '#4ECDC4',
  accentLight: '#7EDDD6',
  accentDark: '#3DBDB5',
  
  // Neutrals
  white: '#FFFFFF',
  offWhite: '#F8FAFB',
  lightGray: '#E8EEF0',
  gray: '#94A3B8',
  darkGray: '#64748B',
  charcoal: '#334155',
  black: '#0F172A',
  
  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Transparent
  overlay: 'rgba(29, 61, 71, 0.7)',
  cardShadow: 'rgba(29, 61, 71, 0.1)',
};

const tintColorLight = PersonaSyncColors.primary;
const tintColorDark = PersonaSyncColors.secondary;

export const Colors = {
  light: {
    text: PersonaSyncColors.charcoal,
    textSecondary: PersonaSyncColors.darkGray,
    background: PersonaSyncColors.offWhite,
    surface: PersonaSyncColors.white,
    tint: tintColorLight,
    icon: PersonaSyncColors.darkGray,
    tabIconDefault: PersonaSyncColors.gray,
    tabIconSelected: tintColorLight,
    border: PersonaSyncColors.lightGray,
    inputBackground: PersonaSyncColors.white,
    placeholder: PersonaSyncColors.gray,
  },
  dark: {
    text: PersonaSyncColors.white,
    textSecondary: PersonaSyncColors.secondary,
    background: PersonaSyncColors.primaryDark,
    surface: PersonaSyncColors.primary,
    tint: tintColorDark,
    icon: PersonaSyncColors.secondary,
    tabIconDefault: PersonaSyncColors.gray,
    tabIconSelected: tintColorDark,
    border: PersonaSyncColors.primaryLight,
    inputBackground: PersonaSyncColors.primaryLight,
    placeholder: PersonaSyncColors.gray,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: PersonaSyncColors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: PersonaSyncColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: PersonaSyncColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};