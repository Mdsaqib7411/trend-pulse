import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { Trend } from '../../store/slices/trendsSlice';

interface Props {
  item: Trend;
  index: number;
  onPress: (item: Trend) => void;
}

const EmergingCard = ({ item, index, onPress }: Props) => {
  return (
    <TouchableOpacity
      style={styles.fastItem}
      activeOpacity={0.8}
      onPress={() => onPress(item)}
    >
      <Text style={styles.rankText}>{index + 1}</Text>

      {item.image && item.image.length > 5 ? (
        <Image source={{ uri: item.image }} style={styles.fastThumbnail} />
      ) : (
        <LinearGradient colors={['#1e1b2e', '#2a2440']} style={[styles.fastThumbnail, { justifyContent: 'center', alignItems: 'center' }]}>
          <Feather name="activity" size={24} color="#64748B" />
        </LinearGradient>
      )}

      <View style={styles.fastContent}>
        <Text style={styles.fastTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.fastFooter}>
          <Text style={styles.fastCategory}>{item.source}</Text>
          <View style={styles.dot} />
          <Text style={styles.fastTime}>{item.time || '2h ago'}</Text>
        </View>
      </View>

      <View style={styles.growthBadge}>
        <Feather name="arrow-up-right" size={12} color="#00F2FE" />
        <Text style={styles.fastGrowth}>{item.engagementScore || 15}k</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fastItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,15,30,0.6)",
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)"
  },
  rankText: {
    color: "#64748B",
    fontWeight: "800",
    fontSize: 16,
    width: 25,
  },
  fastThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#1e1b2e'
  },
  fastContent: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center'
  },
  fastTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 6
  },
  fastFooter: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  fastCategory: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: '500'
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
    marginHorizontal: 8
  },
  fastTime: {
    color: '#64748B',
    fontSize: 12
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 10
  },
  fastGrowth: {
    color: "#00F2FE",
    fontWeight: "800",
    fontSize: 13,
    marginLeft: 4
  }
});

export default React.memo(EmergingCard);
