// Environment configuration for TrendPulse Mobile Client
// Deployed Railway Production Backend URL
export const LIVE_RAILWAY_URL = "https://trend-pulse-production-3b7e.up.railway.app";

export const BASE_URL = __DEV__ 
  ? LIVE_RAILWAY_URL 
  : LIVE_RAILWAY_URL;
