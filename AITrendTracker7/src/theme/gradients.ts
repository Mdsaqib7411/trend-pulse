/**
 * TrendPulse Gradient Token System
 * Predefined linear gradient configurations for enterprise-grade visuals.
 */
import { colors } from './colors';

export const gradients = {
  // Brand & Accent Gradients
  primary: [colors.neon.purple, colors.neon.blue, colors.neon.cyan] as const,
  primaryHorizontal: {
    colors: [colors.neon.purple, colors.neon.blue, colors.neon.cyan] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },

  // Premium Action Button Gradients
  button: [colors.neon.cyan, '#4FACFE'] as const,
  buttonHorizontal: {
    colors: [colors.neon.cyan, '#4FACFE'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },

  purpleBlue: ['#6A25F4', '#00c6ff'] as const,
  purpleBlueHorizontal: {
    colors: ['#6A25F4', '#00c6ff'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },

  greenSuccess: ['#22c55e', '#10b981'] as const,
  purplePink: ['#a855f7', '#d946ef'] as const,

  // Card & Container Gradients
  card: ['rgba(30,27,46,0.9)', 'rgba(106,37,244,0.08)'] as const,
  cardMuted: ['rgba(20,15,30,0.4)', 'rgba(20,15,30,0.2)'] as const,
  cardElevated: ['rgba(30,30,45,0.9)', 'rgba(15,15,25,0.9)'] as const,
  cardDark: ['rgba(25,25,35,0.7)', 'rgba(10,10,15,0.8)'] as const,

  // Ambient Glow & Overlays
  glowPurple: ['rgba(106,37,244,0.2)', 'rgba(0,198,255,0.05)'] as const,
  glowCyan: ['rgba(0,242,254,0.2)', 'rgba(0,242,254,0.05)'] as const,
  glowAlert: ['rgba(239,68,68,0.2)', 'rgba(239,68,68,0.05)'] as const,
  glowSuccess: ['rgba(34,197,94,0.12)', 'rgba(20,15,30,0.8)'] as const,
  glowSystem: ['rgba(251,191,36,0.2)', 'rgba(251,191,36,0.05)'] as const,

  // Ambient & Bottom Fade
  bottomFade: ['transparent', 'rgba(0,0,0,0.9)', '#000'] as const,
  navBackground: ['rgba(20,15,30,0.97)', 'rgba(10,5,15,0.99)'] as const,
};
