import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { Screen } from '../../components/common/Screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSearchTrendsQuery } from '../../store/slices/trendsApi';
import { ROUTES } from '../../navigation/routes';
import { MainTabScreenProps } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';

const SUGGESTED_TOPICS = ['Machine Learning', 'Fintech', 'SpaceTech', 'SaaS', 'Robotics'];

export default function SearchScreen({ route, navigation }: MainTabScreenProps<typeof ROUTES.SEARCH>) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Deep-link query detection
  React.useEffect(() => {
    if (route.params?.query) {
      setQuery(route.params.query);
      setDebouncedQuery(route.params.query);
    }
  }, [route.params?.query]);

  // Handle local debounce
  React.useEffect(() => {
    if (query.trim().length === 0) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [query]);

  const { data: responseData, isFetching: loading } = useSearchTrendsQuery(debouncedQuery, {
    skip: debouncedQuery.trim().length === 0,
  });

  const results = responseData?.data || [];

  React.useEffect(() => {
    AsyncStorage.getItem('recentSearches').then(res => {
      if (res) setRecentSearches(JSON.parse(res));
      else setRecentSearches(['GPT-4', 'Midjourney Prompts', 'AI in Healthcare', 'Crypto Trends']);
    });
  }, []);

  const handleChipPress = (text: string) => {
    setQuery(text);
    setDebouncedQuery(text);
  };

  const handleClearRecent = async () => {
    await AsyncStorage.removeItem('recentSearches');
    setRecentSearches([]);
  };

  return (
    <Screen scrollable={false}>
      {/* SEARCH BAR */}
      <View style={[styles.searchBar, { marginHorizontal: spacing.screenPadding }]}>
        <Feather name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search trends, topics, categories..."
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Feather name="x" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          {query.trim().length === 0 ? (
            /* ── EMPTY STATE — show recent + suggested ── */
            <>
              {/* Recent Searches */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity onPress={handleClearRecent}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chips}>
                {recentSearches.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.chip}
                    activeOpacity={0.7}
                    onPress={() => handleChipPress(item)}
                  >
                    <Feather name="clock" size={14} color={colors.neon.purple} style={styles.chipIcon} />
                    <Text style={styles.chipText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Suggested Topics */}
              <Text style={styles.suggestedTitle}>
                Suggested Topics
              </Text>
              <View style={styles.chips}>
                {SUGGESTED_TOPICS.map((item, i) => (
                  <LinearGradient
                    key={i}
                    colors={['rgba(34,211,238,0.1)', 'rgba(34,211,238,0.05)']}
                    style={styles.suggestChip}
                  >
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleChipPress(item)}>
                      <Text style={styles.suggestChipText}>{item}</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ))}
              </View>
            </>
          ) : loading ? (
            /* ── LOADING ── */
            <Text style={styles.resultsCount}>Searching...</Text>
          ) : results.length > 0 ? (
            /* ── RESULTS LIST ── */
            <>
              <Text style={styles.resultsCount}>
                {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
              </Text>
              {results.map((item, index) => (
                <TouchableOpacity
                  key={item.trendId || index}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate(ROUTES.TREND_DETAIL, { item })}
                >
                  <LinearGradient
                    colors={['rgba(30,27,46,0.9)', 'rgba(106,37,244,0.08)']}
                    style={styles.resultCard}
                  >
                    <View style={styles.resultTop}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                      </View>
                      <View style={styles.growthBadge}>
                        <Feather name="trending-up" size={12} color={colors.neon.green} style={styles.growthIcon} />
                        <Text style={styles.growthText}>{item.growth}</Text>
                      </View>
                    </View>
                    <Text style={styles.resultTitle}>{item.title}</Text>
                    <View style={styles.resultMeta}>
                      <Feather name="clock" size={12} color={colors.text.tertiary} style={styles.metaIcon} />
                      <Text style={styles.metaText}>{item.time}</Text>
                      <Text style={styles.metaDot}> · </Text>
                      <Text style={styles.metaText}>{item.readTime}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            /* ── NO RESULTS ── */
            <View style={styles.noResults}>
              <Feather name="search" size={48} color="#334155" />
              <Text style={styles.noResultsTitle}>No results found</Text>
              <Text style={styles.noResultsText}>Try searching for AI, Blockchain, Healthcare, or Energy</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,27,46,0.6)',
    borderRadius: spacing.cardRadius,
    paddingHorizontal: 15,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.3)',
    height: 54,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base,
  },
  scrollContent: {
    paddingBottom: layout.BOTTOM_TAB_OVERLAP_PADDING,
    paddingHorizontal: spacing.screenPadding,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  clearText: {
    color: colors.neon.purple,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semiBold,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106,37,244,0.1)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: spacing.buttonRadius,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.2)',
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    color: '#d8b4fe',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  suggestedTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
    marginTop: 30,
    marginBottom: 15,
  },
  suggestChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: spacing.buttonRadius,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.2)',
  },
  suggestChipText: {
    color: colors.neon.cyan,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  resultsCount: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    marginBottom: spacing.lg,
    marginTop: 4,
  },
  resultCard: {
    padding: spacing.lg,
    borderRadius: spacing.cardRadius,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: colors.overlay.purpleGlow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: spacing.badgeRadius,
  },
  categoryText: {
    color: '#d8b4fe',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  growthIcon: {
    marginRight: 3,
  },
  growthText: {
    color: colors.neon.green,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  resultTitle: {
    color: colors.text.primary,
    fontSize: typography.size.base + 2,
    fontWeight: typography.weight.bold,
    lineHeight: 24,
    marginBottom: 10,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
  },
  metaDot: {
    color: '#334155',
  },
  noResults: {
    alignItems: 'center',
    marginTop: 80,
  },
  noResultsTitle: {
    color: '#475569',
    fontSize: typography.size.lg + 2,
    fontWeight: typography.weight.bold,
    marginTop: 20,
    marginBottom: 8,
  },
  noResultsText: {
    color: '#334155',
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
