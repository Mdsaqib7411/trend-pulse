import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../../theme/colors';
import { animationPresets } from '../../theme/animationPresets';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type LifecycleState = 'emerging' | 'accelerating' | 'viral' | 'declining' | 'dead';

interface Props {
  state: LifecycleState;
}

const LifecycleBadge = ({ state }: Props) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (state === 'viral' || state === 'accelerating') {
      scale.value = animationPresets.pulseGlow(1.1);
    } else {
      scale.value = 1; // Reset if state changes
    }
  }, [state, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const getBadgeConfig = () => {
    switch (state) {
      case 'emerging':
        return { color: colors.neon.cyan, icon: 'loader', bg: colors.overlay.cyanGlow, text: 'EMERGING' };
      case 'accelerating':
        return { color: colors.neon.purple, icon: 'trending-up', bg: colors.overlay.purpleGlow, text: 'ACCELERATING' };
      case 'viral':
        return { color: colors.neon.pink, icon: 'zap', bg: 'rgba(255, 0, 122, 0.15)', text: 'VIRAL' };
      case 'declining':
        return { color: colors.text.secondary, icon: 'trending-down', bg: colors.overlay.medium, text: 'DECLINING' };
      case 'dead':
        return { color: colors.text.tertiary, icon: 'slash', bg: colors.overlay.light, text: 'DEAD' };
      default:
        return { color: colors.text.primary, icon: 'circle', bg: colors.overlay.light, text: 'UNKNOWN' };
    }
  };

  const config = getBadgeConfig();

  return (
    <Animated.View style={[styles.container, { backgroundColor: config.bg, borderColor: config.color }, animatedStyle]}>
      <Feather name={config.icon} size={12} color={config.color} style={styles.icon} />
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.badgeRadius,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: spacing.xs,
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  }
});

export default React.memo(LifecycleBadge);
