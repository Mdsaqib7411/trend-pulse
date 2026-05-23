import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store/hooks';
import { selectIsAuthenticated } from '../store/slices/authSlice';
import { ROUTES } from './routes';
import { RootStackParamList } from './types';

// Screens
import SplashScreen from '../navigations/screens/SplashScreen';
import LoginScreen from '../navigations/screens/LoginScreen';
import RegisterScreen from '../navigations/screens/RegisterScreen';
import TabNavigator from '../navigations/TabNavigator';
import TrendDetailScreen from '../navigations/screens/TrendDetailScreen';
import CategoryTrendsScreen from '../navigations/screens/CategoryTrendsScreen';
import NotificationsScreen from '../navigations/screens/NotificationsScreen';
import TrendAnalysisScreen from '../navigations/screens/TrendAnalysisScreen';
import TrendGraphScreen from '../navigations/screens/TrendGraphScreen';
import AIChatScreen from '../navigations/screens/AIChatScreen';
import GeoHeatmapScreen from '../navigations/screens/GeoHeatmapScreen';
import ProfileScreen from '../navigations/screens/ProfileScreen';
import EditProfileScreen from '../navigations/screens/EditProfileScreen';
import SecurityScreen from '../navigations/screens/SecurityScreen';
import ChangePasswordScreen from '../navigations/screens/ChangePasswordScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthGate() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [isSplashActive, setIsSplashActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashActive(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      {isSplashActive ? (
        <Stack.Screen name={ROUTES.SPLASH} component={SplashScreen} />
      ) : !isAuthenticated ? (
        <>
          <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
          <Stack.Screen name={ROUTES.REGISTER} component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name={ROUTES.MAIN_TABS} component={TabNavigator} />
          <Stack.Screen name={ROUTES.TREND_DETAIL} component={TrendDetailScreen} />
          <Stack.Screen name={ROUTES.CATEGORY_TRENDS} component={CategoryTrendsScreen} />
          <Stack.Screen name={ROUTES.NOTIFICATIONS} component={NotificationsScreen} />
          <Stack.Screen name={ROUTES.TREND_ANALYSIS} component={TrendAnalysisScreen} />
          <Stack.Screen name={ROUTES.TREND_GRAPH} component={TrendGraphScreen} />
          <Stack.Screen name={ROUTES.AI_CHAT} component={AIChatScreen} />
          <Stack.Screen name={ROUTES.GEO_HEATMAP} component={GeoHeatmapScreen} />
          <Stack.Screen name={ROUTES.PROFILE} component={ProfileScreen} />
          <Stack.Screen name={ROUTES.EDIT_PROFILE} component={EditProfileScreen} />
          <Stack.Screen name={ROUTES.SECURITY} component={SecurityScreen} />
          <Stack.Screen name={ROUTES.CHANGE_PASSWORD} component={ChangePasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
