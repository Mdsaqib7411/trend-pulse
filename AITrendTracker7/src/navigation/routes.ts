/**
 * TrendPulse Route Constants
 * Enforces unified naming conventions across stack and tab navigation.
 */
export const ROUTES = {
  // Auth Stack Screens
  SPLASH: 'Splash',
  LOGIN: 'Login',
  REGISTER: 'Register',
  
  // Bottom Tab Main Container
  MAIN_TABS: 'MainTabs',
  
  // Main Tab Stack Entrypoints
  HOME: 'Home',
  TRENDING: 'Trending',
  SEARCH: 'Search',
  SAVED: 'Saved',
  PROFILE: 'Profile',
  EDIT_PROFILE: 'EditProfile',
  SECURITY: 'Security',
  CHANGE_PASSWORD: 'ChangePassword',
  
  // Sub-screens & Overlays
  TREND_DETAIL: 'TrendDetail',
  CATEGORY_TRENDS: 'CategoryTrends',
  NOTIFICATIONS: 'Notifications',
  TREND_ANALYSIS: 'TrendAnalysis',
  TREND_GRAPH: 'TrendGraph',
  AI_CHAT: 'AIChat',
  GEO_HEATMAP: 'GeoHeatmap',
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];
