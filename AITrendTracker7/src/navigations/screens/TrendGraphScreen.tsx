import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView, 
  Animated, Easing, Share
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { TrendGraphSkeleton } from '../../components/SkeletonLoader';
import PredictionDetailCard from '../../components/prediction/PredictionDetailCard';
import { trackInteraction } from '../../utils/interactionTracker';
import {
  useGetTrendAnalyticsQuery,
  useGetTrendPredictionQuery,
  useLazyGetTrendHistoryQuery,
  useBookmarkTrendMutation
} from '../../store/slices/trendsApi';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import { ROUTES } from '../../navigation/routes';
import { RootStackScreenProps } from '../../navigation/types';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';

type Props = RootStackScreenProps<typeof ROUTES.TREND_GRAPH>;

export default function TrendGraphScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const trendId = item.trendId || item.id || '0';

  const { data: analyticsData, isLoading: isAnalyticsLoading } = useGetTrendAnalyticsQuery(trendId);
  const { data: predictionData, isLoading: isPredictionLoading } = useGetTrendPredictionQuery(trendId);
  const [triggerHistoryQuery, { data: historyData }] = useLazyGetTrendHistoryQuery();
  const [bookmarkTrendMutation] = useBookmarkTrendMutation();

  const [isSaved, setIsSaved] = useState(false);
  const [activeTimeFilter, setActiveTimeFilter] = useState('24H');
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const chartData = historyData || analyticsData?.data?.graphData || [];
  const regions = analyticsData?.data?.regionalDistribution || [];
  const prediction = predictionData?.data || null;

  const analytics = {
    currentScore: analyticsData?.data?.currentScore || 0,
    growthRate: analyticsData?.data?.growthRate || 0,
    viralityTrend: analyticsData?.data?.viralityTrend || 'Stable',
    mentionsCount: analyticsData?.data?.mentionsCount || 0,
    highestScore: analyticsData?.data?.highestScore || 0,
  };

  const loading = isAnalyticsLoading || isPredictionLoading;

  useEffect(() => {
    // Start pulse animation for LIVE badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    trackInteraction(trendId, 'click');
  }, []);

  useEffect(() => {
    if (!loading && analyticsData?.success) {
      // Intro Animations
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true })
      ]).start();
    }
  }, [loading, analyticsData]);

  const isPositive = analytics.growthRate >= 0;

  // Actions
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this trending topic: ${item.title}\nCurrently tracking a growth rate of ${analytics.growthRate}%! \n${item.url || ''}`
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleAskAI = () => {
    navigation.navigate(ROUTES.AI_CHAT, { 
      trendContext: { title: item.title, content: (item as any).content, sourceUrl: item.sourceUrl } 
    });
  };

  const handleTimeFilter = async (filter: string) => {
    setActiveTimeFilter(filter);
    try {
      await triggerHistoryQuery({ id: trendId, timeframe: filter }).unwrap();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBookmark = async () => {
    try {
      const res = await bookmarkTrendMutation(trendId).unwrap();
      if (res.success) {
        setIsSaved(res.bookmarked);
      }
    } catch (e) {
      console.error('Bookmark error:', e);
    }
  };

  // Dynamic Network Distribution based on source
  const getNetworkDistribution = () => {
    const type = (item as any).type || 'news';
    if (type === 'video') return [{ name: 'YouTube', icon: 'youtube', color: '#FF0000', val: '78%' }, { name: 'Reddit', icon: 'message-square', color: '#FF4500', val: '12%' }, { name: 'News', icon: 'globe', color: colors.neon.cyan, val: '10%' }];
    if (type === 'reddit') return [{ name: 'Reddit', icon: 'message-square', color: '#FF4500', val: '82%' }, { name: 'News', icon: 'globe', color: colors.neon.cyan, val: '12%' }, { name: 'YouTube', icon: 'youtube', color: '#FF0000', val: '6%' }];
    return [{ name: 'News', icon: 'globe', color: colors.neon.cyan, val: '65%' }, { name: 'Reddit', icon: 'message-square', color: '#FF4500', val: '25%' }, { name: 'YouTube', icon: 'youtube', color: '#FF0000', val: '10%' }];
  };

  const getSystemAlert = () => {
    if (analytics.growthRate > 50) return { icon: 'zap', color: '#fbbf24', text: 'Viral velocity spike detected', time: 'Just now' };
    if (analytics.growthRate < -20) return { icon: 'alert-triangle', color: colors.neon.red, text: 'Engagement dropping rapidly', time: '1 hour ago' };
    return { icon: 'activity', color: colors.neon.cyan, text: 'Momentum holding steady', time: 'Updated recently' };
  };

  const systemAlert = getSystemAlert();

  // Render High-Density Pseudo-Line Chart
  const renderChart = () => {
    const maxDataValue = Math.max(...chartData.map((d: any) => d.value), 50);
    const yAxisMax = maxDataValue * 1.2;

    return (
      <View style={styles.chartContainer}>
        {/* Dynamic Y Axis */}
        <View style={styles.chartYAxis}>
          {[1, 0.5, 0].map((mult, i) => (
            <Text key={i} style={styles.chartYAxisText}>{Math.round(yAxisMax * mult)}</Text>
          ))}
        </View>

        <View style={styles.chartBarsArea}>
          {/* Horizontal Grid Lines */}
          <View style={styles.gridLines}>
            {[0, 1, 2].map(i => <View key={i} style={styles.gridLine} />)}
          </View>
          
          <View style={[
              styles.chartBarsContainer, 
              { justifyContent: chartData.length <= 3 ? 'center' : 'space-between' }
            ]}>
            {chartData.length === 0 ? (
              <Text style={styles.noDataText}>No data points available</Text>
            ) : chartData.map((d: any, i: number) => {
              const heightPct = `${Math.min((d.value / yAxisMax) * 100, 100)}%`;
              return (
                <View key={i} style={[
                    styles.chartBarWrapper,
                    chartData.length <= 3 && { marginHorizontal: 25 }
                  ]}>
                  <View style={[styles.chartBarFill, { height: heightPct as any }]}>
                    <LinearGradient
                      colors={isPositive ? [colors.neon.cyan, 'rgba(0,242,254,0.1)'] : [colors.neon.red, 'rgba(255,8,68,0.1)']}
                      style={StyleSheet.absoluteFill}
                      start={{x: 0, y: 0}} end={{x: 0, y: 1}}
                    />
                    <View style={styles.chartBarDot} />
                  </View>
                  <Text style={styles.chartXAxisText} numberOfLines={1}>{d.month.split(' ')[0]}</Text>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    );
  };

  const rightComponent = (
    <View style={styles.liveBadge}>
      <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );

  if (loading) {
    return (
      <Screen scrollable={false} safeAreaEdges={['top']}>
        <Header title={item.title || "Trend Details"} showBack={true} onBack={() => navigation.goBack()} />
        <TrendGraphSkeleton />
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} safeAreaEdges={['top']}>
      {/* BACKGROUND EFFECTS */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      {/* 1️⃣ HEADER */}
      <Header
        title={item.title}
        showBack={true}
        onBack={() => navigation.goBack()}
        rightComponent={rightComponent}
      />

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* 2️⃣ HERO ANALYTICS CARD */}
          <LinearGradient colors={['rgba(30,30,45,0.9)', 'rgba(15,15,25,0.9)']} style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroLabel}>CURRENT MOMENTUM SCORE</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroScore}>{analytics.currentScore.toLocaleString()}</Text>
              <View style={[styles.growthBadge, { backgroundColor: isPositive ? 'rgba(0,242,254,0.15)' : 'rgba(255,8,68,0.15)' }]}>
                <Feather name={isPositive ? "trending-up" : "trending-down"} size={14} color={isPositive ? colors.neon.cyan : colors.neon.red} />
                <Text style={[styles.growthBadgeText, { color: isPositive ? colors.neon.cyan : colors.neon.red }]}>
                  {isPositive ? '+' : ''}{analytics.growthRate}%
                </Text>
              </View>
            </View>
            
            <View style={styles.heroMetrics}>
              <View style={styles.miniMetric}>
                <Feather name="activity" size={14} color={colors.text.tertiary} />
                <Text style={styles.miniMetricText}>{analytics.viralityTrend}</Text>
              </View>
              <View style={styles.miniMetric}>
                <Feather name="users" size={14} color={colors.text.tertiary} />
                <Text style={styles.miniMetricText}>{analytics.mentionsCount > 1000 ? (analytics.mentionsCount/1000).toFixed(1) + 'k' : analytics.mentionsCount} mentions</Text>
              </View>
            </View>
          </LinearGradient>

          {/* 3️⃣ INTERACTIVE CHART SECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Volume Trajectory</Text>
              <View style={styles.timeFilters}>
                {['24H', '7D', '30D'].map((t, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.timeFilterBtn, activeTimeFilter === t && styles.timeFilterActive]}
                    onPress={() => handleTimeFilter(t)}
                  >
                    <Text style={[styles.timeFilterText, activeTimeFilter === t && styles.timeFilterTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <LinearGradient colors={['rgba(25,25,35,0.7)', 'rgba(10,10,15,0.8)']} style={styles.chartWrapper}>
              {renderChart()}
            </LinearGradient>
          </View>

          {/* 4️⃣ AI INSIGHTS SECTION */}
          <View style={styles.section}>
            <LinearGradient colors={['rgba(138,43,226,0.15)', 'rgba(0,0,0,0.5)']} style={styles.aiInsightsCard}>
              <View style={styles.aiHeader}>
                <LinearGradient colors={['#8A2BE2', '#4FACFE']} style={styles.aiIconBg}>
                  <Feather name="cpu" size={16} color={colors.text.primary} />
                </LinearGradient>
                <Text style={styles.aiTitle}>TrendPulse AI Insight</Text>
              </View>
              <Text style={styles.aiText}>
                {item.aiSummary || "This trend is showing significant anomalous acceleration in tech-related communities. Predictive models indicate a high probability of mainstream crossover within 48 hours."}
              </Text>
            </LinearGradient>
          </View>

          {/* 4.5️⃣ PREDICTION CARD */}
          {prediction && (
            <View style={styles.section}>
              <PredictionDetailCard prediction={prediction} />
            </View>
          )}

          {/* 5️⃣ SOURCE DISTRIBUTION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Network Distribution</Text>
            <View style={styles.sourceGrid}>
              {getNetworkDistribution().map((src, i) => (
                <View key={i} style={styles.sourceCard}>
                  <Feather name={src.icon} size={20} color={src.color} />
                  <Text style={styles.sourceVal}>{src.val}</Text>
                  <Text style={styles.sourceName}>{src.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 5.5️⃣ GLOBAL REACH */}
          {regions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Global Reach</Text>
              <LinearGradient colors={['rgba(35,30,50,0.8)', 'rgba(15,10,25,0.9)']} style={styles.reachCard}>
                {regions.map((region: any, idx: number) => (
                  <View key={idx} style={styles.regionRow}>
                    <View style={styles.regionHeader}>
                      <Text style={styles.regionName}>📍 {region.region}</Text>
                      <Text style={styles.regionPercentage}>{region.percentage}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <Animated.View style={[styles.progressBarFill, { width: `${region.percentage}%` }]} />
                    </View>
                  </View>
                ))}
              </LinearGradient>
            </View>
          )}

          {/* 6️⃣ SMART ALERTS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Alerts</Text>
            <View style={styles.alertCard}>
              <View style={[styles.alertIcon, { backgroundColor: `rgba(${systemAlert.color === colors.neon.red ? '255,8,68' : systemAlert.color === colors.neon.cyan ? '0,242,254' : '251,191,36'}, 0.1)` }]}>
                <Feather name={systemAlert.icon} size={16} color={systemAlert.color} />
              </View>
              <View style={styles.alertInfo}>
                <Text style={styles.alertText}>{systemAlert.text}</Text>
                <Text style={styles.alertTime}>{systemAlert.time}</Text>
              </View>
            </View>
          </View>

          <View style={styles.footerSpacing} />
        </Animated.View>
      </ScrollView>

      {/* 7️⃣ FOOTER ACTIONS */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)', '#000']} style={styles.footer}>
        <TouchableOpacity style={styles.footerBtnOutline} onPress={handleBookmark}>
          <Feather name="bookmark" size={20} color={isSaved ? colors.neon.cyan : colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtnPrimary} onPress={handleAskAI}>
          <LinearGradient colors={[colors.neon.cyan, '#4FACFE']} style={styles.footerBtnGradient}>
            <Feather name="message-circle" size={18} color={colors.background.primary} />
            <Text style={styles.footerBtnText}>Ask TrendPulse AI</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtnOutline} onPress={handleShare}>
          <Feather name="share-2" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bgGlow1: { position: 'absolute', top: -100, left: -100, width: 300, height: 300, backgroundColor: 'rgba(0,242,254,0.08)', borderRadius: 150 },
  bgGlow2: { position: 'absolute', top: '30%', right: -150, width: 300, height: 300, backgroundColor: 'rgba(138,43,226,0.06)', borderRadius: 150 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,8,68,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,8,68,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.neon.red, marginRight: 6 },
  liveText: { color: colors.neon.red, fontSize: typography.size.xs - 1, fontWeight: typography.weight.bold, letterSpacing: 1 },
  scrollArea: { flex: 1, paddingHorizontal: spacing.screenPadding },
  heroCard: { borderRadius: spacing.buttonRadius, padding: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 25, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: 0, right: 0, width: 150, height: 150, backgroundColor: 'rgba(0,242,254,0.1)', borderRadius: 75, transform: [{ scale: 2 }] },
  heroLabel: { color: colors.text.tertiary, fontSize: typography.size.xs, fontWeight: typography.weight.semiBold, letterSpacing: 1.5, marginBottom: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  heroScore: { color: colors.text.primary, fontSize: typography.size.xxl + 10, fontWeight: typography.weight.black, letterSpacing: -1, lineHeight: 45 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginLeft: 15, marginBottom: 5 },
  growthBadgeText: { fontSize: typography.size.sm + 1, fontWeight: typography.weight.bold, marginLeft: 4 },
  heroMetrics: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15 },
  miniMetric: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  miniMetricText: { color: colors.text.secondary, fontSize: typography.size.sm, marginLeft: 6, fontWeight: typography.weight.medium },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.bold, letterSpacing: 0.5 },
  timeFilters: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 4 },
  timeFilterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  timeFilterActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  timeFilterText: { color: colors.text.tertiary, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  timeFilterTextActive: { color: colors.text.primary },
  chartWrapper: { borderRadius: spacing.cardRadius, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  chartContainer: { height: 180, flexDirection: 'row' },
  chartYAxis: { justifyContent: 'space-between', paddingRight: 15, paddingVertical: 10 },
  chartYAxisText: { color: colors.text.tertiary, fontSize: typography.size.xs - 1, fontWeight: typography.weight.semiBold },
  chartBarsArea: { flex: 1, position: 'relative' },
  gridLines: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingVertical: 15 },
  gridLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  chartBarsContainer: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingTop: 10 },
  chartBarWrapper: { alignItems: 'center', width: 30 },
  chartBarFill: { width: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' },
  chartBarDot: { position: 'absolute', top: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text.primary, opacity: 0.8 },
  chartXAxisText: { color: colors.text.tertiary, fontSize: typography.size.xs - 2, marginTop: 10, fontWeight: typography.weight.semiBold },
  noDataText: { color: colors.text.tertiary, fontSize: typography.size.sm, marginTop: 50, textAlign: 'center' },
  aiInsightsCard: { borderRadius: spacing.cardRadius, padding: 20, borderWidth: 1, borderColor: 'rgba(138,43,226,0.3)' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  aiIconBg: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  aiTitle: { color: colors.text.primary, fontSize: typography.size.base + 1, fontWeight: typography.weight.bold },
  aiText: { color: colors.text.secondary, fontSize: typography.size.sm + 1, lineHeight: 22 },
  sourceGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  sourceCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: spacing.cardRadius, padding: 15, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sourceVal: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.bold, marginTop: 8 },
  sourceName: { color: colors.text.tertiary, fontSize: typography.size.xs, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  reachCard: { borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  regionRow: { marginBottom: 15 },
  regionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  regionName: { color: '#E2E8F0', fontSize: typography.size.sm + 1, fontWeight: typography.weight.semiBold },
  regionPercentage: { color: colors.neon.cyan, fontSize: typography.size.sm + 1, fontWeight: typography.weight.bold },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.neon.cyan, borderRadius: 3 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.05)', borderRadius: spacing.cardRadius, padding: 15, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' },
  alertIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  alertInfo: { flex: 1 },
  alertText: { color: colors.text.primary, fontSize: typography.size.sm + 1, fontWeight: typography.weight.semiBold },
  alertTime: { color: colors.text.tertiary, fontSize: typography.size.sm, marginTop: 4 },
  footerSpacing: { height: 100 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.screenPadding, paddingBottom: 20 },
  footerBtnOutline: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginHorizontal: 10 },
  footerBtnPrimary: { flex: 1, height: 50, borderRadius: 25, overflow: 'hidden' },
  footerBtnGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerBtnText: { color: colors.background.primary, fontSize: typography.size.base + 1, fontWeight: typography.weight.bold, marginLeft: 8 },
});
