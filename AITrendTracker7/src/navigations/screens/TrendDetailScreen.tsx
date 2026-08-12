import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Share,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../../navigation/routes';
import { RootStackScreenProps } from '../../navigation/types';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';
import { useBookmarkTrendMutation, useGetSavedTrendsQuery, useGetTrendByIdQuery } from '../../store/slices/trendsApi';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/layout';

const { width } = Dimensions.get('window');

type Props = RootStackScreenProps<typeof ROUTES.TREND_DETAIL>;

export default function TrendDetailScreen({ route, navigation }: Props) {
  const passedItem = (route.params?.item || {}) as any;
  const passedId = passedItem.trendId || passedItem._id || passedItem.id || '0';

  const { data: fetchedTrend, isLoading: isTrendLoading } = useGetTrendByIdQuery(passedId, {
    skip: passedId === '0',
  });

  const item = {
    ...passedItem,
    ...(fetchedTrend || {}),
    id: passedId,
    trendId: passedId,
    title: fetchedTrend?.title || passedItem.title || 'The Rise of AI Agents in Daily Life',
    category: fetchedTrend?.category || passedItem.category || 'AI',
    time: fetchedTrend?.time || passedItem.time || '2 hours ago',
    readTime: fetchedTrend?.readTime || passedItem.readTime || '5 min read',
    author: fetchedTrend?.source || passedItem.author || 'TrendPulse AI',
    growth: fetchedTrend?.growth || passedItem.growth || '+120%',
    content: fetchedTrend?.aiSummary || passedItem.content ||
      'Artificial Intelligence is no longer just a backend technology. It is actively becoming a proactive agent in our daily lives. Recent developments show an 80% increase in autonomous AI agents that can book flights, manage calendars, and draft emails without explicit prompts.\n\nExperts predict that within the next two years, personal AI agents will be as ubiquitous as smartphones. This shift is driven by advancements in Large Language Models (LLMs) and context-aware computing.\n\nHowever, concerns about data privacy and over-reliance on AI remain. As these agents gain more access to our personal data, developers must ensure robust security protocols to prevent data breaches.',
    image: fetchedTrend?.image || passedItem.image ||
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
  };

  const [bookmarkTrend] = useBookmarkTrendMutation();
  const { data: savedResponse } = useGetSavedTrendsQuery();

  // Derive saved state directly from cached RTK list
  const saved = (savedResponse?.data ?? []).some(
    (s: any) => (s.trendId || s._id || s.id) === item.id
  );

  const toggleSave = async () => {
    try {
      await bookmarkTrend(item.id).unwrap();
    } catch (e) {
      console.error('Bookmark error:', e);
    }
  };

  if (passedId !== '0' && isTrendLoading && !passedItem.content) {
    return (
      <Screen scrollable={false} safeAreaEdges={['top', 'bottom']}>
        <Header title="" showBack={true} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
          <ActivityIndicator size="large" color={colors.neon.purple} />
        </View>
      </Screen>
    );
  }

  const handleShare = async () => {
    try {
      await Share.share({
        title: item.title,
        message: `📈 ${item.title}\n\nCategory: ${item.category} | ${item.readTime}\n\nRead more on TrendPulse AI`,
      });
    } catch {
      // user cancelled
    }
  };

  const rightHeaderComponent = (
    <View style={styles.headerRight}>
      <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={handleShare}>
        <Feather name="share-2" size={20} color={colors.text.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.headerBtn, { marginLeft: 10 }]} activeOpacity={0.8} onPress={toggleSave}>
        <Feather name="bookmark" size={20} color={saved ? colors.neon.purple : colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen scrollable={false} safeAreaEdges={['top', 'bottom']}>
      {/* ── HEADER ── */}
      <Header
        title=""
        showBack={true}
        onBack={() => navigation.goBack()}
        rightComponent={rightHeaderComponent}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HERO IMAGE ── */}
        <ImageBackground source={{ uri: item.image }} style={styles.heroImage}>
          <LinearGradient
            colors={['rgba(5,5,10,0)', 'rgba(5,5,10,0.5)', colors.background.primary]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </ImageBackground>

        {/* ── CONTENT ── */}
        <View style={styles.content}>
          {/* Badges */}
          <View style={styles.badges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <View style={styles.timeBadge}>
              <Feather name="clock" size={12} color={colors.text.secondary} />
              <Text style={styles.timeText}>{item.readTime}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{item.title}</Text>

          {/* Author */}
          <View style={styles.authorRow}>
            <LinearGradient colors={[colors.neon.purple, colors.neon.blue]} style={styles.avatar}>
              <Feather name="cpu" size={16} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.authorName}>{item.author}</Text>
              <Text style={styles.authorTime}>{item.time}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Body */}
          <Text style={styles.body}>{item.content}</Text>

          {/* ── AI METRICS STRIP ── */}
          <LinearGradient
            colors={['rgba(106,37,244,0.08)', 'rgba(0,198,255,0.05)']}
            style={styles.metricsStrip}
          >
            <Text style={styles.metricsLabel}>AI INTELLIGENCE</Text>
            <View style={styles.metricsRow}>
              {/* Growth */}
              <View style={styles.metricChip}>
                <Feather name="trending-up" size={13} color={colors.neon.green} />
                <Text style={[styles.metricValue, { color: colors.neon.green }]}>{item.growth}</Text>
                <Text style={styles.metricKey}>Growth</Text>
              </View>

              {/* Sentiment */}
              <View style={styles.metricChip}>
                <Feather name="activity" size={13} color={colors.neon.cyan} />
                <Text style={[styles.metricValue, { color: colors.neon.cyan }]}>
                  {item.sentiment || 'Positive'}
                </Text>
                <Text style={styles.metricKey}>Sentiment</Text>
              </View>

              {/* Confidence */}
              <View style={styles.metricChip}>
                <Feather name="cpu" size={13} color="#a855f7" />
                <Text style={[styles.metricValue, { color: '#a855f7' }]}>
                  {typeof item.aiConfidence === 'number' ? `${item.aiConfidence}%` : '85%'}
                </Text>
                <Text style={styles.metricKey}>AI Conf.</Text>
              </View>
            </View>

            {/* Target Audience */}
            {item.targetAudience ? (
              <View style={styles.audienceRow}>
                <Feather name="users" size={12} color={colors.text.tertiary} style={{ marginRight: 6 }} />
                <Text style={styles.audienceText}>{item.targetAudience}</Text>
              </View>
            ) : null}

            {/* Score Breakdown (P2) */}
            <View style={styles.scoreBreakdownContainer}>
              <View style={styles.scoreRow}>
                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreVal}>{item.viralScore || item.trendScore || 75}%</Text>
                  <Text style={styles.scoreKey}>Viral Index</Text>
                </View>
                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreVal}>{item.trendScore || 75}%</Text>
                  <Text style={styles.scoreKey}>Composite</Text>
                </View>
                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreVal}>{(item.engagementScore || 15)}k</Text>
                  <Text style={styles.scoreKey}>Engagement</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Visit Original Source Button (P0) */}
          {item.sourceUrl ? (
            <TouchableOpacity
              style={styles.sourceBtn}
              activeOpacity={0.85}
              onPress={() => {
                Linking.openURL(item.sourceUrl).catch(err => console.error("Failed to open source URL:", err));
              }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                style={styles.sourceGradient}
              >
                <Feather name="external-link" size={18} color={colors.neon.cyan} style={{ marginRight: 10 }} />
                <Text style={styles.sourceText}>Visit Original Source</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          {/* AI Analysis Button */}
          <TouchableOpacity
            style={styles.analyzeBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(ROUTES.TREND_ANALYSIS, { item })}
          >
            <LinearGradient
              colors={[colors.neon.purple, colors.neon.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.analyzeGradient}
            >
              <Feather name="zap" size={20} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.analyzeText}>View AI Analysis</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: colors.overlay.light,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroImage: {
    width: width,
    height: layout.window.height * 0.35,
  },
  content: {
    paddingHorizontal: layout.SCREEN_HORIZONTAL_PADDING,
    paddingTop: 20,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: 'rgba(106,37,244,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.3)',
    marginRight: 12,
  },
  categoryText: {
    color: colors.neon.purple,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: colors.text.secondary,
    fontSize: 13,
    marginLeft: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    lineHeight: 38,
    marginBottom: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  authorName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  authorTime: {
    color: colors.text.tertiary,
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: 24,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 28,
    fontWeight: '400',
    marginBottom: 30,
  },
  analyzeBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: colors.neon.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  analyzeGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  // AI Metrics Strip
  metricsStrip: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.2)',
  },
  metricsLabel: {
    color: colors.text.tertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  metricKey: {
    color: colors.text.tertiary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  audienceText: {
    color: colors.text.secondary,
    fontSize: 12,
    flex: 1,
  },
  scoreBreakdownContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
  },
  scoreVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  scoreKey: {
    color: colors.text.tertiary,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sourceBtn: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    marginBottom: 16,
  },
  sourceGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceText: {
    color: colors.neon.cyan,
    fontSize: 15,
    fontWeight: '800',
  },
});

