import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';
import { getSavedItems, unsaveItem } from '../../utils/savedStorage';
import { ROUTES } from '../../navigation/routes';
import { MainTabScreenProps } from '../../navigation/types';
import { layout } from '../../theme/layout';

export default function SavedScreen({ navigation }: MainTabScreenProps<typeof ROUTES.SAVED>) {
  const [savedItems, setSavedItems] = useState<any[]>([]);

  // Refresh saved items every time screen is focused
  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [])
  );

  const loadSaved = async () => {
    const items = await getSavedItems();
    setSavedItems(items);
  };

  const handleUnsave = (id: string) => {
    Alert.alert(
      'Remove from Saved?',
      'This item will be removed from your saved list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await unsaveItem(id);
            setSavedItems(prev => prev.filter(i => i.id !== id));
          },
        },
      ]
    );
  };

  return (
    <Screen scrollable={false}>
      <Header
        title="Saved Items"
        showBack={false}
        rightComponent={
          <LinearGradient colors={['#6A25F4', '#00c6ff']} style={styles.iconRing}>
            <Feather name="bookmark" size={20} color="#fff" />
          </LinearGradient>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          {savedItems.length > 0 ? (
            savedItems.map(item => {
              const anyItem = item as any;
              const itemId = anyItem.trendId || anyItem._id || anyItem.id;
              return (
                <TouchableOpacity
                  key={itemId}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate(ROUTES.TREND_DETAIL, { item })}
                >
                  <LinearGradient
                    colors={['rgba(30,27,46,0.8)', 'rgba(106,37,244,0.05)']}
                    style={styles.savedCard}
                  >
                    {/* Card Top Row */}
                    <View style={styles.cardHeader}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                      </View>
                      <TouchableOpacity
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleUnsave(itemId)}
                      >
                        <Feather name="trash-2" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Title */}
                    <Text style={styles.itemTitle}>{item.title}</Text>

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                      <View style={styles.timeWrapper}>
                        <Feather name="clock" size={13} color="#64748b" style={{ marginRight: 5 }} />
                        <Text style={styles.timeText}>{item.time}</Text>
                      </View>
                      <View style={styles.readBadge}>
                        <Feather name="book-open" size={12} color="#a855f7" style={{ marginRight: 4 }} />
                        <Text style={styles.readText}>{item.readTime}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          ) : (
            /* Empty State */
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Feather name="bookmark" size={40} color="#a855f7" />
              </View>
              <Text style={styles.emptyTitle}>Nothing Saved Yet</Text>
              <Text style={styles.emptySubtitle}>
                Bookmark articles from the home feed — they'll appear here so you can read them later.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.HOME)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6A25F4', '#00c6ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.exploreBtn}
                >
                  <Text style={styles.exploreBtnText}>Browse Trends</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: layout.BOTTOM_TAB_OVERLAP_PADDING,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginTop: 10,
  },
  savedCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(168,85,247,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    color: '#d8b4fe',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  itemTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
    lineHeight: 26,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(106,37,244,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.2)',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 32,
    lineHeight: 24,
  },
  exploreBtn: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
  },
  exploreBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
