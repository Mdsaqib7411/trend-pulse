import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import MapView from 'react-native-maps';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import { colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

// SVG Animated Path
const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface GeoNode {
  id: string;
  latitude: number;
  longitude: number;
  intensity: number;
}

interface TrendPropagationOverlayProps {
  mapRef: React.RefObject<MapView>;
  activeNodes: GeoNode[];
  isMapIdle: boolean; // Driven by onRegionChangeComplete in parent
  isVisible?: boolean; // Driven by Viewability callbacks
}

type Point = { x: number; y: number };

/**
 * LRU Coordinate Cache to prevent infinite memory bloat
 */
class CoordinateCache {
  private cache = new Map<string, Point>();
  private readonly MAX_SIZE = 150;

  get(key: string): Point | undefined {
    if (!this.cache.has(key)) return undefined;
    // Refresh LRU
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: string, value: Point) {
    if (this.cache.size >= this.MAX_SIZE) {
      // Evict oldest (Map iterates in insertion order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

const coordCache = new CoordinateCache();

export const TrendPropagationOverlay = React.memo(({
  mapRef,
  activeNodes,
  isMapIdle,
  isVisible = true,
}: TrendPropagationOverlayProps) => {
  const [projectedNodes, setProjectedNodes] = useState<(GeoNode & Point)[]>([]);

  // 1. Synchronize Coordinate Cache ONLY when map is idle (onRegionChangeComplete)
  useEffect(() => {
    if (!isMapIdle || !mapRef.current || !isVisible) return;

    let isActive = true;

    const projectCoordinates = async () => {
      // Clear cache when map moves to ensure fresh layout projections
      coordCache.clear();
      
      const newProjections: (GeoNode & Point)[] = [];
      
      for (const node of activeNodes) {
        if (!isActive) break;
        const cacheKey = `${node.latitude},${node.longitude}`;
        let point = coordCache.get(cacheKey);
        
        if (!point) {
          try {
            point = await mapRef.current?.pointForCoordinate({
              latitude: node.latitude,
              longitude: node.longitude,
            });
            if (point) {
              coordCache.set(cacheKey, point);
            }
          } catch (e) {
            console.warn('[PropagationOverlay] Projection error:', e);
          }
        }
        
        if (point) {
          newProjections.push({ ...node, x: point.x, y: point.y });
        }
      }

      if (isActive) {
        setProjectedNodes(newProjections);
      }
    };

    projectCoordinates();

    return () => {
      isActive = false;
      // Memory Optimization: Clear cache on unmount or freeze
      if (!isVisible) {
         coordCache.clear();
      }
    };
  }, [activeNodes, isMapIdle, mapRef, isVisible]);

  // 2. SVG Path Pooling Engine (Fixed Max Connections to avoid DOM recreation)
  const paths = useMemo(() => {
    if (projectedNodes.length < 2) return [];
    
    const lines = [];
    // Just drawing sequential lines for demo. In real app, graph algorithm defines edges.
    for (let i = 0; i < projectedNodes.length - 1; i++) {
      const p1 = projectedNodes[i];
      const p2 = projectedNodes[i + 1];
      
      // Basic bezier curve for smooth arc over the map
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2 - 50; // Curve arc height

      lines.push(
        <Path
          key={`edge-${p1.id}-${p2.id}`}
          d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
          stroke={colors.neon.cyan}
          strokeWidth={2}
          strokeDasharray="5,5"
          fill="none"
          opacity={0.6}
        />
      );
    }
    return lines;
  }, [projectedNodes]);

  if (!isVisible || projectedNodes.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityLabel="Geographic trend propagation map overlay displaying regional movement vectors.">
      <Svg style={StyleSheet.absoluteFill}>
        {/* Render Pooled Paths */}
        {paths}
        
        {/* Render Anchor Dots */}
        {projectedNodes.map((node) => (
          <Circle
            key={`node-${node.id}`}
            cx={node.x}
            cy={node.y}
            r={node.intensity > 80 ? 8 : 4}
            fill={colors.neon.purple}
            opacity={0.8}
          />
        ))}
      </Svg>
    </View>
  );
});
