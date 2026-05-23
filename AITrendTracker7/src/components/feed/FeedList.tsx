import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { LinearTransition } from 'react-native-reanimated';
import TrendCard from './TrendCard';
import EmergingCard from './EmergingCard';
import { GestureSwipeWrapper } from './GestureSwipeWrapper';
import { Trend, selectLiveTrendById } from '../../store/slices/trendsSlice';
import { useAppSelector } from '../../store/hooks';
import { PredictiveSkeleton } from '../ui/PredictiveSkeletons';

interface FeedListProps {
  data: (string | Trend)[]; // Supports both normalized IDs and direct Trend objects
  onRefresh?: () => void;
  refreshing?: boolean;
  onTrendPress: (item: Trend) => void;
  isHorizontal?: boolean;
  type?: 'featured' | 'emerging' | 'standard';
  isLoading?: boolean;
}

/**
 * Normalized Card Wrapper with Shallow Equality Check
 */
const ConnectedCard = React.memo(({ 
  itemId, 
  itemObj, 
  type, 
  index, 
  onPress,
  isHorizontal 
}: { 
  itemId?: string, 
  itemObj?: Trend, 
  type: string, 
  index: number, 
  onPress: (item: Trend) => void,
  isHorizontal: boolean
}) => {
  // If we receive an ID, select from normalized store. Otherwise use object directly.
  const trendFromStore = useAppSelector(state => itemId ? selectLiveTrendById(state, itemId) : undefined);
  const trend = trendFromStore || itemObj;

  if (!trend) return null;

  const content = type === 'emerging' 
    ? <EmergingCard item={trend} index={index} onPress={onPress} />
    : <TrendCard item={trend} onPress={onPress} />;

  return (
    <View style={isHorizontal ? { width: 295 } : { width: '100%' }}>
      {isHorizontal ? (
        content
      ) : (
        <GestureSwipeWrapper trendId={trend.trendId}>
          {content}
        </GestureSwipeWrapper>
      )}
    </View>
  );
});

const FeedList = ({ 
  data, 
  onRefresh, 
  refreshing = false, 
  onTrendPress, 
  isHorizontal = false, 
  type = 'standard',
  isLoading = false
}: FeedListProps) => {

  const renderItem = useCallback(({ item, index }: { item: string | Trend; index: number }) => {
    const isId = typeof item === 'string';
    return (
      <ConnectedCard 
        itemId={isId ? item : undefined} 
        itemObj={!isId ? item : undefined}
        type={type} 
        index={index} 
        onPress={onTrendPress}
        isHorizontal={isHorizontal}
      />
    );
  }, [onTrendPress, type, isHorizontal]);

  const keyExtractor = useCallback((item: string | Trend) => {
    return typeof item === 'string' ? item : item.trendId;
  }, []);

  // Pre-calculate to avoid FlashList layout thrashing during empty states
  const memoizedData = useMemo(() => data, [data]);

  if (isLoading) {
    // Return Skeletons 
    return (
      <View style={isHorizontal ? styles.horizontalContainer : styles.verticalContainer}>
         <View style={isHorizontal ? { flexDirection: 'row' } : {}}>
            <PredictiveSkeleton isVisible={true} type={isHorizontal ? 'featured' : 'card'} />
            <PredictiveSkeleton isVisible={true} type={isHorizontal ? 'featured' : 'card'} />
            {!isHorizontal && <PredictiveSkeleton isVisible={true} type="card" />}
         </View>
      </View>
    );
  }

  return (
    <View style={isHorizontal ? styles.horizontalContainer : styles.verticalContainer}>
      <FlashList
        data={memoizedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        {...{ estimatedItemSize: isHorizontal ? 280 : 150 } as any}
        horizontal={isHorizontal}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={isHorizontal ? styles.horizontalPadding : styles.verticalPadding}
        refreshControl={
          !isHorizontal && onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00F2FE" />
          ) : undefined
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  horizontalContainer: {
    height: 250, 
    width: '100%',
  },
  verticalContainer: {
    flex: 1,
    width: '100%',
    minHeight: 200,
  },
  horizontalPadding: {
    paddingLeft: 20,
    paddingRight: 5,
  },
  verticalPadding: {
    paddingBottom: 100,
    paddingTop: 10,
  },
});

export default React.memo(FeedList);
