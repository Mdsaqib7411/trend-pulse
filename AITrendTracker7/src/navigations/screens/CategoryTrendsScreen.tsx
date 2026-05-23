import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import {
  useGetCategoryTrendsQuery,
  useGetSavedTrendsQuery,
  useBookmarkTrendMutation
} from '../../store/slices/trendsApi';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ROUTES } from '../../navigation/routes';
import { RootStackScreenProps } from '../../navigation/types';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';

const CATEGORIES = [
  'All', 
  'AI', 'Technology', 'Startups', 'Cybersecurity', 'Developer Ecosystem', 'Gadgets',
  'Entertainment', 'Cricket', 'Gaming', 'Finance', 'Politics', 'Movies', 'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'
];

type Props = RootStackScreenProps<typeof ROUTES.CATEGORY_TRENDS>;

export default function CategoryTrendsScreen({ route, navigation }: Props) {
  const initialCategory = route.params?.category || 'All';
  const [activeCategory, setActiveCategory] = useState(initialCategory);

  const { data: responseData, isLoading: loading } = useGetCategoryTrendsQuery(activeCategory);
  const { data: savedData } = useGetSavedTrendsQuery();
  const [bookmarkTrendMutation] = useBookmarkTrendMutation();

  const trends = responseData?.data || [];
  const savedIds = savedData?.data?.map((item: any) => item.trendId || item._id) || [];

  const toggleSave = async (item: any) => {
    try {
      const itemId = item.trendId || item.id;
      await bookmarkTrendMutation(itemId).unwrap();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Screen scrollable={false} safeAreaEdges={['top']}>
      <Header title="Categories" showBack={true} onBack={() => navigation.goBack()} />

      {/* CATEGORY PILLS */}
      <View style={styles.pillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {CATEGORIES.map((cat, index) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(cat)}
              >
                <LinearGradient
                  colors={isActive ? [colors.neon.purple, colors.neon.cyan] : [colors.overlay.light, colors.overlay.light]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.pill, isActive ? styles.pillActive : null]}
                >
                  <Text style={[styles.pillText, isActive ? styles.pillTextActive : null]}>{cat}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* TRENDS LIST */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading trends...</Text>
          </View>
        ) : trends.length > 0 ? (
          trends.map((item, index) => (
            <TouchableOpacity
              key={item.trendId || item.id || index}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(ROUTES.TREND_DETAIL, { item })}
            >
              <LinearGradient
                colors={["rgba(30,27,46,0.8)", "rgba(20,15,30,0.6)"]}
                style={styles.trendCard}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.cardImage}
                    defaultSource={{ uri: 'https://via.placeholder.com/90x90/1e1b2e/a855f7?text=T' }}
                    onError={() => { }}
                  />
                ) : (
                  <LinearGradient
                    colors={['rgba(106,37,244,0.3)', 'rgba(0,198,255,0.2)']}
                    style={[styles.cardImage, styles.cardFallbackImage]}
                  >
                    <Feather name="trending-up" size={32} color={colors.neon.purple} />
                  </LinearGradient>
                )}
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.categoryBadgeText}>{item.category}</Text>
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.growthBadge}>
                      <Feather name="trending-up" size={14} color={colors.neon.green} />
                      <Text style={styles.growthText}>{item.growth}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => toggleSave(item)}
                    >
                      <Feather
                        name="bookmark"
                        size={18}
                        color={savedIds.includes(item.trendId || item.id) ? colors.neon.purple : colors.text.secondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color="#475569" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No trends found in {activeCategory}.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillsContainer: {
    height: 50,
    marginBottom: spacing.screenPadding,
  },
  pillsScroll: {
    paddingHorizontal: spacing.screenPadding,
  },
  pill: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 10,
    borderRadius: spacing.buttonRadius,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: {
    borderColor: 'transparent',
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.semiBold,
  },
  pillTextActive: {
    color: colors.text.primary,
  },
  listContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 100,
  },
  trendCard: {
    flexDirection: 'row',
    borderRadius: spacing.cardRadius,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: spacing.cardRadius,
    backgroundColor: colors.background.tertiary,
  },
  cardFallbackImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.lg,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadgeText: {
    color: colors.neon.purple,
    fontSize: typography.size.sm - 1,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  timeText: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm - 1,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.size.base + 2,
    fontWeight: typography.weight.bold,
    lineHeight: 24,
    marginVertical: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: spacing.badgeRadius,
    paddingVertical: spacing.xs,
    borderRadius: spacing.badgeRadius,
  },
  growthText: {
    color: colors.neon.green,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    marginLeft: 4,
  },
  saveBtn: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: typography.size.base + 1,
  },
  emptyIcon: {
    marginBottom: spacing.lg,
  },
});
