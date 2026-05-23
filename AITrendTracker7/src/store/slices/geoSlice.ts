import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface GeoLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export interface GeoState {
  userLocation: GeoLocation | null;
  radiusMetric: number; // in kilometers
  heatmapSpikes: any[];
}

const initialState: GeoState = {
  userLocation: null,
  radiusMetric: 50,
  heatmapSpikes: [],
};

const geoSlice = createSlice({
  name: 'geo',
  initialState,
  reducers: {
    setUserLocation: (state, action: PayloadAction<GeoLocation>) => {
      state.userLocation = action.payload;
    },
    setRadiusMetric: (state, action: PayloadAction<number>) => {
      state.radiusMetric = action.payload;
    },
    addGeoSpike: (state, action: PayloadAction<any>) => {
      state.heatmapSpikes.push(action.payload);
    },
    clearGeoSpikes: (state) => {
      state.heatmapSpikes = [];
    }
  },
});

export const { setUserLocation, setRadiusMetric, addGeoSpike, clearGeoSpikes } = geoSlice.actions;

export const selectGeoState = (state: RootState) => state.geo;
export const selectUserLocation = createSelector(selectGeoState, (state) => state.userLocation);
export const selectRadiusMetric = createSelector(selectGeoState, (state) => state.radiusMetric);
export const selectHeatmapSpikes = createSelector(selectGeoState, (state) => state.heatmapSpikes);

export default geoSlice.reducer;
