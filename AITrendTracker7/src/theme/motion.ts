/**
 * Global Motion Foundation
 * Hardware-accelerated UI-thread animation tokens and interaction thresholds.
 */

import { Easing, WithSpringConfig } from 'react-native-reanimated';

export const MotionTokens = {
  // Spring Presets tailored for low-end Android (less overshoot, strict damping)
  springs: {
    stiff: {
      damping: 20,
      stiffness: 250,
      mass: 1,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 2,
    } as WithSpringConfig,
    bouncy: {
      damping: 15,
      stiffness: 180,
      mass: 0.8,
      overshootClamping: false,
    } as WithSpringConfig,
    subtle: {
      damping: 25,
      stiffness: 300,
      mass: 1,
      overshootClamping: true,
    } as WithSpringConfig,
  },

  // Easing Curves
  easings: {
    standard: Easing.bezier(0.4, 0.0, 0.2, 1),
    decelerate: Easing.bezier(0.0, 0.0, 0.2, 1),
    accelerate: Easing.bezier(0.4, 0.0, 1, 1),
    linear: Easing.linear,
  },

  // Gesture Thresholds
  gestures: {
    swipeActivationDistance: 25, // px distance to activate horizontal swipe
    swipeVelocityThreshold: 500, // px/s velocity to register a rapid swipe
    horizontalActiveOffsetX: [-20, 20] as [number, number], // Isolates vertical scrolling from horizontal swipes
  },

  // UI-Thread Cooldowns
  cooldowns: {
    gestureSpamMs: 400, // Reject gesture if previous animation is within 400ms
    socketBatchMs: 250, // Batch realtime feed reorders every 250ms
  },

  // Durations
  durations: {
    fast: 200,
    base: 300,
    slow: 500,
  },
};
