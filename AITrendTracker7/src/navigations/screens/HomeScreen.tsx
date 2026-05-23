import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import LinearGradient from "react-native-linear-gradient";
import { Screen } from '../../components/common/Screen';
import FeedList from '../../components/feed/FeedList';

// Redux hooks
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useGetHomeFeedQuery } from '../../store/apiSlice';
import { selectUser } from '../../store/slices/authSlice';
import { selectUnreadCount } from '../../store/slices/notificationsSlice';
import { setLiveTrends, setFastestRising, updatePulseScore, selectLiveTrendsIds, selectFastestRising, selectPulseScore } from '../../store/slices/trendsSlice';
import { Trend } from "../../store/slices/trendsSlice";
import { ROUTES } from "../../navigation/routes";
import { MainTabScreenProps } from "../../navigation/types";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { gradients } from "../../theme/gradients";
import { layout } from "../../theme/layout";

export default function HomeScreen({ navigation }: MainTabScreenProps<typeof ROUTES.HOME>) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const unreadCount = useAppSelector(selectUnreadCount);

  const liveTrendsIds = useAppSelector(selectLiveTrendsIds);
  const fastestRising = useAppSelector(selectFastestRising);
  const pulseScore = useAppSelector(selectPulseScore);

  // RTK Query for fetching data (Handles caching and deduping automatically)
  const { data: homeFeedResponse, isLoading, isFetching, refetch } = useGetHomeFeedQuery(undefined, {
    pollingInterval: 0, // rely on websocket for real-time
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (homeFeedResponse?.success && homeFeedResponse?.data?.length > 0) {
      const data = homeFeedResponse.data;
      dispatch(setLiveTrends(data.slice(0, 3)));
      dispatch(setFastestRising(data.slice(3, 8)));

      const topEng = data.slice(0, 5).reduce((acc: number, curr: any) => acc + (curr.engagementScore || 10), 0);
      dispatch(updatePulseScore(Math.min(99, Math.max(50, Math.floor(topEng / 2)))));
    }
  }, [homeFeedResponse, dispatch]);

  const handleTrendPress = useCallback((item: Trend) => {
    navigation.navigate(ROUTES.TREND_DETAIL, { item });
  }, [navigation]);

  return (
    <Screen scrollable={false}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate(ROUTES.PROFILE)}>
          <LinearGradient colors={gradients.button as any} style={styles.profileRing}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.profile} />
            ) : (
              <View style={[styles.profile, { justifyContent: 'center', alignItems: 'center' }]}>
                <Feather name="user" size={20} color="#E2E8F0" />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.name}>Hello, {user?.displayName ? user.displayName.split(' ')[0] : "TrendSetter"} 👋</Text>
        </View>

        <View style={styles.icons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate(ROUTES.SEARCH)}>
            <Feather name="search" size={18} color="#E2E8F0" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 12 }]} onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS)}>
            <Feather name="bell" size={18} color="#E2E8F0" />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.ambientGlow} />

        {/* PULSE CARD */}
        <LinearGradient
          colors={gradients.cardElevated as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sentimentCard}
        >
          <View>
            <Text style={styles.sentimentTitle}>Global AI Pulse</Text>
            <Text style={styles.positive}>Hyperactive</Text>
            <View style={styles.badge}>
              <Feather name="activity" size={14} color={colors.neon.cyan} style={{ marginRight: 6 }} />
              <Text style={styles.percent}>High Engagement</Text>
            </View>
          </View>

          <View style={styles.circleContainer}>
            <LinearGradient colors={gradients.button as any} style={styles.circleBg}>
              <View style={styles.circleInner}>
                <Text style={styles.circleText}>{pulseScore}</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 10, marginTop: -2 }}>Score</Text>
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>

        {/* TRENDING CAROUSEL */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Trends</Text>
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.CATEGORY_TRENDS, { category: 'All' })}>
            <Text style={styles.viewAll}>Explore all</Text>
          </TouchableOpacity>
        </View>

        <FeedList
          data={liveTrendsIds}
          isHorizontal={true}
          onTrendPress={handleTrendPress}
          type="standard"
          isLoading={isLoading}
        />

        {/* FASTEST GROWING LIST */}
        <View style={[styles.sectionHeader, { marginTop: 30 }]}>
          <Text style={styles.sectionTitle}>Rising Fast</Text>
        </View>

        <FeedList
          data={fastestRising}
          isHorizontal={false}
          onTrendPress={handleTrendPress}
          type="emerging"
          refreshing={isFetching}
          onRefresh={refetch}
          isLoading={isLoading}
        />
      </ScrollView>

      {/* AI Chat FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => navigation.navigate(ROUTES.AI_CHAT)}>
        <LinearGradient colors={gradients.purpleBlue as any} style={styles.fabInner}>
          <Feather name="message-circle" size={26} color="#FFF" />
          <View style={styles.fabSparkle}>
            <Feather name="zap" size={10} color="#FFD700" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ambientGlow: { position: 'absolute', top: -50, left: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(0, 242, 254, 0.05)', transform: [{ scale: 2 }] },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenPadding, marginTop: 20, marginBottom: 25 },
  profileRing: { padding: 2, borderRadius: 24 },
  profile: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background.tertiary },
  userInfo: { flex: 1, marginLeft: 14 },
  welcome: { color: colors.text.secondary, fontSize: 13, marginBottom: 2 },
  name: { color: colors.text.primary, fontSize: 18, fontWeight: typography.weight.black, letterSpacing: 0.5 },
  icons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.overlay.light, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.border.subtle },
  notificationDot: { position: "absolute", top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.neon.red, borderWidth: 1.5, borderColor: colors.background.tertiary },
  sentimentCard: { borderRadius: 20, padding: 24, marginHorizontal: spacing.screenPadding, marginBottom: 35, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: 'rgba(0, 242, 254, 0.2)' },
  sentimentTitle: { color: colors.text.secondary, fontSize: 12, fontWeight: typography.weight.bold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 },
  positive: { color: colors.text.primary, fontSize: 28, fontWeight: typography.weight.black, letterSpacing: 0.5 },
  badge: { flexDirection: "row", alignItems: "center", backgroundColor: 'rgba(0, 242, 254, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 10, alignSelf: "flex-start" },
  percent: { color: colors.neon.cyan, fontSize: 12, fontWeight: typography.weight.bold },
  circleContainer: { justifyContent: "center", alignItems: "center" },
  circleBg: { width: 76, height: 76, borderRadius: 38, padding: 3, justifyContent: 'center', alignItems: 'center' },
  circleInner: { width: '100%', height: '100%', borderRadius: 35, backgroundColor: '#0A0515', justifyContent: 'center', alignItems: 'center' },
  circleText: { color: colors.text.primary, fontWeight: typography.weight.black, fontSize: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, marginBottom: 15 },
  sectionTitle: { color: colors.text.primary, fontSize: 20, fontWeight: typography.weight.black, letterSpacing: 0.5 },
  viewAll: { color: colors.neon.cyan, fontSize: 14, fontWeight: typography.weight.semiBold },
  fab: { position: 'absolute', bottom: 120, right: 20, width: 60, height: 60, borderRadius: 30, elevation: 8, zIndex: 10 },
  fabInner: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  fabSparkle: { position: 'absolute', top: 12, right: 12 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: layout.BOTTOM_TAB_OVERLAP_PADDING,
  },
});
