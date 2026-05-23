/**
 * TrendPulse Color System
 * Premium Dark Palette with AAA Contrast Neon Accents
 */
export const colors = {
  // Backgrounds
  background: {
    primary: '#05050A',
    secondary: '#11101A', // Elevated cards
    tertiary: '#1e1b2e',  // High emphasis backgrounds
  },

  // Neon Accents
  neon: {
    cyan: '#00C6FF',     // Intelligence, Growth
    purple: '#6A25F4',   // AI, Analysis
    pink: '#FF007A',     // Alerts, Critical
    green: '#4ADE80',    // Success, Positive Velocity
    red: '#EF4444',      // Error, Dead Trends
    blue: '#2563EB',     // Action Button Blue
  },

  // Text
  text: {
    primary: '#F8FAFC',  // Main readable text
    secondary: '#94A3B8', // Descriptions, metadata
    tertiary: '#64748B',  // Disabled, extremely muted
  },

  // Overlays (Glassmorphism alphas)
  overlay: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.1)',
    heavy: 'rgba(255, 255, 255, 0.2)',
    darkLight: 'rgba(5, 5, 10, 0.5)',
    darkHeavy: 'rgba(5, 5, 10, 0.8)',
    cyanGlow: 'rgba(0, 198, 255, 0.15)',
    purpleGlow: 'rgba(106, 37, 244, 0.15)',
  },

  // Borders
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    active: 'rgba(0, 198, 255, 0.3)',
  }
};
