import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useAppSelector } from '../../store/hooks';
import { selectHeatmapNodes } from '../../store/selectors/geoSelectors';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ROUTES } from '../../navigation/routes';
import { RootStackScreenProps } from '../../navigation/types';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';

const INITIAL_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 15,
  longitudeDelta: 15,
};

type Props = RootStackScreenProps<typeof ROUTES.GEO_HEATMAP>;

export default function GeoHeatmapScreen({ navigation }: Props) {
  const rawNodes = useAppSelector(selectHeatmapNodes);
  
  // 1. STREAM THROTTLING: 2500ms throttle for Redux stream
  const [throttledNodes, setThrottledNodes] = useState(rawNodes);
  const lastUpdateRef = useRef<number>(Date.now());
  
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 2500) {
      setThrottledNodes(rawNodes);
      lastUpdateRef.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledNodes(rawNodes);
        lastUpdateRef.current = Date.now();
      }, 2500 - (now - lastUpdateRef.current));
      return () => clearTimeout(timer);
    }
  }, [rawNodes]);

  // Map state for lazy rendering
  const [isMapIdle, setIsMapIdle] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region>(INITIAL_REGION);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setCurrentRegion(region);
    setIsMapIdle(true);
  }, []);

  const handleRegionChange = useCallback(() => {
    if (isMapIdle) setIsMapIdle(false);
  }, [isMapIdle]);

  // 2. MARKER CLUSTERING: Lightweight client-side distance clustering
  const clusters = useMemo(() => {
    // Only cluster if we are zoomed out (latitudeDelta > 5)
    if (currentRegion.latitudeDelta < 5) return throttledNodes;

    const clustered: any[] = [];
    const threshold = currentRegion.latitudeDelta / 10; // Dynamic threshold based on zoom

    for (const node of throttledNodes as any[]) {
      let merged = false;
      for (const cluster of clustered) {
        const dLat = Math.abs(cluster.latitude - node.latitude);
        const dLng = Math.abs(cluster.longitude - node.longitude);
        if (dLat < threshold && dLng < threshold) {
          // Merge node into cluster
          cluster.weight = (cluster.weight || 1) + (node.weight || 1);
          // Adjust center slightly towards new node
          cluster.latitude = (cluster.latitude + node.latitude) / 2;
          cluster.longitude = (cluster.longitude + node.longitude) / 2;
          cluster.isCluster = true;
          merged = true;
          break;
        }
      }
      if (!merged) {
        clustered.push({ ...node, isCluster: false });
      }
    }
    return clustered;
  }, [throttledNodes, currentRegion.latitudeDelta]);

  // Memoized Marker rendering
  const renderMarkers = useMemo(() => {
    return clusters.map((c, index) => (
      <Marker
        key={`marker-${index}-${c.latitude}`}
        coordinate={{ latitude: c.latitude, longitude: c.longitude }}
        tracksViewChanges={false} // Performance critical for static markers
      >
        <View style={[styles.markerBody, c.isCluster && styles.clusterBody]}>
          <Text style={styles.markerText}>{c.weight > 100 ? '🔥' : c.weight}</Text>
        </View>
      </Marker>
    ));
  }, [clusters]);

  const liveHeaderRight = (
    <View style={styles.liveIndicator}>
      <View style={styles.dot} />
      <Text style={styles.liveText}>SYNCING</Text>
    </View>
  );

  return (
    <Screen scrollable={false} safeAreaEdges={['top']}>
      {/* Standardized Absolute Header */}
      <View style={styles.headerContainer}>
        <Header
          title="Live Geo-Spikes"
          showBack={true}
          onBack={() => navigation.goBack()}
          rightComponent={liveHeaderRight}
        />
      </View>

      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        customMapStyle={mapStyleDark}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={true}
        showsCompass={false}
      >
        {/* 3. LAZY RENDERING: Only mount expensive Heatmap layer when map is strictly idle */}
        {isMapIdle && throttledNodes.length > 0 && (
          <Heatmap
            points={throttledNodes}
            radius={40}
            opacity={0.7}
            gradient={{
              colors: ['transparent', colors.neon.purple, colors.neon.pink, colors.neon.red],
              startPoints: [0.01, 0.25, 0.5, 1],
              colorMapSize: 256
            }}
          />
        )}
        
        {/* Render standard clustered markers at all times */}
        {renderMarkers}
      </MapView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(5, 5, 10, 0.6)',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 8, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 8, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neon.red,
    marginRight: 4,
  },
  liveText: {
    color: colors.neon.red,
    fontSize: typography.size.xs - 2,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  markerBody: {
    backgroundColor: colors.overlay.purpleGlow,
    borderColor: colors.neon.purple,
    borderWidth: 2,
    padding: spacing.xs,
    borderRadius: 20,
    minWidth: 28,
    alignItems: 'center',
  },
  clusterBody: {
    backgroundColor: 'rgba(255, 0, 122, 0.3)',
    borderColor: colors.neon.pink,
    padding: spacing.sm,
    minWidth: 36,
  },
  markerText: {
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.xs,
  }
});

const mapStyleDark = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#11101A"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#94A3B8"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#05050A"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#6A25F4"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#05050A"
      }
    ]
  }
];
