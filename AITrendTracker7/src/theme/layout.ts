/**
 * TrendPulse Layout System
 * Standardizes sizes, padding offsets, and component dimensions across screens.
 */
import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const layout = {
  window: {
    width,
    height,
  },
  isSmallDevice: width < 375,
  
  // Standard component heights
  TAB_BAR_HEIGHT: 74,
  HEADER_HEIGHT: 74,
  
  // Floating offsets
  FLOATING_TAB_OFFSET: 16,
  SAFE_BOTTOM_SPACING: Platform.OS === 'ios' ? 24 : 16,
  
  // Standard paddings
  SCREEN_HORIZONTAL_PADDING: 20,
  BOTTOM_TAB_OVERLAP_PADDING: 160, // Bottom padding required on screen ScrollViews to prevent bottom-tab overlay
};
