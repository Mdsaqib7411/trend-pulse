/**
 * TrendCard — Memoized trend card for FlashList layout recycling.
 * React.memo prevents redundant UI thread paint operations during rapid scrolls.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Dimensions
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');

interface TrendCardProps {
    item: any;
    onPress: (item: any) => void;
    index: number;
}

function TrendCardComponent({ item, onPress, index }: TrendCardProps) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress(item)}
            style={styles.card}
        >
            <Image
                source={{ uri: item.image }}
                style={styles.image}
            />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                style={styles.gradient}
            />
            <View style={styles.content}>
                {item.label && (
                    <View style={styles.labelBadge}>
                        <Text style={styles.labelText}>{item.label}</Text>
                    </View>
                )}
                <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                </Text>
                <View style={styles.meta}>
                    <View style={styles.metaLeft}>
                        <Feather name="clock" size={11} color="#999" />
                        <Text style={styles.metaText}>{item.time || '—'}</Text>
                    </View>
                    <View style={styles.metaLeft}>
                        <Feather name="trending-up" size={11} color="#A855F7" />
                        <Text style={[styles.metaText, { color: '#A855F7' }]}>
                            {item.growth || `Score: ${item.trendScore || 0}`}
                        </Text>
                    </View>
                </View>
                {item.matchReason && (
                    <Text style={styles.matchReason}>{item.matchReason}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

// React.memo with custom equality check on trendId to prevent re-renders
export const TrendCard = React.memo(TrendCardComponent, (prev, next) => {
    return prev.item.trendId === next.item.trendId && prev.item.trendScore === next.item.trendScore;
});

const styles = StyleSheet.create({
    card: {
        width: width - 32,
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        marginHorizontal: 16,
        backgroundColor: '#1E1B2E',
    },
    image: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70%',
    },
    content: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 14,
    },
    labelBadge: {
        backgroundColor: 'rgba(168, 85, 247, 0.3)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    labelText: {
        color: '#D8B4FE',
        fontSize: 10,
        fontWeight: '700',
    },
    title: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 20,
        marginBottom: 6,
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        color: '#999',
        fontSize: 11,
    },
    matchReason: {
        color: '#9CA3AF',
        fontSize: 10,
        fontStyle: 'italic',
        marginTop: 4,
    },
});
