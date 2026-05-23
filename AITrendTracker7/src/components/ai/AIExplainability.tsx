import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  interpolate,
  measure,
  useAnimatedRef
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { PlatformIntelligenceBadges } from './PlatformIntelligenceBadges';
import { ConfidenceRing } from './ConfidenceRing';
import { RelationshipGraph } from './RelationshipGraph';

interface AIExplainabilityProps {
  trendId: string;
  baseConfidence: number;
  platforms: { name: string; weight: number; trust: number }[];
  isBotFiltered: boolean;
  isAnomalyChecked: boolean;
  relations: any[]; // Nodes for relationship graph
}

export const AIExplainability = React.memo(({
  trendId,
  baseConfidence,
  platforms,
  isBotFiltered,
  isAnomalyChecked,
  relations,
}: AIExplainabilityProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const heightProgress = useSharedValue(0);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    heightProgress.value = withTiming(isExpanded ? 0 : 1, { duration: 300 });
  };

  const expandedStyle = useAnimatedStyle(() => {
    return {
      opacity: heightProgress.value,
      maxHeight: interpolate(heightProgress.value, [0, 1], [0, 500]),
      overflow: 'hidden',
    };
  });

  const arrowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${interpolate(heightProgress.value, [0, 1], [0, 180])}deg` }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Base Summary (Always Visible) */}
      <TouchableOpacity 
        style={styles.header} 
        activeOpacity={0.7} 
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel="Expand AI Intelligence details"
      >
        <View style={styles.headerLeft}>
          <ConfidenceRing confidence={baseConfidence} size={40} strokeWidth={4} />
          <View style={styles.headerTitles}>
            <Text style={styles.title}>AI Intelligence</Text>
            <Text style={styles.subtitle}>Verified Signals</Text>
          </View>
        </View>
        <Animated.View style={arrowStyle}>
          <Feather name="chevron-down" size={20} color={colors.text.secondary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Progressive Disclosure Content (Lazy Collapsed) */}
      <Animated.View style={expandedStyle}>
        <View style={styles.expandedContent}>
          
          <Text style={styles.sectionTitle}>Platform Trust Matrices</Text>
          <View style={styles.badgesContainer}>
            {platforms.map(p => (
              <View key={p.name} style={{ marginRight: 8, marginBottom: 8 }}>
                 <PlatformIntelligenceBadges platform={p.name} weight={p.weight} trustScore={p.trust} />
              </View>
            ))}
          </View>

          <View style={styles.firewallContainer}>
            {isBotFiltered && (
              <View style={styles.chip}>
                <Feather name="shield" size={12} color={colors.neon.green} style={{ marginRight: 4 }} />
                <Text style={styles.chipText}>Bot Filtered</Text>
              </View>
            )}
            {isAnomalyChecked && (
              <View style={styles.chip}>
                <Feather name="check-circle" size={12} color={colors.neon.cyan} style={{ marginRight: 4 }} />
                <Text style={styles.chipText}>Anomaly Checked</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Relationship Network</Text>
          <View style={styles.graphContainer}>
            {isExpanded && relations && relations.length > 0 ? (
              <RelationshipGraph nodes={relations} width={300} height={180} />
            ) : (
              <View style={styles.placeholderGraph}><Text style={{color: colors.text.tertiary}}>No graph data available</Text></View>
            )}
          </View>

        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitles: {
    marginLeft: 12,
  },
  title: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.neon.cyan,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  expandedContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 5,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  firewallContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  chipText: {
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  graphContainer: {
    height: 180,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderGraph: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
