import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

interface Props {
  sentiment?: 'Positive' | 'Negative' | 'Neutral' | string;
  targetAudience?: string;
}

export default function SentimentChip({ sentiment, targetAudience }: Props) {
  if (!sentiment && !targetAudience) return null;

  const getColor = () => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return '#22c55e';
      case 'negative': return '#ef4444';
      default: return '#0ea5e9';
    }
  };
  const color = getColor();

  return (
    <View style={styles.container}>
      {sentiment && (
        <View style={[styles.chip, { backgroundColor: color + '15', borderColor: color + '30' }]}>
          <Feather name={sentiment.toLowerCase() === 'positive' ? 'smile' : sentiment.toLowerCase() === 'negative' ? 'frown' : 'meh'} size={12} color={color} style={{marginRight: 4}}/>
          <Text style={[styles.text, { color }]}>{sentiment}</Text>
        </View>
      )}
      {targetAudience && (
        <View style={[styles.chip, { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.3)' }]}>
          <Feather name="users" size={12} color="#a855f7" style={{marginRight: 4}}/>
          <Text style={[styles.text, { color: '#a855f7' }]} numberOfLines={1}>{targetAudience}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
    flexWrap: 'wrap'
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  }
});
