import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[styles.skeleton, { width: width as any, height: height as any, borderRadius, opacity }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export const TrendCardSkeleton = () => (
  <View style={styles.trendCard}>
    <SkeletonLoader width={44} height={44} borderRadius={14} style={{ marginRight: 15 }} />
    <View style={styles.trendInfo}>
      <SkeletonLoader width={120} height={18} style={{ marginBottom: 6 }} />
      <SkeletonLoader width={180} height={14} />
    </View>
    <View style={styles.trendRight}>
      <SkeletonLoader width={40} height={20} borderRadius={8} style={{ marginBottom: 8 }} />
      <SkeletonLoader width={60} height={12} />
    </View>
  </View>
);

export const HomeCardSkeleton = () => (
  <View style={styles.homeCard}>
    <SkeletonLoader width="100%" height={140} borderRadius={20} />
    <View style={{ padding: 15 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <SkeletonLoader width={80} height={20} borderRadius={10} />
        <SkeletonLoader width={60} height={16} />
      </View>
      <SkeletonLoader width="90%" height={24} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="60%" height={24} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
        <SkeletonLoader width={50} height={24} borderRadius={8} />
        <SkeletonLoader width={24} height={24} borderRadius={12} />
      </View>
    </View>
  </View>
);

export const HomeSquareSkeleton = () => (
  <View style={styles.homeSquareCard}>
    <SkeletonLoader width={24} height={24} borderRadius={12} style={{ marginBottom: 15 }} />
    <SkeletonLoader width={80} height={16} style={{ marginBottom: 6 }} />
    <SkeletonLoader width={100} height={14} />
  </View>
);

export const NotificationSkeleton = () => (
  <View style={styles.notificationCard}>
    <SkeletonLoader width={46} height={46} borderRadius={23} style={{ marginRight: 16 }} />
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <SkeletonLoader width="60%" height={16} />
        <SkeletonLoader width={40} height={12} />
      </View>
      <SkeletonLoader width="90%" height={14} style={{ marginBottom: 4 }} />
      <SkeletonLoader width="70%" height={14} />
    </View>
  </View>
);

export const TrendGraphSkeleton = () => (
  <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
    <SkeletonLoader width="100%" height={180} borderRadius={24} style={{ marginBottom: 25 }} />
    
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
      <SkeletonLoader width={120} height={24} />
      <SkeletonLoader width={100} height={30} borderRadius={15} />
    </View>
    <SkeletonLoader width="100%" height={220} borderRadius={20} style={{ marginBottom: 30 }} />
    
    <SkeletonLoader width="100%" height={120} borderRadius={20} />
  </View>
);

import { Dimensions } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

export const TrendAnalysisSkeleton = () => (
  <View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
      <SkeletonLoader width={(Dimensions.get('window').width - 55) / 2} height={120} borderRadius={20} />
      <SkeletonLoader width={(Dimensions.get('window').width - 55) / 2} height={120} borderRadius={20} />
    </View>
    <SkeletonLoader width={150} height={24} style={{ marginBottom: 16 }} />
    <SkeletonLoader width="100%" height={200} borderRadius={16} style={{ marginBottom: 30 }} />
    <SkeletonLoader width={150} height={24} style={{ marginBottom: 16 }} />
    <SkeletonLoader width="100%" height={150} borderRadius={16} />
  </View>
);

export const AITypingSkeleton = () => (
  <View style={{ flexDirection: 'row', marginBottom: 20, alignItems: 'flex-end', paddingHorizontal: 20 }}>
    <LinearGradient colors={["#00F2FE", "#4FACFE"]} style={{ width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
      <Feather name="cpu" size={14} color="#05050A" />
    </LinearGradient>
    <View style={{ backgroundColor: 'rgba(30,27,46,0.8)', padding: 16, borderRadius: 20, borderBottomLeftRadius: 4, width: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      <SkeletonLoader width={70} height={12} borderRadius={6} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,27,46,0.6)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  trendInfo: {
    flex: 1,
  },
  trendRight: {
    alignItems: 'flex-end',
  },
  homeCard: {
    width: 280,
    marginRight: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(20,15,30,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 8,
  },
  homeSquareCard: {
    width: 150,
    marginRight: 15,
    borderRadius: 20,
    backgroundColor: 'rgba(30,27,46,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 20,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(20,15,30,0.4)',
  },
});
