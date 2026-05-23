import React, { useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { MotionTokens } from '../../theme/motion';
import { Haptics } from '../../utils/haptics';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3; // 30% of screen to trigger swipe
const MAX_TRANSLATE = width;

interface GestureSwipeWrapperProps {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  trendId: string;
}

export const GestureSwipeWrapper = React.memo(({
  children,
  onSwipeRight,
  onSwipeLeft,
  trendId,
}: GestureSwipeWrapperProps) => {
  const translateX = useSharedValue(0);
  const isInteracting = useSharedValue(false);
  const lastInteractionTime = useSharedValue(0); // Pure UI thread cooldown tracking

  // We wrap callbacks to invoke JS layer from UI worklet
  const handleSwipeRight = useCallback(() => {
    Haptics.impact('heavy');
    if (onSwipeRight) onSwipeRight();
  }, [onSwipeRight]);

  const handleSwipeLeft = useCallback(() => {
    Haptics.impact('light');
    if (onSwipeLeft) onSwipeLeft();
  }, [onSwipeLeft]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(MotionTokens.gestures.horizontalActiveOffsetX)
    .onStart(() => {
      'worklet';
      // Spam protection check at native layer
      const now = Date.now();
      if (now - lastInteractionTime.value < MotionTokens.cooldowns.gestureSpamMs) {
        return; // Ignore spam gestures
      }
      isInteracting.value = true;
    })
    .onUpdate((event: any) => {
      'worklet';
      if (!isInteracting.value) return;
      // Clamp translation to screen edges
      const nextTranslate = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, event.translationX));
      translateX.value = nextTranslate;
    })
    .onEnd((event: any) => {
      'worklet';
      if (!isInteracting.value) return;
      isInteracting.value = false;
      lastInteractionTime.value = Date.now(); // Record UI thread interaction time

      const velocity = Math.abs(event.velocityX);
      const isFast = velocity > MotionTokens.gestures.swipeVelocityThreshold;
      const isFar = Math.abs(translateX.value) > SWIPE_THRESHOLD;

      if (isFar || isFast) {
        // Trigger action based on direction
        if (translateX.value > 0) {
          // Swipe Right
          translateX.value = withSpring(MAX_TRANSLATE, MotionTokens.springs.stiff, () => {
            runOnJS(handleSwipeRight)();
          });
        } else {
          // Swipe Left
          translateX.value = withSpring(-MAX_TRANSLATE, MotionTokens.springs.stiff, () => {
            runOnJS(handleSwipeLeft)();
          });
        }
      } else {
        // Cancel swipe, return to center
        translateX.value = withSpring(0, MotionTokens.springs.bouncy);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      // Optional: Dim opacity slightly as it swipes away
      opacity: Math.max(0.5, 1 - Math.abs(translateX.value) / width),
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
