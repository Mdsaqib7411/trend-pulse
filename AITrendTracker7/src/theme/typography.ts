/**
 * TrendPulse Typography System
 * Scales for standard enterprise readability
 */
export const typography = {
  // Font Sizes
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  
  // Font Weights (Using system fonts)
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  }
};
