import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store/hooks';
import { selectIsAuthenticated } from '../store/slices/authSlice';
import { ROUTES } from '../navigation/routes';
import { RootStackParamList } from '../navigation/types';

// Screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TabNavigator from './TabNavigator';

// Shared Sub-screens (Can be pushed globally above tabs)
import TrendDetailScreen from './screens/TrendDetailScreen';
import CategoryTrendsScreen from './screens/CategoryTrendsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import TrendAnalysisScreen from './screens/TrendAnalysisScreen';
import TrendGraphScreen from './screens/TrendGraphScreen';
import AIChatScreen from './screens/AIChatScreen';
import GeoHeatmapScreen from './screens/GeoHeatmapScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthNavigator() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return (
    <Stack.Navigator
      initialRouteName={ROUTES.SPLASH}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      {!isAuthenticated ? (
        // 🔹 1. Unauthenticated Flow
        <>
          <Stack.Screen name={ROUTES.SPLASH} component={SplashScreen} />
          <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
          <Stack.Screen name={ROUTES.REGISTER} component={RegisterScreen} />
        </>
      ) : (
        // 🔹 2. Authenticated Flow
        <>
          <Stack.Screen name={ROUTES.MAIN_TABS} component={TabNavigator} />
          
          {/* Sub-screens registered at RootStack to allow clean overlays */}
          <Stack.Screen name={ROUTES.TREND_DETAIL} component={TrendDetailScreen} />
          <Stack.Screen name={ROUTES.CATEGORY_TRENDS} component={CategoryTrendsScreen} />
          <Stack.Screen name={ROUTES.NOTIFICATIONS} component={NotificationsScreen} />
          <Stack.Screen name={ROUTES.TREND_ANALYSIS} component={TrendAnalysisScreen} />
          <Stack.Screen name={ROUTES.TREND_GRAPH} component={TrendGraphScreen} />
          <Stack.Screen name={ROUTES.AI_CHAT} component={AIChatScreen} />
          <Stack.Screen name={ROUTES.GEO_HEATMAP} component={GeoHeatmapScreen} />
          <Stack.Screen name={ROUTES.PROFILE} component={ProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

