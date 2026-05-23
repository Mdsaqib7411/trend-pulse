/**
 * TrendPulse Enforced TypeScript Navigation System
 * Declares strict type bounds for routes, screen params, and compilation verification.
 */
import { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ROUTES } from './routes';
import { Trend } from '../store/slices/trendsApi';

// Top-Level Root Stack Param List
export type RootStackParamList = {
  [ROUTES.SPLASH]: undefined;
  [ROUTES.LOGIN]: undefined;
  [ROUTES.REGISTER]: undefined;
  [ROUTES.MAIN_TABS]: NavigatorScreenParams<MainTabParamList>;
  [ROUTES.TREND_DETAIL]: { item: Trend };
  [ROUTES.CATEGORY_TRENDS]: { category: string };
  [ROUTES.NOTIFICATIONS]: undefined;
  [ROUTES.TREND_ANALYSIS]: { item: Trend };
  [ROUTES.TREND_GRAPH]: { item: Trend };
  [ROUTES.AI_CHAT]: { trendContext?: { title: string; content?: string; sourceUrl?: string } } | undefined;
  [ROUTES.GEO_HEATMAP]: undefined;
  [ROUTES.PROFILE]: undefined;
  [ROUTES.EDIT_PROFILE]: undefined;
  [ROUTES.SECURITY]: undefined;
  [ROUTES.CHANGE_PASSWORD]: undefined;
};

// Central Bottom Tabs Param List
export type MainTabParamList = {
  [ROUTES.HOME]: undefined;
  [ROUTES.TRENDING]: undefined;
  [ROUTES.SEARCH]: { query?: string } | undefined;
  [ROUTES.SAVED]: undefined;
};

// Screen-level typed props
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
