import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import Feather from 'react-native-vector-icons/Feather';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  confidenceScore: number;
  migrationMatrix?: { [timeKey: string]: string }; // e.g., {'0h': 'Bhopal', '6h': 'Indore', '12h': 'Mumbai'}
}

const PredictionVisualizer = ({ confidenceScore, migrationMatrix }: Props) => {
  const radius = 40;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(confidenceScore / 100, {
      duration: 1200,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });
  }, [confidenceScore, progress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - progress.value * circumference;
    return {
      strokeDashoffset,
    };
  });

  // Default mock matrix if backend doesn't provide it yet
  const matrix = migrationMatrix || { '0h': 'Current', '6h': 'Expanding', '12h': 'Peak' };
  const timelineKeys = Object.keys(matrix);

  return (
    <View style={styles.container}>
      {/* Top Section: AI Confidence Ring */}
      <View style={styles.header}>
        <View style={styles.ringContainer}>
          <Svg width={100} height={100} viewBox="0 0 100 100">
            <G rotation="-90" origin="50, 50">
              {/* Background Track */}
              <Circle
                cx="50"
                cy="50"
                r={radius}
                stroke={colors.overlay.heavy}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Animated Progress */}
              <AnimatedCircle
                cx="50"
                cy="50"
                r={radius}
                stroke={colors.neon.cyan}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                animatedProps={animatedProps}
              />
            </G>
          </Svg>
          <View style={styles.scoreOverlay}>
            <Text style={styles.scoreText}>{confidenceScore}%</Text>
            <Text style={styles.scoreLabel}>AI CONF</Text>
          </View>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>Predictive Trajectory</Text>
          <Text style={styles.subtitle}>AI anticipates viral migration based on current engagement velocity.</Text>
        </View>
      </View>

      {/* Bottom Section: Horizontal Timeline */}
      <View style={styles.timelineContainer}>
        {timelineKeys.map((key, index) => (
          <View key={key} style={styles.timelineNode}>
            <View style={styles.nodeHeader}>
              <View style={[styles.dot, index === 0 && styles.activeDot]} />
              {index < timelineKeys.length - 1 && <View style={styles.line} />}
            </View>
            <Text style={styles.timeLabel}>{key}</Text>
            <Text style={styles.locationLabel} numberOfLines={1}>{matrix[key]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.cardRadius,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  ringContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: colors.neon.cyan,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  scoreLabel: {
    color: colors.text.secondary,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    marginTop: -2,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.normal,
  },
  timelineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  timelineNode: {
    flex: 1,
    alignItems: 'flex-start',
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.overlay.heavy,
    borderWidth: 2,
    borderColor: colors.background.secondary,
    zIndex: 2,
  },
  activeDot: {
    backgroundColor: colors.neon.purple,
    borderColor: colors.overlay.purpleGlow,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: colors.overlay.heavy,
    marginLeft: -2,
    zIndex: 1,
  },
  timeLabel: {
    color: colors.neon.cyan,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    marginBottom: 2,
  },
  locationLabel: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semiBold,
  }
});

export default React.memo(PredictionVisualizer);
