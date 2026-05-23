import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { PredictionNode } from '../../store/slices/predictionSlice';

interface Props {
  prediction: PredictionNode;
}

const PredictionCard = ({ prediction }: Props) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="cpu" size={16} color="#a855f7" />
        <Text style={styles.title}>AI Lifecycle Prediction</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.stateText}>State: {prediction.lifecycleState.toUpperCase()}</Text>
        <Text style={styles.scoreText}>Confidence: {prediction.confidenceScore}%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(106,37,244,0.1)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.3)'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#a855f7',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stateText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 13,
  },
  scoreText: {
    color: '#00F2FE',
    fontWeight: '600',
    fontSize: 13,
  }
});

export default React.memo(PredictionCard);
