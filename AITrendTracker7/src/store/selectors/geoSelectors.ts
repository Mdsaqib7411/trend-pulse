import { createSelector } from '@reduxjs/toolkit';
import { selectHeatmapSpikes, selectRadiusMetric, selectUserLocation } from '../slices/geoSlice';

/**
 * TrendPulse Geo Selectors
 * Strictly memoized to prevent re-renders on the Map layer
 */

// Filter spikes by radius (client-side spatial filtering)
// Uses naive distance logic for demo, could use haversine formula in production
export const selectSpikesInRadius = createSelector(
  [selectHeatmapSpikes, selectUserLocation, selectRadiusMetric],
  (spikes, userLoc, radius) => {
    if (!userLoc) return spikes;
    
    // Very simple coordinate distance bound check for performance
    const latRadius = radius / 111; // rough km to lat conversion
    const lngRadius = radius / (111 * Math.cos(userLoc.lat * (Math.PI / 180)));
    
    return spikes.filter(spike => {
      const latDiff = Math.abs(spike.lat - userLoc.lat);
      const lngDiff = Math.abs(spike.lng - userLoc.lng);
      return latDiff <= latRadius && lngDiff <= lngRadius;
    });
  }
);

// Map the raw spike data directly to react-native-maps Heatmap nodes format
export const selectHeatmapNodes = createSelector(
  [selectHeatmapSpikes],
  (spikes) => {
    return spikes.map(spike => ({
      latitude: spike.lat,
      longitude: spike.lng,
      weight: spike.weight || (spike.velocity / 100) || 1
    }));
  }
);

// Derived state to quickly check if map has active threats/spikes
export const selectHasActiveSpikes = createSelector(
  [selectHeatmapNodes],
  (nodes) => nodes.length > 0
);
