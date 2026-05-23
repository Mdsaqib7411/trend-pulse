/**
 * TrendPulse Centralized Tab Configuration
 * Standardizes icons, labels, and accessibility tags across Bottom Tabs.
 */
import { ROUTES } from './routes';
import { colors } from '../theme/colors';

export interface TabConfigItem {
  route: typeof ROUTES.HOME | typeof ROUTES.TRENDING | typeof ROUTES.SEARCH | typeof ROUTES.SAVED;
  icon: string;
  label: string;
  accessibilityLabel: string;
}

export const TAB_BAR_ACTIVE_COLOR = colors.neon.purple;
export const TAB_BAR_INACTIVE_COLOR = colors.text.tertiary;

export const TAB_ITEMS: TabConfigItem[] = [
  {
    route: ROUTES.HOME,
    icon: 'home',
    label: 'Home',
    accessibilityLabel: 'Navigate to Home feed',
  },
  {
    route: ROUTES.TRENDING,
    icon: 'trending-up',
    label: 'Trending',
    accessibilityLabel: 'Navigate to Trending topics',
  },
  {
    route: ROUTES.SEARCH,
    icon: 'search',
    label: 'Search',
    accessibilityLabel: 'Navigate to Trend Search',
  },
  {
    route: ROUTES.SAVED,
    icon: 'bookmark',
    label: 'Saved',
    accessibilityLabel: 'Navigate to Saved trends',
  },
];
