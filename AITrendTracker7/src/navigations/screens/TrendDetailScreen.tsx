import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Share,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { getAuth } from '@react-native-firebase/auth';
import { BASE_URL } from '../../utils/config';
import { ROUTES } from '../../navigation/routes';
import { RootStackScreenProps } from '../../navigation/types';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/layout';

const { width } = Dimensions.get('window');

type Props = RootStackScreenProps<typeof ROUTES.TREND_DETAIL>;

export default function TrendDetailScreen({ route, navigation }: Props) {
  const passedItem = (route.params?.item || {}) as any;
  const item = {
    ...passedItem,
    id:       passedItem.trendId || passedItem._id || passedItem.id || '0',
    trendId:  passedItem.trendId || passedItem._id || passedItem.id || '0',
    title:    passedItem.title    || 'The Rise of AI Agents in Daily Life',
    category: passedItem.category || 'AI',
    time:     passedItem.time     || '2 hours ago',
    readTime: passedItem.readTime || '5 min read',
    author:   passedItem.author   || 'TrendPulse AI',
    growth:   passedItem.growth   || '+120%',
    content:  passedItem.content  ||
      'Artificial Intelligence is no longer just a backend technology. It is actively becoming a proactive agent in our daily lives. Recent developments show an 80% increase in autonomous AI agents that can book flights, manage calendars, and draft emails without explicit prompts.\n\nExperts predict that within the next two years, personal AI agents will be as ubiquitous as smartphones. This shift is driven by advancements in Large Language Models (LLMs) and context-aware computing.\n\nHowever, concerns about data privacy and over-reliance on AI remain. As these agents gain more access to our personal data, developers must ensure robust security protocols to prevent data breaches.',
    image:    passedItem.image    ||
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
  };

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Optionally fetch initial status if needed
  }, [item.id]);

  const toggleSave = async () => {
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch(`${BASE_URL}/api/trends/bookmark`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trendId: item.id })
      });
      const json = await res.json();
      if (json.success) setSaved(json.bookmarked);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: item.title,
        message: `📈 ${item.title}\n\nCategory: ${item.category} | ${item.readTime}\n\nRead more on TrendPulse AI`,
      });
    } catch (e) {
      // user cancelled
    }
  };

  const rightHeaderComponent = (
    <View style={styles.headerRight}>
      <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={handleShare}>
        <Feather name="share-2" size={20} color={colors.text.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.headerBtn, { marginLeft: 10 }]} activeOpacity={0.8} onPress={toggleSave}>
        <Feather name="bookmark" size={20} color={saved ? colors.neon.purple : colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen scrollable={false} safeAreaEdges={['top']}>
      {/* ── HEADER ── */}
      <Header
        title=""
        showBack={true}
        onBack={() => navigation.goBack()}
        rightComponent={rightHeaderComponent}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HERO IMAGE ── */}
        <ImageBackground source={{ uri: item.image }} style={styles.heroImage}>
          <LinearGradient
            colors={['rgba(5,5,10,0)', 'rgba(5,5,10,0.5)', colors.background.primary]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </ImageBackground>

        {/* ── CONTENT ── */}
        <View style={styles.content}>
          {/* Badges */}
          <View style={styles.badges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <View style={styles.timeBadge}>
              <Feather name="clock" size={12} color={colors.text.secondary} />
              <Text style={styles.timeText}>{item.readTime}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{item.title}</Text>

          {/* Author */}
          <View style={styles.authorRow}>
            <LinearGradient colors={[colors.neon.purple, colors.neon.blue]} style={styles.avatar}>
              <Feather name="cpu" size={16} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.authorName}>{item.author}</Text>
              <Text style={styles.authorTime}>{item.time}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Body */}
          <Text style={styles.body}>{item.content}</Text>

          {/* AI Analysis Button */}
          <TouchableOpacity
            style={styles.analyzeBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(ROUTES.TREND_ANALYSIS, { item })}
          >
            <LinearGradient
              colors={[colors.neon.purple, colors.neon.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.analyzeGradient}
            >
              <Feather name="zap" size={20} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.analyzeText}>View AI Analysis</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: colors.overlay.light,
  },
  scrollContent: {
    paddingBottom: layout.BOTTOM_TAB_OVERLAP_PADDING,
  },
  heroImage: {
    width: width,
    height: layout.window.height * 0.35,
  },
  content: {
    paddingHorizontal: layout.SCREEN_HORIZONTAL_PADDING,
    paddingTop: 20,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: 'rgba(106,37,244,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(106,37,244,0.3)',
    marginRight: 12,
  },
  categoryText: {
    color: colors.neon.purple,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: colors.text.secondary,
    fontSize: 13,
    marginLeft: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    lineHeight: 38,
    marginBottom: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  authorName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  authorTime: {
    color: colors.text.tertiary,
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: 24,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 28,
    fontWeight: '400',
    marginBottom: 30,
  },
  analyzeBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: colors.neon.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  analyzeGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
