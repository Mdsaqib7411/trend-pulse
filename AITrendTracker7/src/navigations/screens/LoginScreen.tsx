import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Feather from "react-native-vector-icons/Feather";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, sendPasswordResetEmail } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { Config } from "../../config/env";
import { ROUTES } from "../../navigation/routes";
import { RootStackScreenProps } from "../../navigation/types";
import { Screen } from "../../components/common/Screen";

const { width, height } = Dimensions.get('window');

type Props = RootStackScreenProps<typeof ROUTES.LOGIN>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert("Error", "Please enter your email address first.");
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(getAuth(), resetEmail.trim());
      setForgotModalVisible(false);
      setResetEmail("");
      Alert.alert("Success", "Password reset email sent! Check your inbox.");
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'auth/invalid-email') {
        msg = "The email address is badly formatted.";
      } else if (error.code === 'auth/user-not-found') {
        msg = "There is no user record corresponding to this identifier.";
      }
      Alert.alert("Error", msg);
    } finally {
      setSendingReset(false);
    }
  };

  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: Config.GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(getAuth(), email.trim(), password);
      // AuthGate will reactively switch stack, no manual replace needed.
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        Alert.alert("Error", "Invalid credentials.");
      } else if (error.code === 'auth/wrong-password') {
        Alert.alert("Error", "Incorrect password.");
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert("Error", "That email address is invalid.");
      } else {
        Alert.alert("Login Failed", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogleButtonPress = async () => {
    setGoogleLoading(true);

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;

      if (!idToken) {
        Alert.alert("Error", "Google Sign-In failed");
        return;
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), googleCredential);
      // AuthGate will reactively switch stack, no manual replace needed.
    } catch (error: any) {
      console.log("Google Error:", error);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // cancelled
      } else {
        Alert.alert(
          "Google Login Error",
          error?.message || "Something went wrong"
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen scrollable={false} safeAreaEdges={[]} keyboardAvoiding={true}>
      <ImageBackground
        source={require("../../assets/images/figma-bg.png")}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              <Text style={styles.appTitle}>ANALYTICS APP</Text>
              <Text style={styles.logo}>TrendPulse</Text>

              <View style={styles.card}>
                <Text style={styles.welcome}>Welcome Back</Text>

                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputBox}>
                  <Feather name="at-sign" size={20} color={colors.text.secondary} />
                  <TextInput
                    placeholder="Enter Email"
                    placeholderTextColor={colors.text.secondary}
                    style={styles.input}
                    value={email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={setEmail}
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputBox}>
                  <Feather name="lock" size={20} color={colors.text.secondary} />
                  <TextInput
                    placeholder="Enter Password"
                    placeholderTextColor={colors.text.secondary}
                    secureTextEntry={!show}
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShow(!show)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Feather
                      name={show ? "eye" : "eye-off"}
                      size={20}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  onPress={() => {
                    setResetEmail(email);
                    setForgotModalVisible(true);
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                  <Text style={styles.forgot}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleLogin} activeOpacity={0.8} disabled={loading}>
                  <LinearGradient
                    colors={[colors.neon.purple, colors.neon.blue, colors.neon.cyan]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtn}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.text.primary} />
                    ) : (
                      <Text style={styles.loginText}>
                        Login
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <Text style={styles.or}>OR CONTINUE WITH</Text>

              <TouchableOpacity onPress={onGoogleButtonPress} style={styles.socialBtn} disabled={googleLoading} activeOpacity={0.8}>
                {googleLoading ? (
                  <ActivityIndicator color={colors.text.primary} size="small" />
                ) : (
                  <>
                    <FontAwesome name="google" size={20} color={colors.text.primary} />
                    <Text style={styles.socialText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.bottomText}>
                Don't have an account?
                <Text
                  style={styles.create}
                  onPress={() => navigation.navigate(ROUTES.REGISTER)}
                >
                  {" "}Create account
                </Text>
              </Text>
            </View>

            {/* FORGOT PASSWORD MODAL */}
            <Modal
              animationType="fade"
              transparent={true}
              visible={forgotModalVisible}
              onRequestClose={() => setForgotModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <View style={styles.modalIconContainer}>
                    <Feather name="mail" size={28} color={colors.neon.purple} />
                  </View>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalText}>
                    Enter your email address and we'll send you a link to reset your password.
                  </Text>
                  
                  <View style={styles.inputContainer}>
                    <Feather name="at-sign" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Email Address"
                      placeholderTextColor={colors.text.tertiary}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  
                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={styles.cancelBtn} 
                      onPress={() => setForgotModalVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.confirmBtn} 
                      onPress={handleForgotPassword}
                      activeOpacity={0.8}
                      disabled={sendingReset}
                    >
                      <LinearGradient
                        colors={[colors.neon.purple, '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.confirmGradient}
                      >
                        {sendingReset ? (
                          <ActivityIndicator color={colors.text.primary} size="small" />
                        ) : (
                          <Text style={styles.confirmBtnText}>Send Link</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </ScrollView>
        </View>
      </ImageBackground>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: height * 0.05,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
  },
  appTitle: {
    color: colors.neon.purple,
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: spacing.sm,
    fontSize: width < 380 ? 12 : 14,
  },
  logo: {
    color: colors.text.primary,
    fontSize: width < 380 ? 32 : 36,
    fontWeight: typography.weight.black,
    textAlign: "center",
    marginBottom: height * 0.04,
  },
  card: {
    backgroundColor: "rgba(30, 27, 46, 0.85)",
    borderRadius: spacing.buttonRadius,
    padding: width < 380 ? spacing.screenPadding : 28,
    borderWidth: 1,
    borderColor: "rgba(106,37,244,0.25)",
    elevation: 10
  },
  welcome: {
    fontSize: width < 380 ? 22 : 26,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontSize: width < 380 ? typography.size.sm : 14,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22,16,34,0.7)",
    borderRadius: spacing.cardRadius - 2,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    paddingVertical: 12,
    marginLeft: 10,
    fontSize: width < 380 ? 14 : typography.size.base,
  },
  forgot: {
    color: colors.neon.purple,
    textAlign: "right",
    marginBottom: spacing.xl,
    fontSize: width < 380 ? typography.size.sm : 14,
  },
  loginBtn: {
    paddingVertical: 15,
    borderRadius: spacing.cardRadius - 2,
    alignItems: "center"
  },
  loginText: {
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    fontSize: width < 380 ? typography.size.base : 17
  },
  or: {
    textAlign: "center",
    color: colors.text.secondary,
    marginVertical: spacing.screenPadding,
    fontSize: width < 380 ? 12 : 14,
  },
  socialBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(106,37,244,0.4)",
    borderRadius: spacing.cardRadius - 2,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  socialText: {
    color: colors.text.primary,
    marginLeft: 12,
    fontSize: width < 380 ? typography.size.base : 16
  },
  bottomText: {
    textAlign: "center",
    color: colors.text.secondary,
    fontSize: width < 380 ? typography.size.sm : 14,
  },
  create: {
    color: colors.neon.purple,
    fontWeight: typography.weight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: 24,
    padding: spacing.xl + 4,
    width: "100%",
    alignItems: "center",
    backgroundColor: 'rgba(22, 20, 36, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg + 4,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm + 2,
    letterSpacing: 0.2,
  },
  modalText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: "center",
    marginBottom: spacing.xl + 4,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    height: 50,
    width: '100%',
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  modalInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base,
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmGradient: {
    paddingVertical: spacing.md + 2,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
});
