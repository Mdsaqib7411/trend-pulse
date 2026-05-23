import { createSelector } from '@reduxjs/toolkit';
import { selectAllPredictions, selectGlobalConfidence } from '../slices/predictionSlice';

/**
 * TrendPulse Prediction Selectors
 * Memoized pipelines for AI inference states
 */

export const selectHighConfidencePredictions = createSelector(
  [selectAllPredictions, selectGlobalConfidence],
  (predictions, threshold) => {
    return Object.values(predictions).filter(
      (node) => node.confidenceScore >= threshold
    );
  }
);

export const selectViralPredictions = createSelector(
  [selectAllPredictions],
  (predictions) => {
    return Object.values(predictions).filter(
      (node) => node.lifecycleState === 'viral' || node.lifecycleState === 'accelerating'
    );
  }
);

export const selectTimelineForPrediction = (trendId: string) => createSelector(
  [selectAllPredictions],
  (predictions) => {
    const node = predictions[trendId];
    if (!node || !node.migrationMatrix) return null;
    return node.migrationMatrix;
  }
);
