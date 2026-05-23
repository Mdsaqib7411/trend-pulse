import { Easing, withTiming, withSpring, withRepeat, withSequence } from 'react-native-reanimated';

/**
 * TrendPulse Animation Presets
 * Hardware-accelerated config blocks for Reanimated using Transform/Opacity
 */

export const animationPresets = {
  // Standard entry timing for smooth UI pop-in
  timingConfig: {
    duration: 300,
    easing: Easing.bezier(0.25, 1, 0.5, 1), // Deceleration curve
  },
  
  // Snappy spring for interactive elements (cards, badges)
  springConfig: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },

  // Looping GPU-safe pulse for indicators
  pulseGlow: (scaleAmount = 1.05) => {
    'worklet';
    return withRepeat(
      withSequence(
        withTiming(scaleAmount, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite repeat
      true // Reverse loop
    );
  },
  
  // Hardware accelerated opacity fade
  fadeIn: (duration = 300) => {
    'worklet';
    return withTiming(1, { duration, easing: Easing.inOut(Easing.ease) });
  },
  fadeOut: (duration = 300) => {
    'worklet';
    return withTiming(0, { duration, easing: Easing.inOut(Easing.ease) });
  }
};
