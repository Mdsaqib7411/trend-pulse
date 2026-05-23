import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useReducedMotion,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface PredictiveSkeletonProps {
  isVisible: boolean;
  type?: 'card' | 'featured';
}

/**
 * High-performance 0% Layout Shift skeleton.
 * Only uses opacity transitions and pauses when offscreen or when reduced motion is enabled.
 */
export const PredictiveSkeleton = React.memo(({ isVisible, type = 'card' }: PredictiveSkeletonProps) => {
  const opacity = useSharedValue(0.3);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (isVisible && !reducedMotion) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1, // infinite
        true
      );
    } else {
      cancelAnimation(opacity);
      opacity.value = 0.5; // Static fallback for reduced motion / offscreen
    }
    return () => {
      cancelAnimation(opacity);
    };
  }, [isVisible, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const isFeatured = type === 'featured';

  return (
    <View style={[styles.container, isFeatured && styles.featuredContainer]}>
      <Animated.View style={[styles.shimmerBase, animatedStyle]}>
        {/* Header section */}
        <View style={styles.header}>
          <View style={styles.avatar} />
          <View style={styles.titleLines}>
            <View style={styles.line1} />
            <View style={styles.line2} />
          </View>
        </View>
        {/* Image/Content section */}
        <View style={styles.contentBlock} />
        {/* Footer section */}
        <View style={styles.footer}>
          <View style={styles.badge} />
          <View style={styles.badgeSmall} />
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: width - 32,
    height: 150,
    alignSelf: 'center',
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  featuredContainer: {
    height: 220,
    width: 280,
    marginHorizontal: 10,
  },
  shimmerBase: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border.subtle,
    marginRight: 12,
  },
  titleLines: {
    flex: 1,
    justifyContent: 'center',
  },
  line1: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.border.subtle,
    marginBottom: 8,
  },
  line2: {
    width: '40%',
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.border.subtle,
  },
  contentBlock: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: colors.border.subtle,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badge: {
    width: 80,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border.subtle,
  },
  badgeSmall: {
    width: 50,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border.subtle,
  },
});
