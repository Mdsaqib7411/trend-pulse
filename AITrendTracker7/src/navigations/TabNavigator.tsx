/**
 * TrendPulse Bottom Tab Navigator
 * Implements nested Stacks for each Tab, custom floating absolute TabBar,
 * lazy rendering, freeze on blur, and strict TypeScript routes compatibility.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';

// Route imports
import { ROUTES } from '../navigation/routes';
import { MainTabParamList } from '../navigation/types';
import { gradients } from '../theme/gradients';
import { colors } from '../theme/colors';

// Screens imports
import HomeScreen from './screens/HomeScreen';
import TrendingScreen from './screens/TrendingScreen';
import SearchScreen from './screens/SearchScreen';
import SavedScreen from './screens/SavedScreen';




// Centralized configurations
import { TAB_ITEMS } from '../navigation/tabConfig';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Nested Stacks Definition
const HomeStack = createNativeStackNavigator<any>();
const TrendingStack = createNativeStackNavigator<any>();
const SearchStack = createNativeStackNavigator<any>();
const SavedStack = createNativeStackNavigator<any>();

const screenOptions = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  gestureDirection: 'horizontal' as const,
};

// 🔹 1. Home Stack Navigator
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator initialRouteName={ROUTES.HOME} screenOptions={screenOptions}>
      <HomeStack.Screen name={ROUTES.HOME} component={HomeScreen as any} />
    </HomeStack.Navigator>
  );
}

// 🔹 2. Trending Stack Navigator
function TrendingStackNavigator() {
  return (
    <TrendingStack.Navigator initialRouteName={ROUTES.TRENDING} screenOptions={screenOptions}>
      <TrendingStack.Screen name={ROUTES.TRENDING} component={TrendingScreen as any} />
    </TrendingStack.Navigator>
  );
}

// 🔹 3. Search Stack Navigator
function SearchStackNavigator() {
  return (
    <SearchStack.Navigator initialRouteName={ROUTES.SEARCH} screenOptions={screenOptions}>
      <SearchStack.Screen name={ROUTES.SEARCH} component={SearchScreen as any} />
    </SearchStack.Navigator>
  );
}

// 🔹 4. Saved Stack Navigator
function SavedStackNavigator() {
  return (
    <SavedStack.Navigator initialRouteName={ROUTES.SAVED} screenOptions={screenOptions}>
      <SavedStack.Screen name={ROUTES.SAVED} component={SavedScreen as any} />
    </SavedStack.Navigator>
  );
}



// 🔹 Custom Floating Tab Bar Component (Mimics old absolute BottomNav)
function CustomTabBar({ state, descriptors: _descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Height of the system navigation area (black box) - increased for cleaner padding/breathing room
  const sysNavHeight = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 36 : 16);
  // Float the tab bar pill beautifully and clearly above the system navigation area with a generous gap
  const bottomOffset = sysNavHeight + 20;

  return (
    <>
      {/* 🔹 Smooth Dark Gradient Mask to fade out scrolling feed/list content */}
      <LinearGradient
        colors={['transparent', 'rgba(5, 5, 10, 0.9)', '#05050A']}
        style={styles.bottomMask}
        pointerEvents="none"
      />

      {/* 🔹 Solid Black Box at the bottom to remove system navigation transparency */}
      <View style={[styles.sysNavBar, { height: sysNavHeight }]} />

      {/* 🔹 Custom Floating Tab Bar Pill */}
      <View style={[styles.container, { bottom: bottomOffset }]}>
        <LinearGradient
          colors={gradients.navBackground as any}
          style={styles.nav}
        >
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const tabItem = TAB_ITEMS.find(item => item.route === route.name);
            const label = tabItem ? tabItem.label : route.name;
            const iconName = tabItem ? tabItem.icon : 'home';
            const accessibilityLabel = tabItem ? tabItem.accessibilityLabel : undefined;

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={accessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.navItem}
                activeOpacity={0.7}
              >
                <Feather
                  name={iconName}
                  size={22}
                  color={isFocused ? colors.neon.purple : colors.text.tertiary}
                />
                <Text style={isFocused ? styles.labelActive : styles.label}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </LinearGradient>
      </View>
    </>
  );
}

// 🔹 Master Tab Navigator Component
export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      <Tab.Screen name={ROUTES.HOME} component={HomeStackNavigator} />
      <Tab.Screen name={ROUTES.TRENDING} component={TrendingStackNavigator} />
      <Tab.Screen name={ROUTES.SEARCH} component={SearchStackNavigator} />
      <Tab.Screen name={ROUTES.SAVED} component={SavedStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bottomMask: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140, // Covers from 0 up to 140dp (higher than the tab bar top of ~120dp)
    zIndex: 9997,
  },
  sysNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000', // Pure black dark box
    zIndex: 9998,
  },
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64, // Spacious height with more internal padding
    paddingHorizontal: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.3)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    paddingTop: 0,
    paddingBottom: 0, // Ensures precise vertical alignment
  },
  label: {
    color: colors.text.tertiary,
    fontSize: 10,
    marginTop: 2, // Rebalanced space to center content perfectly
    fontWeight: '500',
  },
  labelActive: {
    color: colors.neon.purple,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
  },
});
