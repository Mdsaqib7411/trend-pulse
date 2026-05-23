/**
 * Throttled Haptic Feedback Engine
 * Prevents haptic spamming during rapid gesture lists or socket bursts.
 */

import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

let lastHapticTime = 0;
const HAPTIC_COOLDOWN_MS = 200;

export const Haptics = {
  /**
   * Impact for physical gestures (swipe actions)
   */
  impact(style: 'light' | 'medium' | 'heavy' = 'light', throttle: boolean = true) {
    const now = Date.now();
    if (throttle && now - lastHapticTime < HAPTIC_COOLDOWN_MS) return;
    lastHapticTime = now;
    ReactNativeHapticFeedback.trigger(`impact${style.charAt(0).toUpperCase() + style.slice(1)}` as any, options);
  },

  /**
   * Notification for incoming events (socket realtime data)
   */
  notify(type: 'success' | 'warning' | 'error' = 'success', throttle: boolean = true) {
    const now = Date.now();
    if (throttle && now - lastHapticTime < HAPTIC_COOLDOWN_MS) return;
    lastHapticTime = now;
    ReactNativeHapticFeedback.trigger(`notification${type.charAt(0).toUpperCase() + type.slice(1)}` as any, options);
  },

  /**
   * Selection for small UI toggles (filters, tabs)
   */
  selection() {
    ReactNativeHapticFeedback.trigger('selection', options);
  },
};
