import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';
import { useAppDispatch } from '../../store/hooks';
import { setUnreadCount } from '../../store/slices/notificationsSlice';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useClearAllNotificationsMutation,
  useMarkSingleNotificationReadMutation,
  Notification as DBNotification,
} from '../../store/slices/notificationApi';

export type AppNotification = DBNotification;
import { ROUTES } from '../../navigation/routes';
import { RootStackScreenProps } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';

const getIconData = (type: string) => {
  switch (type) {
    case 'hot_trend':
      return { name: 'trending-up', gradientColors: ["rgba(239,68,68,0.2)", "rgba(239,68,68,0.05)"], iconColor: colors.neon.red };
    case 'multi_source':
      return { name: 'radio', gradientColors: ["rgba(168,85,247,0.2)", "rgba(168,85,247,0.05)"], iconColor: colors.neon.purple };
    case 'viral_spike':
      return { name: 'zap', gradientColors: ["rgba(0,242,254,0.2)", "rgba(0,242,254,0.05)"], iconColor: colors.neon.cyan };
    case 'system':
      return { name: 'file-text', gradientColors: ["rgba(251,191,36,0.2)", "rgba(251,191,36,0.05)"], iconColor: '#fbbf24' };
    default:
      return { name: 'bell', gradientColors: ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"], iconColor: colors.text.primary };
  }
};

const getTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

export default function NotificationsScreen({ navigation }: RootStackScreenProps<typeof ROUTES.NOTIFICATIONS>) {
  const flatListRef = React.useRef<FlatList>(null);
  useScrollToTop(flatListRef);

  const dispatch = useAppDispatch();

  const { data: notificationsData, isFetching: refreshing, refetch } = useGetNotificationsQuery();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [clearAll] = useClearAllNotificationsMutation();
  const [markSingleRead] = useMarkSingleNotificationReadMutation();

  const notifications = notificationsData?.data ?? [];
  const unreadCount = notificationsData?.unreadCount ?? notifications.filter(n => !n.read).length;

  useEffect(() => {
    dispatch(setUnreadCount(unreadCount));
  }, [unreadCount, dispatch]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllRead().unwrap();
      dispatch(setUnreadCount(0));
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  }, [markAllRead, dispatch]);

  const handleClearAllNotifications = useCallback(async () => {
    try {
      await clearAll().unwrap();
      dispatch(setUnreadCount(0));
    } catch (err) {
      console.error('Clear all notifications error:', err);
    }
  }, [clearAll, dispatch]);

  const handleNotificationPress = useCallback(async (item: AppNotification) => {
    if (!item.read) {
      try {
        await markSingleRead(item._id).unwrap();
      } catch (err) {
        console.error('Mark single read error:', err);
      }
    }

    if (item.trendId) {
      navigation.navigate(ROUTES.TREND_DETAIL, {
        item: { trendId: item.trendId, id: item.trendId, title: item.title } as any
      });
    }
  }, [navigation, markSingleRead]);

  const renderNotificationItem = useCallback(({ item }: { item: AppNotification }) => {
    const { name, gradientColors, iconColor } = getIconData(item.type);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleNotificationPress(item)}
      >
        <LinearGradient
          colors={item.read
            ? ["rgba(20,15,30,0.4)", "rgba(20,15,30,0.2)"]
            : ["rgba(0,242,254,0.08)", "rgba(106,37,244,0.06)"]
          }
          style={[styles.notificationCard, !item.read && styles.unreadBorder]}
        >
          <View style={styles.iconContainer}>
            <LinearGradient colors={gradientColors as any} style={styles.iconBg}>
              <Feather name={name} size={18} color={iconColor} />
            </LinearGradient>
            {!item.read && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.time}>{getTimeAgo(item.createdAt)}</Text>
            </View>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [handleNotificationPress]);

  const keyExtractor = useCallback((item: AppNotification) => item._id, []);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <LinearGradient colors={["rgba(0,242,254,0.1)", "rgba(0,242,254,0.02)"]} style={styles.emptyIconBg}>
        <Feather name="bell-off" size={40} color={colors.text.tertiary} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>No Alerts Yet</Text>
      <Text style={styles.emptySubtitle}>When trends start trending, you'll be the first to know!</Text>
    </View>
  ), []);

  return (
    <Screen scrollable={false}>
      <View style={styles.ambientGlow} />

      <Header
        title="Notifications"
        rightComponent={
          notifications.length > 0 ? (
            <View style={styles.headerRight}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn} activeOpacity={0.8}>
                  <Feather name="check-circle" size={20} color={colors.neon.cyan} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClearAllNotifications} style={styles.markReadBtn} activeOpacity={0.8}>
                <Feather name="trash-2" size={20} color={colors.neon.red} />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      <FlatList
        ref={flatListRef}
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.neon.cyan} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 242, 254, 0.04)',
    transform: [{ scale: 2 }],
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 80,
  },
  emptyIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.screenPadding,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    marginBottom: 10,
  },
  emptySubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  markReadBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: layout.BOTTOM_TAB_OVERLAP_PADDING + 40,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderRadius: spacing.cardRadius,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  unreadBorder: {
    borderColor: 'rgba(0, 242, 254, 0.2)',
  },
  iconContainer: {
    position: 'relative',
    marginRight: spacing.lg,
  },
  iconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.neon.cyan,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    flex: 1,
  },
  titleUnread: {
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
  },
  time: {
    color: '#475569',
    fontSize: typography.size.xs,
    marginLeft: 8,
  },
  message: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
  }
});
