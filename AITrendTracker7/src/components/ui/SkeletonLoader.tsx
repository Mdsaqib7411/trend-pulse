import React, { useEffect } from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface ShimmerProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: any;
}

export const SkeletonShimmer = ({ width = '100%', height = 20, borderRadius = spacing.xs, style }: ShimmerProps) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  return (
    <Animated.View style={[styles.shimmer, { width, height, borderRadius }, style, animatedStyle]} />
  );
};

export const AISkeletonCard = () => {
  return (
    <View style={styles.cardContainer}>
      <SkeletonShimmer width={100} height={20} borderRadius={spacing.badgeRadius} style={{ marginBottom: spacing.sm }} />
      <SkeletonShimmer width="100%" height={120} borderRadius={spacing.cardRadius} style={{ marginBottom: spacing.md }} />
      <SkeletonShimmer width="60%" height={24} style={{ marginBottom: spacing.sm }} />
      <SkeletonShimmer width="40%" height={16} />
    </View>
  );
};

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: colors.overlay.heavy,
  },
  cardContainer: {
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.lg,
  }
});
