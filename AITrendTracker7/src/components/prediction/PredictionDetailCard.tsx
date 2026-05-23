import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';

interface Props {
  prediction: {
    confidenceScore?: number;
    lifecycleState?: string;
    predictionJustification?: string;
  };
}

export default function PredictionDetailCard({ prediction }: Props) {
  const score = prediction.confidenceScore || 0;
  const percentage = Math.round(score * 100);
  const state = prediction.lifecycleState || 'UNKNOWN';

  const getStateColor = () => {
    switch(state.toUpperCase()) {
      case 'EMERGING': return '#0ea5e9';
      case 'VIRAL': return '#a855f7';
      case 'PEAK': return '#ef4444';
      case 'DEAD': return '#64748b';
      default: return '#0ea5e9';
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>AI Prediction Engine</Text>
      
      <View style={styles.row}>
        <View style={styles.scoreContainer}>
          <Text style={styles.label}>Confidence</Text>
          <Text style={styles.scoreText}>{percentage}%</Text>
        </View>
        <View style={styles.pillContainer}>
          <Text style={styles.label}>Lifecycle State</Text>
          <View style={[styles.pill, { backgroundColor: getStateColor() + '20', borderColor: getStateColor() }]}>
            <Text style={[styles.pillText, { color: getStateColor() }]}>{state}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressBg}>
        <LinearGradient 
          colors={['#6A25F4', '#00c6ff']} 
          style={[styles.progressFill, { width: `${percentage}%` }]} 
        />
      </View>

      {prediction.predictionJustification && (
        <View style={styles.justificationBox}>
          <Feather name="info" size={16} color="#0ea5e9" style={{ marginTop: 2 }} />
          <Text style={styles.justificationText}>{prediction.predictionJustification}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30,27,46,0.5)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  scoreContainer: {
    flex: 1,
  },
  scoreText: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  pillContainer: {
    alignItems: 'flex-end',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  justificationBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14,165,233,0.1)',
    padding: 12,
    borderRadius: 12,
  },
  justificationText: {
    color: '#cbd5e1',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  }
});
