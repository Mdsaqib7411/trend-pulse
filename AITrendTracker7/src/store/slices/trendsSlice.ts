import { createSlice, PayloadAction, createSelector, createEntityAdapter, EntityState } from '@reduxjs/toolkit';
import type { RootState } from '../';

export interface Trend {
  trendId: string;
  title: string;
  category: string;
  source: string;
  trendScore: number;
  engagementScore: number;
  isEmerging: boolean;
  image?: string;
  time?: string;
  growth?: string;
}

export const trendsAdapter = createEntityAdapter<Trend, string>({
  selectId: (trend) => trend.trendId,
  sortComparer: (a, b) => b.trendScore - a.trendScore, // Optional: keeps highest score on top
});

export interface TrendsState {
  liveTrends: EntityState<Trend, string>;
  fastestRising: Trend[];
  activeFilters: string[];
  pulseScore: number;
}

const initialState: TrendsState = {
  liveTrends: trendsAdapter.getInitialState(),
  fastestRising: [],
  activeFilters: [],
  pulseScore: 75,
};

const trendsSlice = createSlice({
  name: 'trends',
  initialState,
  reducers: {
    setLiveTrends: (state, action: PayloadAction<Trend[]>) => {
      trendsAdapter.setAll(state.liveTrends, action.payload);
    },
    setFastestRising: (state, action: PayloadAction<Trend[]>) => {
      state.fastestRising = action.payload;
    },
    updatePulseScore: (state, action: PayloadAction<number>) => {
      state.pulseScore = action.payload;
    },
    addRealtimeTrend: (state, action: PayloadAction<Trend>) => {
      trendsAdapter.upsertOne(state.liveTrends, action.payload);
    },
    addRealtimeTrendsBatch: (state, action: PayloadAction<Trend[]>) => {
      trendsAdapter.upsertMany(state.liveTrends, action.payload);
    },
    toggleFilter: (state, action: PayloadAction<string>) => {
      const filter = action.payload;
      if (state.activeFilters.includes(filter)) {
        state.activeFilters = state.activeFilters.filter(f => f !== filter);
      } else {
        state.activeFilters.push(filter);
      }
    },
  },
});

export const { setLiveTrends, setFastestRising, updatePulseScore, addRealtimeTrend, addRealtimeTrendsBatch, toggleFilter } = trendsSlice.actions;

export const selectTrendsState = (state: RootState) => state.trends;
export const liveTrendsSelectors = trendsAdapter.getSelectors<RootState>((state) => state.trends.liveTrends);

export const selectLiveTrends = liveTrendsSelectors.selectAll;
export const selectLiveTrendsIds = liveTrendsSelectors.selectIds;
export const selectLiveTrendById = liveTrendsSelectors.selectById;

export const selectFastestRising = createSelector(selectTrendsState, (state) => state.fastestRising);
export const selectPulseScore = createSelector(selectTrendsState, (state) => state.pulseScore);
export const selectActiveFilters = createSelector(selectTrendsState, (state) => state.activeFilters);

export default trendsSlice.reducer;
