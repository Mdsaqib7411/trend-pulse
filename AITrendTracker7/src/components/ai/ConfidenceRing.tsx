import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSpring,
  useReducedMotion,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ConfidenceRingProps {
  confidence: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  isVisible?: boolean; // Offscreen aware freezing
}

export const ConfidenceRing = React.memo(({
  confidence,
  size = 60,
  strokeWidth = 6,
  isVisible = true,
}: ConfidenceRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const reducedMotion = useReducedMotion();
  
  // Shared value for smooth interpolation of confidence changes
  const animatedConfidence = useSharedValue(0);

  useEffect(() => {
    if (!isVisible) {
      cancelAnimation(animatedConfidence);
      return;
    }

    if (reducedMotion) {
      animatedConfidence.value = confidence;
      return;
    }

    // Smooth interpolation for AI recalibration decays
    animatedConfidence.value = withTiming(confidence, {
      duration: 800,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    return () => {
      cancelAnimation(animatedConfidence);
    };
  }, [confidence, isVisible, reducedMotion]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (animatedConfidence.value / 100) * circumference;
    return {
      strokeDashoffset,
    };
  });

  // Color selection based on confidence scale
  const getGradientColors = () => {
    if (confidence > 80) return [colors.neon.cyan, colors.neon.purple];
    if (confidence > 50) return [colors.neon.green, colors.neon.cyan];
    if (confidence > 20) return ['#FBBF24', '#F59E0B']; // Warning Yellow
    return [colors.neon.red, '#991B1B']; // Dead trend Red
  };

  const [startColor, endColor] = getGradientColors();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={startColor} />
            <Stop offset="100%" stopColor={endColor} />
          </LinearGradient>
        </Defs>

        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border.subtle}
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Animated Confidence Stroke */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#grad)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          // Start from top (-90 degrees)
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.centerContent}>
        <Text style={styles.scoreText}>{Math.round(confidence)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
