import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../';

// Backend stores predictions.confidenceScore as a 0.0–1.0 float.
// All comparisons and display logic must treat it as such.
// To render as a percentage in UI: Math.round(node.confidenceScore * 100)
export interface PredictedRegion {
  country: string;
  state?: string;
  probability: number;   // 0.0–1.0
  timeLagHours: number;
}

export interface PredictionNode {
  trendId: string;
  confidenceScore: number;         // 0.0–1.0  (NOT 0–100)
  lifecycleState: 'emerging' | 'accelerating' | 'viral' | 'declining' | 'dead';
  predictedRegions?: PredictedRegion[];
  predictionJustification?: string;
  matchedTrendId?: string;
  historicalPeak?: number;
  migrationMatrix?: any;
  computedAt?: string;
  updatedAt?: number;              // ms timestamp — used by aiSelectors decay engine
}

export interface PredictionState {
  // 0.0–1.0 scale matching backend confidenceScore.
  // Default 0.75 = only show predictions with ≥75% confidence.
  globalConfidenceThreshold: number;
  activePredictions: Record<string, PredictionNode>;
}

const initialState: PredictionState = {
  globalConfidenceThreshold: 0.75,  // was incorrectly 75 — fixed to match 0.0–1.0 scale
  activePredictions: {},
};

const predictionSlice = createSlice({
  name: 'prediction',
  initialState,
  reducers: {
    updateConfidenceThreshold: (state, action: PayloadAction<number>) => {
      state.globalConfidenceThreshold = action.payload;
    },
    updatePredictionNode: (state, action: PayloadAction<PredictionNode>) => {
      state.activePredictions[action.payload.trendId] = action.payload;
    },
    clearPredictions: (state) => {
      state.activePredictions = {};
    }
  },
});

export const { updateConfidenceThreshold, updatePredictionNode, clearPredictions } = predictionSlice.actions;

export const selectPredictionState = (state: RootState) => state.prediction;
export const selectGlobalConfidence = createSelector(selectPredictionState, (state) => state.globalConfidenceThreshold);
export const selectAllPredictions = createSelector(selectPredictionState, (state) => state.activePredictions);
export const selectPredictionForTrend = (trendId: string) => createSelector(
  selectAllPredictions,
  (predictions) => predictions[trendId] || null
);

export default predictionSlice.reducer;
