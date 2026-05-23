import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import LinearGradient from "react-native-linear-gradient";
import {
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  GoogleAuthProvider,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Screen } from "../../components/common/Screen";
import Header from "../../components/common/Header";
import SecuritySection from "../../components/profile/SecuritySection";
import { useGetUserProfileQuery } from "../../store/apiSlice";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { ROUTES } from "../../navigation/routes";
import { RootStackScreenProps } from "../../navigation/types";
import { BASE_URL } from "../../utils/config";
import { useAppDispatch } from "../../store/hooks";
import { logout } from "../../store/slices/authSlice";

type Props = RootStackScreenProps<typeof ROUTES.SECURITY>;

export default function SecurityScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [resending, setResending] = useState(false);
  // Re-auth & Deletion States
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: profileRes, refetch: refetchProfile } = useGetUserProfileQuery();
  const backendUser = profileRes?.data;

  useEffect(() => {
    const user = getAuth().currentUser;
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const isGoogleUser = currentUser?.providerData?.some(
    (p: any) => p.providerId === "google.com"
  );

  // Handle email verification resend
  const handleResendVerification = async () => {
    if (!currentUser) return;
    setResending(true);
    try {
      await sendEmailVerification(currentUser);
      Alert.alert(
        "Verification Email Sent",
        "A verification link has been sent to " + currentUser.email + ". Please check your inbox and spam folders."
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send verification email.");
    } finally {
      setResending(false);
    }
  };

  // Handle Password Reset Request
  const handleForgotPassword = async () => {
    if (!currentUser || !currentUser.email) return;
    try {
      await sendPasswordResetEmail(getAuth(), currentUser.email);
      Alert.alert(
        "Password Reset Sent",
        "A password reset link has been sent to " + currentUser.email + ". Use it to update your password."
      );
    } catch (error: any) {
      let msg = error.message || "Failed to send password reset email.";
      if (error.code === 'auth/too-many-requests') msg = "Too many requests. Please wait before trying again.";
      else if (error.code === 'auth/network-request-failed') msg = "Network error. Check your connection.";
      Alert.alert("Error", msg);
    }
  };

  // Navigate to Password Change Screen
  const handlePasswordChangePress = () => {
    if (isGoogleUser) {
      Alert.alert(
        "Social Account",
        "Since you signed in with Google, password management is handled directly through Google. You cannot change your password inside this app."
      );
      return;
    }

    if (!currentUser?.emailVerified) {
      Alert.alert(
        "Email Unverified",
        "Please verify your email address before attempting to change your password. You can resend the verification link above.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Resend Email", onPress: handleResendVerification },
        ]
      );
      return;
    }

    navigation.navigate(ROUTES.CHANGE_PASSWORD);
  };

  // Perform Account Deletion
  const handleDeleteAccount = async () => {
    if (!currentUser || deleting) return;

    if (!currentUser?.emailVerified) {
      Alert.alert(
        "Email Unverified",
        "Please verify your email address before attempting to delete your account."
      );
      return;
    }

    if (!isGoogleUser && !password.trim()) {
      Alert.alert("Error", "Please enter your current password to proceed.");
      return;
    }

    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to permanently delete your account? This action is irreversible.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              // 1. Re-authenticate
              if (isGoogleUser) {
                await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                const signInResult = await GoogleSignin.signIn();
                const idToken = signInResult.data?.idToken;
                if (!idToken) throw new Error("Google re-authentication canceled.");
                const credential = GoogleAuthProvider.credential(idToken);
                await reauthenticateWithCredential(currentUser, credential);
              } else {
                const credential = EmailAuthProvider.credential(currentUser.email, password);
                await reauthenticateWithCredential(currentUser, credential);
              }

              // 2. Call backend DELETE to purge MongoDB data
              const token = await currentUser.getIdToken();
              const deleteRes = await fetch(`${BASE_URL}/api/users/profile`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!deleteRes.ok) {
                throw new Error("Failed to delete backend profile.");
              }

              // 3. Delete from Firebase
              await deleteUser(currentUser);

              // 4. Dispatch logout to clear Redux auth credentials
              dispatch(logout());

              setDeleteModalVisible(false);
              Alert.alert("Account Deleted", "Your account and data have been permanently deleted.");
            } catch (error: any) {
              console.log("Delete Account Error:", error);
              Alert.alert("Deletion Failed", error.message || "An error occurred during account deletion.");
            } finally {
              setDeleting(false);
              setPassword("");
            }
          },
        },
      ]
    );
  };

  return (
    <Screen scrollable={true}>
      <Header title="Account Security" showBack={true} onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        {/* REUSABLE SECURITY SECTION */}
        <SecuritySection
          email={currentUser?.email}
          emailVerified={!!currentUser?.emailVerified}
          onResendVerification={handleResendVerification}
          resending={resending}
          onChangePassword={handlePasswordChangePress}
          onForgotPassword={handleForgotPassword}
          onDeleteAccount={() => {
            if (!currentUser?.emailVerified) {
              Alert.alert(
                "Email Unverified",
                "Please verify your email address before attempting to delete your account."
              );
              return;
            }
            setDeleteModalVisible(true);
          }}
          session={backendUser?.session}
        />

      </View>

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => {
          if (!deleting) setDeleteModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Feather name="alert-triangle" size={32} color={colors.neon.red} />
            </View>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalText}>
              This action is permanent and irreversible. All your settings, saved trends, and user data will be purged.
            </Text>

            {isGoogleUser ? (
              <Text style={styles.googleReauthText}>
                You will be prompted to re-authenticate with your Google account.
              </Text>
            ) : (
              <View style={styles.inputContainer}>
                <Feather name="lock" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter Password to Confirm"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={18}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleDeleteAccount}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.neon.red, "#dc2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmGradient}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.text.primary} size="small" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Delete</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    color: colors.text.tertiary,
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: spacing.sm + 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
    marginBottom: spacing.xxl,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginLeft: spacing.lg + 2 + 40 + spacing.lg,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  rowText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base + 1,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.15,
  },

  // Modals styling
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
    backgroundColor: "rgba(22, 20, 36, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
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
  googleReauthText: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    height: 50,
    width: "100%",
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
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
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
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
