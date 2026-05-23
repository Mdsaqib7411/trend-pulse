import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import LinearGradient from "react-native-linear-gradient";
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "@react-native-firebase/auth";
import { Screen } from "../../components/common/Screen";
import Header from "../../components/common/Header";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { ROUTES } from "../../navigation/routes";
import { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<typeof ROUTES.CHANGE_PASSWORD>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  // Password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword === currentPassword) {
      Alert.alert("Error", "Your new password must be different from your current password.");
      return;
    }

    if (!isPasswordValid) {
      Alert.alert("Error", "Please make sure your new password meets all security requirements.");
      return;
    }

    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user || !user.email) {
        throw new Error("No authenticated user found.");
      }

      // 1. Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update to new password
      await updatePassword(user, newPassword);

      Alert.alert("Success", "Your password has been successfully updated.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.log("Password Update Error:", error);
      let msg = error.message || "Failed to update password.";
      if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        msg = "The current password you entered is incorrect.";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "Too many failed attempts. Please wait a moment and try again.";
      } else if (error.code === 'auth/network-request-failed') {
        msg = "Network error. Please check your connection and try again.";
      } else if (error.code === 'auth/weak-password') {
        msg = "Password is too weak. Please choose a stronger password.";
      } else if (error.code === 'auth/requires-recent-login') {
        msg = "Session expired. Please log out and log back in before changing your password.";
      }
      Alert.alert("Update Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scrollable={true} keyboardAvoiding={true}>
      <Header title="Change Password" showBack={true} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.description}>
            Update your account password. For security reasons, you must re-authenticate with your current password.
          </Text>

          <View style={styles.card}>
            {/* Current Password Field */}
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.inputContainer}>
              <Feather name="lock" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter Current Password"
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Feather name={showCurrent ? "eye" : "eye-off"} size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {/* New Password Field */}
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputContainer}>
              <Feather name="shield" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter New Password"
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Feather name={showNew ? "eye" : "eye-off"} size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {/* Confirm New Password Field */}
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.inputContainer}>
              <Feather name="check-square" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Feather name={showConfirm ? "eye" : "eye-off"} size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Validation Rules Card */}
          <Text style={styles.sectionTitle}>Security Requirements</Text>
          <View style={styles.validationCard}>
            <View style={styles.validationRow}>
              <Feather
                name={hasMinLength ? "check-circle" : "circle"}
                size={16}
                color={hasMinLength ? colors.neon.green : colors.text.tertiary}
                style={styles.validationIcon}
              />
              <Text style={[styles.validationText, hasMinLength && styles.validationSuccessText]}>
                Minimum of 8 characters
              </Text>
            </View>

            <View style={styles.validationRow}>
              <Feather
                name={hasUppercase ? "check-circle" : "circle"}
                size={16}
                color={hasUppercase ? colors.neon.green : colors.text.tertiary}
                style={styles.validationIcon}
              />
              <Text style={[styles.validationText, hasUppercase && styles.validationSuccessText]}>
                At least one uppercase letter
              </Text>
            </View>

            <View style={styles.validationRow}>
              <Feather
                name={hasNumber ? "check-circle" : "circle"}
                size={16}
                color={hasNumber ? colors.neon.green : colors.text.tertiary}
                style={styles.validationIcon}
              />
              <Text style={[styles.validationText, hasNumber && styles.validationSuccessText]}>
                At least one numeric digit
              </Text>
            </View>

            <View style={styles.validationRow}>
              <Feather
                name={passwordsMatch ? "check-circle" : "circle"}
                size={16}
                color={passwordsMatch ? colors.neon.green : colors.text.tertiary}
                style={styles.validationIcon}
              />
              <Text style={[styles.validationText, passwordsMatch && styles.validationSuccessText]}>
                Passwords match exactly
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleUpdatePassword}
            disabled={loading || !isPasswordValid}
            activeOpacity={0.8}
            style={styles.saveBtnWrapper}
          >
            <LinearGradient
              colors={
                isPasswordValid
                  ? [colors.neon.purple, colors.neon.blue]
                  : ["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.05)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text
                  style={[
                    styles.saveBtnText,
                    !isPasswordValid && { color: colors.text.tertiary },
                  ]}
                >
                  Update Password
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: colors.text.tertiary,
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm + 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text.primary,
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.semiBold,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingHorizontal: spacing.md + 2,
    marginBottom: spacing.lg + 2,
    height: 52,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base,
  },
  validationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  validationIcon: {
    marginRight: spacing.md,
  },
  validationText: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.medium,
  },
  validationSuccessText: {
    color: colors.text.primary,
  },
  saveBtnWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  saveBtn: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.base + 1,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
});
