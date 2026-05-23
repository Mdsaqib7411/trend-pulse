import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Feather from "react-native-vector-icons/Feather";
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { Screen } from "../../components/common/Screen";
import { ROUTES } from "../../navigation/routes";
import { RootStackScreenProps } from "../../navigation/types";
import { colors } from "../../theme/colors";
import { gradients } from "../../theme/gradients";

const { width } = Dimensions.get("window");

export default function SplashScreen({ navigation }: RootStackScreenProps<typeof ROUTES.SPLASH>) {
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Track whether the progress bar finished and Firebase resolved —
    // navigation fires only when BOTH are true.
    let animDone = false;
    let resolvedRoute: typeof ROUTES.MAIN_TABS | typeof ROUTES.LOGIN | null = null;

    const tryNavigate = () => {
      if (animDone && resolvedRoute) {
        if (resolvedRoute === ROUTES.MAIN_TABS) {
          navigation.replace(ROUTES.MAIN_TABS, undefined as any);
        } else {
          navigation.replace(ROUTES.LOGIN);
        }
      }
    };

    // Wait for Firebase to confirm auth state (fixes cold-boot race condition
    // where currentUser was null even for already-authenticated users).
    const unsubAuth = onAuthStateChanged(getAuth(), (user) => {
      resolvedRoute = user ? ROUTES.MAIN_TABS : ROUTES.LOGIN;
      tryNavigate();
      unsubAuth(); // one-shot
    });

    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 2500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        animDone = true;
        tryNavigate();
      }
    });

    return () => unsubAuth();
  }, [navigation]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <Screen scrollable={false} safeAreaEdges={[]}>
      <LinearGradient
        colors={['#010103', '#030307', colors.background.primary]}
        style={styles.container}
      >
        {/* Background glowing elements */}
        <View style={styles.glowCircle1} />
        <View style={styles.glowCircle2} />

        <Animated.View style={[styles.center, { opacity: fadeAnim }]}>
          <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={["rgba(106,37,244,0.4)", "rgba(0,198,255,0.1)"]}
              style={styles.logoCircle}
            >
              <LinearGradient
                colors={["#6A25F4", "#00c6ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.innerLogoCircle}
              >
                <Feather name="activity" size={50} color="#fff" />
              </LinearGradient>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>
            Trend<Text style={styles.neonBlue}>Pulse</Text>
          </Text>
          <Text style={styles.subtitle}>
            Discover What The World Is Talking About
          </Text>
        </Animated.View>

        <Animated.View style={[styles.bottom, { opacity: fadeAnim }]}>
          <View style={styles.glassCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.analysis}>ANALYZING REAL-TIME DATA</Text>
            </View>

            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressFillContainer, { width: progressWidth }]}>
                <LinearGradient
                  colors={["#6A25F4", "#00c6ff"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressFill}
                />
              </Animated.View>
            </View>

            <View style={styles.engineBox}>
              <FeatherIcon />
              <Text style={styles.engineText}>
                Powered by Trend Engine 4.0
              </Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>
    </Screen>
  );
}

// A simple local component for the feather icon so we don't import the whole library if not needed, 
// actually let's just use Text for the sparkle to keep it lightweight on splash
const FeatherIcon = () => <Text style={{ fontSize: 14, marginRight: 6 }}>✨</Text>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 30,
  },
  glowCircle1: {
    position: "absolute",
    top: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(106,37,244,0.06)",
    transform: [{ scale: 1.5 }],
  },
  glowCircle2: {
    position: "absolute",
    bottom: -50,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(0,198,255,0.04)",
    transform: [{ scale: 1.5 }],
  },
  center: {
    alignItems: "center",
    marginTop: 160,
    zIndex: 10,
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(0,198,255,0.3)",
  },
  innerLogoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#00c6ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: 1,
  },
  neonBlue: {
    color: "#00c6ff",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  bottom: {
    marginBottom: 20,
    zIndex: 10,
  },
  glassCard: {
    backgroundColor: "rgba(16, 24, 38, 0.5)",
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  analysis: {
    color: "#cbd5e1",
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFillContainer: {
    height: "100%",
    borderRadius: 3,
  },
  progressFill: {
    flex: 1,
    borderRadius: 3,
  },
  engineBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  engineText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
});
