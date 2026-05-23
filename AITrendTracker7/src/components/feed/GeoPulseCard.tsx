import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, withSpring } from 'react-native-reanimated';
import Feather from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { animationPresets } from '../../theme/animationPresets';

interface Props {
  geoSpike: any;
}

// Global haptic throttle tracker to prevent spam from rapid socket events
let lastHapticTimestamp = 0;
const HAPTIC_COOLDOWN_MS = 1500;

const GeoPulseCard = ({ geoSpike }: Props) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    // Hardware accelerated entry animations
    opacity.value = withTiming(1, animationPresets.timingConfig);
    translateY.value = withSpring(0, animationPresets.springConfig);

    // Spam-protected haptics
    const now = Date.now();
    if (now - lastHapticTimestamp > HAPTIC_COOLDOWN_MS) {
      lastHapticTimestamp = now;
      ReactNativeHapticFeedback.trigger('impactHeavy', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false
      });
    }
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.header}>
        <Feather name="map-pin" size={16} color={colors.neon.red} />
        <Text style={styles.title}>Local Geo-Spike Detected</Text>
      </View>
      <Text style={styles.location}>{geoSpike.city || geoSpike.country || 'Unknown Region'}</Text>
      <Text style={styles.details}>Activity spiked by {geoSpike.velocity || 300}% in the last hour.</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: spacing.cardRadius,
    padding: spacing.lg,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.neon.red,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
    marginLeft: spacing.sm,
  },
  location: {
    color: colors.text.primary,
    fontWeight: typography.weight.black,
    fontSize: typography.size.lg,
    marginBottom: spacing.xs,
  },
  details: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.normal,
  }
});

export default React.memo(GeoPulseCard);
