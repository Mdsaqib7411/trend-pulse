import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { Trend } from '../../store/slices/trendsSlice';

interface Props {
  item: Trend;
  onPress: (item: Trend) => void;
}

const TrendCard = ({ item, onPress }: Props) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(item)}>
      <View style={styles.trendCard}>
        {item.image && item.image.length > 5 ? (
          <Image source={{ uri: item.image }} style={styles.trendImage} />
        ) : (
          <LinearGradient colors={['#1e1b2e', '#2a2440']} style={[styles.trendImage, { justifyContent: 'center', alignItems: 'center' }]}>
            <Feather name="hash" size={40} color="rgba(255,255,255,0.1)" />
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(10,5,20,0.6)', 'rgba(5,5,10,0.95)']}
          style={styles.trendOverlay}
        >
          <View style={styles.trendTag}>
            <Text style={styles.trendTagText}>#{item.category.replace(/\s+/g, '')}</Text>
          </View>
          <Text style={styles.trendCardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.trendFooter}>
            <Feather name="trending-up" color="#4ade80" size={14} />
            <Text style={styles.growthText}>{item.growth || '+85%'} velocity</Text>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  trendCard: {
    width: 280,
    height: 200,
    borderRadius: 20,
    marginRight: 15,
    overflow: 'hidden',
    backgroundColor: '#1e1b2e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  trendImage: {
    width: '100%',
    height: '100%',
    position: 'absolute'
  },
  trendOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  trendTag: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)'
  },
  trendTagText: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  trendCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 10
  },
  trendFooter: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  growthText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6
  }
});

// React.memo to prevent unnecessary re-renders in FlashList
export default React.memo(TrendCard);
