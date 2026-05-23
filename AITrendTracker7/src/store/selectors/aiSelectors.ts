/**
 * AI Selectors with Throttled Decay Engine
 * Uses re-reselect / memoized selector patterns for efficient time-decay calculation.
 */

import { createSelector } from '@reduxjs/toolkit';
import { selectPredictionForTrend } from '../slices/predictionSlice';

// Decay constant λ (e.g., decays by roughly half every 24 hours)
const LAMBDA_DECAY = 0.000008; 

// Base decay formula: C(t) = C0 * e^(-λ * Δt)
const calculateDecay = (baseConfidence: number, timeDeltaMs: number): number => {
  // Convert ms to minutes for realistic decay mapping
  const deltaMinutes = timeDeltaMs / 60000;
  return baseConfidence * Math.exp(-LAMBDA_DECAY * deltaMinutes);
};

/**
 * Creates a factory selector that throttles the decay computation.
 * This ensures that continuous component renders don't spam exponential math.
 */
export const makeSelectDecayedConfidence = (trendId: string) => {
  let lastComputedTime = 0;
  let lastComputedValue = 0;
  let hasAsymptoted = false;

  return createSelector(
    [
      selectPredictionForTrend(trendId), 
      (_state, currentTimeMs: number) => currentTimeMs
    ],
    (prediction, currentTimeMs) => {
      if (!prediction) return 0;
      
      // If we've reached floor value, halt recalculations entirely
      if (hasAsymptoted) return lastComputedValue;

      // Throttle window: 1000ms. Prevents re-calculation if time hasn't advanced enough.
      const timeSinceLastCompute = currentTimeMs - lastComputedTime;
      if (timeSinceLastCompute < 1000 && lastComputedTime !== 0) {
        return lastComputedValue;
      }

      const updatedAt = (prediction as any).updatedAt || currentTimeMs;
      const timeDelta = currentTimeMs - updatedAt;
      
      let decayedValue = calculateDecay(prediction.confidenceScore, timeDelta);
      
      // Floor value detection to save idle CPU cycles
      if (decayedValue < 5) {
        decayedValue = 0;
        hasAsymptoted = true;
      }

      lastComputedTime = currentTimeMs;
      lastComputedValue = Math.round(decayedValue);

      return lastComputedValue;
    }
  );
};
