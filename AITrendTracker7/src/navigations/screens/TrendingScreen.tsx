import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import LinearGradient from "react-native-linear-gradient";
import { Screen } from "../../components/common/Screen";
import Header from "../../components/common/Header";
import { TrendCardSkeleton } from "../../components/SkeletonLoader";
import SentimentChip from "../../components/ui/SentimentChip";
import { trackInteraction } from "../../utils/interactionTracker";
import { useGetTrendingQuery } from "../../store/slices/trendsApi";
import { ROUTES } from "../../navigation/routes";
import { MainTabScreenProps } from "../../navigation/types";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { layout } from "../../theme/layout";

export default function TrendingScreen({ navigation }: MainTabScreenProps<typeof ROUTES.TRENDING>) {
  const [activeTab, setActiveTab] = React.useState('Trending');
  const { data: responseData, isLoading } = useGetTrendingQuery(activeTab);

  const trends = responseData?.data?.slice(0, 10) || [];

  return (
    <Screen scrollable={false}>
      {/* HEADER */}
      <Header 
        title="Trending Now" 
        showBack={false}
        rightComponent={
          <LinearGradient 
            colors={[colors.neon.purple, colors.neon.cyan]} 
            style={styles.iconRing}
          >
            <Feather name="bar-chart-2" size={20} color={colors.text.primary} />
          </LinearGradient>
        }
      />

      {/* TABS */}
      <View style={styles.tabsContainer}>
        {['Trending', 'For You', 'Emerging'].map(tab => (
          <TouchableOpacity 
            key={tab} 
            onPress={() => setActiveTab(tab)} 
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* CONTENT */}
        <View style={styles.content}>

          {isLoading ? (
            <View>
              <TrendCardSkeleton />
              <TrendCardSkeleton />
              <TrendCardSkeleton />
              <TrendCardSkeleton />
              <TrendCardSkeleton />
            </View>
          ) : (
            trends.map((item, index) => (
              <TouchableOpacity
                key={item.trendId || index}
                style={styles.trendCard}
                activeOpacity={0.8}
                onPress={() => {
                  trackInteraction(item.trendId || item.id || "", 'click');
                  navigation.navigate(ROUTES.TREND_DETAIL, { item });
                }}
              >
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                
                <View style={styles.trendInfo}>
                  <Text style={styles.topicText} numberOfLines={1}>{item.title}</Text>
                  <SentimentChip sentiment={item.sentiment} targetAudience={item.targetAudience} />
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>

                <View style={styles.statsInfo}>
                  <Text style={styles.popularityText}>{item.readTime}</Text>
                  <View style={styles.growthBadge}>
                    <Text style={styles.trendPercent}>{item.growth}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          <LinearGradient
            colors={[colors.overlay.purpleGlow, colors.overlay.cyanGlow]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.exploreCard}
          >
            <View style={styles.exploreIconCircle}>
              <Feather name="compass" size={28} color={colors.neon.cyan} />
            </View>
            <Text style={styles.exploreTitle}>Explore More Niches</Text>
            <Text style={styles.exploreSubtitle}>Find emerging trends before they go viral.</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate(ROUTES.CATEGORY_TRENDS, { category: 'All' })}>
              <LinearGradient colors={[colors.neon.cyan, "#0ea5e9"]} style={styles.exploreBtn}>
                <Text style={styles.exploreBtnText}>Discover</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>

        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: layout.BOTTOM_TAB_OVERLAP_PADDING,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: spacing.buttonRadius,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  tab: {
    marginRight: spacing.screenPadding,
    paddingBottom: spacing.sm,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.neon.cyan,
  },
  tabText: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semiBold,
  },
  activeTabText: {
    color: colors.text.primary,
  },
  trendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 27, 46, 0.6)",
    padding: spacing.lg,
    borderRadius: spacing.cardRadius,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.overlay.purpleGlow,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  rankText: {
    color: "#d8b4fe",
    fontWeight: typography.weight.bold,
    fontSize: typography.size.lg,
  },
  trendInfo: {
    flex: 1,
  },
  topicText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  categoryText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  statsInfo: {
    alignItems: "flex-end",
  },
  popularityText: {
    color: "#cbd5e1",
    fontSize: typography.size.sm,
    marginBottom: 6,
  },
  growthBadge: {
    backgroundColor: "rgba(34, 211, 238, 0.1)",
    paddingHorizontal: spacing.badgeRadius,
    paddingVertical: spacing.xs,
    borderRadius: spacing.badgeRadius,
  },
  trendPercent: {
    color: colors.neon.cyan,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  exploreCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: spacing.buttonRadius,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.2)",
    elevation: 4,
    shadowColor: colors.neon.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  exploreIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(34, 211, 238, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  exploreTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
  },
  exploreSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    textAlign: "center",
    marginBottom: spacing.screenPadding,
    lineHeight: 20,
  },
  exploreBtn: {
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: spacing.buttonRadius,
  },
  exploreBtnText: {
    color: colors.background.primary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.base,
  },
});
