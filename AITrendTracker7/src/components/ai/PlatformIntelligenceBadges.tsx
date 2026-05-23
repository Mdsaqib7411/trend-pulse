import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../../theme/colors';

interface BadgeProps {
  platform: string;
  weight: number;
  trustScore: number;
}

export const PlatformIntelligenceBadges = React.memo(({ platform, weight, trustScore }: BadgeProps) => {
  const getIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'youtube': return 'youtube';
      case 'twitter': return 'twitter';
      case 'reddit': return 'message-square';
      default: return 'globe';
    }
  };

  const getTrustColor = (score: number) => {
    if (score >= 80) return colors.neon.cyan;
    if (score >= 50) return colors.neon.green;
    return colors.neon.red;
  };

  const trustColor = getTrustColor(trustScore);

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { backgroundColor: `${trustColor}20`, borderColor: trustColor }]}>
        <Feather name={getIcon(platform)} size={14} color={trustColor} />
      </View>
      <View style={styles.dataCol}>
        <Text style={styles.platformName}>{platform.toUpperCase()}</Text>
        <Text style={styles.metric}>
          <Text style={{ color: colors.text.secondary }}>W: </Text>{weight.toFixed(1)}x 
          <Text style={{ color: colors.text.secondary }}> • T: </Text>
          <Text style={{ color: trustColor }}>{trustScore}%</Text>
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minWidth: 120,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 10,
  },
  dataCol: {
    justifyContent: 'center',
  },
  platformName: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metric: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.primary,
  },
});
