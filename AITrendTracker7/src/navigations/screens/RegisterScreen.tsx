import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Feather from "react-native-vector-icons/Feather";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { getAuth, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { BASE_URL } from "../../utils/config";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { Config } from "../../config/env";
import { ROUTES } from "../../navigation/routes";
import { RootStackScreenProps } from "../../navigation/types";
import { Screen } from "../../components/common/Screen";

const { width, height } = Dimensions.get('window');

type Props = RootStackScreenProps<typeof ROUTES.REGISTER>;

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: Config.GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  const syncUserWithBackend = async (userData: any) => {
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) return;
      
      const token = await currentUser.getIdToken();

      await fetch(`${BASE_URL}/api/users/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: userData.email,
          displayName: userData.displayName,
          photoURL: userData.photoURL
        })
      });
    } catch (error) {
      console.log("Backend sync error:", error);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    if (password !== confirm) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: name,
        });
        await syncUserWithBackend({ ...userCredential.user, displayName: name });
      }
      // AuthGate reactively mounts TabNavigator, no manual replace needed.
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert("Error", "That email address is already in use!");
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert("Error", "That email address is invalid!");
      } else if (error.code === 'auth/weak-password') {
        Alert.alert("Error", "Password should be at least 6 characters.");
      } else {
        Alert.alert("Registration Failed", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogleButtonPress = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), googleCredential);
      await syncUserWithBackend(getAuth().currentUser);
      // AuthGate reactively mounts TabNavigator, no manual replace needed.
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled
      } else {
        Alert.alert("Google Login Error", error.message);
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
              <Text style={styles.logo}>TrendPulse</Text>

              <View style={styles.card}>
                <Text style={styles.title}>Create Account</Text>

                {/* NAME */}
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputBox}>
                  <Feather name="user" size={20} color={colors.text.secondary} />
                  <TextInput
                    placeholder="Enter Full Name"
                    placeholderTextColor={colors.text.secondary}
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {/* EMAIL */}
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputBox}>
                  <Feather name="mail" size={20} color={colors.text.secondary} />
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

                {/* PASSWORD */}
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputBox}>
                  <Feather name="lock" size={20} color={colors.text.secondary} />
                  <TextInput
                    placeholder="Enter Password"
                    placeholderTextColor={colors.text.secondary}
                    secureTextEntry={!showPass}
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Feather name={showPass ? "eye" : "eye-off"} size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                {/* CONFIRM PASSWORD */}
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputBox}>
                  <Feather name="shield" size={20} color={colors.text.secondary} />
                  <TextInput
                    placeholder="Confirm Password"
                    placeholderTextColor={colors.text.secondary}
                    secureTextEntry={!showConfirm}
                    style={styles.input}
                    value={confirm}
                    onChangeText={setConfirm}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Feather name={showConfirm ? "eye" : "eye-off"} size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                {/* BUTTON */}
                <TouchableOpacity onPress={handleRegister} activeOpacity={0.8} disabled={loading} style={{marginTop: 8}}>
                  <LinearGradient
                    colors={[colors.neon.purple, colors.neon.blue, colors.neon.cyan]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.text.primary} />
                    ) : (
                      <Text style={styles.buttonText}>
                        Create Account
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <Text style={styles.or}>OR CONTINUE WITH</Text>

              {/* GOOGLE */}
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
                Already have an account?
                <Text
                  style={styles.login}
                  onPress={() => navigation.navigate(ROUTES.LOGIN)}
                >
                  {" "}Login
                </Text>
              </Text>
            </View>
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
    paddingVertical: height * 0.02,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingHorizontal: spacing.screenPadding,
  },
  logo: {
    color: colors.text.primary,
    fontSize: width < 380 ? 28 : 32,
    fontWeight: typography.weight.bold,
    textAlign: "center",
    marginBottom: height * 0.02
  },
  card: {
    backgroundColor: "rgba(30,27,46,0.9)",
    borderRadius: spacing.screenPadding,
    padding: width < 380 ? spacing.lg : spacing.screenPadding,
    borderWidth: 1,
    borderColor: "rgba(106,37,244,0.3)",
    marginBottom: 15
  },
  title: {
    color: colors.text.primary,
    fontSize: width < 380 ? 20 : 22,
    textAlign: "center",
    marginBottom: 15
  },
  label: {
    color: colors.text.secondary,
    marginBottom: 4,
    fontSize: width < 380 ? 12 : typography.size.sm,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22,16,34,0.7)",
    borderRadius: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: 12
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    marginLeft: spacing.sm,
    fontSize: width < 380 ? typography.size.sm : 14,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: spacing.md,
    alignItems: "center"
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: width < 380 ? 14 : spacing.lg,
    fontWeight: typography.weight.bold
  },
  or: {
    textAlign: "center",
    color: colors.text.secondary,
    marginVertical: spacing.sm,
    fontSize: width < 380 ? 12 : typography.size.sm,
  },
  socialBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(106,37,244,0.4)",
    borderRadius: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm
  },
  socialText: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
    fontSize: width < 380 ? 14 : typography.size.base
  },
  bottomText: {
    textAlign: "center",
    color: colors.text.secondary,
    fontSize: width < 380 ? 12 : typography.size.sm,
    marginBottom: 5
  },
  login: {
    color: colors.neon.purple,
    fontWeight: typography.weight.bold
  }
});
