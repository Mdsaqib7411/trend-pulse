import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface Metric {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
}

interface Props {
  reasoning: string;
  metrics: Metric[];
}

const ExplainabilityCard = ({ reasoning, metrics }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="cpu" size={16} color={colors.neon.purple} />
        <Text style={styles.headerText}>AI Reasoning</Text>
      </View>
      
      <Text style={styles.reasoningText}>{reasoning}</Text>

      <View style={styles.grid}>
        {metrics.map((metric, index) => {
          let icon = 'minus';
          let iconColor = colors.text.secondary;
          
          if (metric.trend === 'up') {
            icon = 'trending-up';
            iconColor = colors.neon.green;
          } else if (metric.trend === 'down') {
            icon = 'trending-down';
            iconColor = colors.neon.red;
          }

          return (
            <View key={index} style={styles.gridItem}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <View style={styles.valueRow}>
                <Feather name={icon} size={14} color={iconColor} style={styles.metricIcon} />
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.cardRadius,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerText: {
    color: colors.neon.purple,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: spacing.sm,
  },
  reasoningText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.relaxed,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  metricLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIcon: {
    marginRight: spacing.xs,
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  }
});

export default React.memo(ExplainabilityCard);
