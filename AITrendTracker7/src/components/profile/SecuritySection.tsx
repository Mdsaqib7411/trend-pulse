import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface SecuritySectionProps {
  email: string | null;
  emailVerified: boolean;
  onResendVerification: () => void;
  resending: boolean;
  onChangePassword: () => void;
  onForgotPassword: () => void;
  onDeleteAccount: () => void;
  session?: {
    deviceName?: string;
    platform?: string;
    lastLoginAt?: string;
  };
}

export default function SecuritySection({
  email,
  emailVerified,
  onResendVerification,
  resending,
  onChangePassword,
  onForgotPassword,
  onDeleteAccount,
  session,
}: SecuritySectionProps) {
  // Format last login date beautifully
  const formatLastLogin = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + " at " + date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      {/* EMAIL VERIFICATION STATUS CARD */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconContainer, { backgroundColor: emailVerified ? "rgba(74, 222, 128, 0.12)" : "rgba(239, 68, 68, 0.12)" }]}>
            <Feather
              name={emailVerified ? "check-circle" : "alert-circle"}
              size={20}
              color={emailVerified ? colors.neon.green : colors.neon.red}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.label}>Email Verification</Text>
            <Text style={styles.value}>{email || "No Email Provided"}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: emailVerified ? "rgba(74, 222, 128, 0.15)" : "rgba(239, 68, 68, 0.15)" }]}>
            <Text style={[styles.badgeText, { color: emailVerified ? colors.neon.green : colors.neon.red }]}>
              {emailVerified ? "Verified" : "Unverified"}
            </Text>
          </View>
        </View>

        {!emailVerified && (
          <View style={styles.verificationAction}>
            <Text style={styles.infoText}>
              Your email is not verified. Please verify your email to unlock password changes and account deletion.
            </Text>
            <TouchableOpacity
              onPress={onResendVerification}
              disabled={resending}
              style={styles.resendBtn}
              activeOpacity={0.7}
            >
              {resending ? (
                <ActivityIndicator size="small" color={colors.neon.purple} style={{ marginRight: 8 }} />
              ) : (
                <Feather name="send" size={14} color={colors.neon.purple} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.resendText}>
                {resending ? "Sending link..." : "Resend Verification Email"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SECURITY ACTIONS CARD */}
      <Text style={styles.sectionTitle}>Account Actions</Text>
      <View style={styles.card}>
        {/* Change Password */}
        <TouchableOpacity
          style={[styles.actionRow, !emailVerified && styles.disabledAction]}
          onPress={emailVerified ? onChangePassword : undefined}
          activeOpacity={emailVerified ? 0.7 : 1}
        >
          <View style={[styles.iconContainer, { backgroundColor: emailVerified ? "rgba(106, 37, 244, 0.12)" : "rgba(255, 255, 255, 0.05)" }]}>
            <Feather
              name={emailVerified ? "lock" : "shield-off"}
              size={20}
              color={emailVerified ? colors.neon.purple : colors.text.tertiary}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.actionTitle, !emailVerified && styles.disabledText]}>Change Password</Text>
            <Text style={styles.actionDesc}>
              {emailVerified ? "Update your account password securely" : "Verify email to unlock"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Forgot Password */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={onForgotPassword}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: "rgba(0, 198, 255, 0.12)" }]}>
            <Feather
              name="mail"
              size={20}
              color={colors.neon.cyan}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.actionTitle}>Forgot Password</Text>
            <Text style={styles.actionDesc}>Send a password reset email</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Delete Account */}
        <TouchableOpacity
          style={[styles.actionRow, !emailVerified && styles.disabledAction]}
          onPress={emailVerified ? onDeleteAccount : undefined}
          activeOpacity={emailVerified ? 0.7 : 1}
        >
          <View style={[styles.iconContainer, { backgroundColor: emailVerified ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.05)" }]}>
            <Feather
              name={emailVerified ? "trash-2" : "user-x"}
              size={20}
              color={emailVerified ? colors.neon.red : colors.text.tertiary}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.actionTitle, !emailVerified && styles.disabledText, emailVerified && { color: colors.neon.red }]}>Delete Account</Text>
            <Text style={styles.actionDesc}>
              {emailVerified ? "Permanently delete your profile and data" : "Verify email to unlock deletion"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* SESSION SECURITY CARD */}
      <Text style={styles.sectionTitle}>Active Session</Text>
      <View style={styles.card}>
        <View style={styles.sessionRow}>
          <View style={[styles.iconContainer, { backgroundColor: "rgba(124, 58, 237, 0.12)" }]}>
            <Feather
              name={Platform.OS === "ios" ? "smartphone" : "monitor"}
              size={20}
              color={colors.neon.purple}
            />
          </View>
          <View style={styles.sessionTextContainer}>
            <Text style={styles.sessionDeviceName}>
              {session?.deviceName || (Platform.OS === "ios" ? "iPhone" : "Android Device")}
            </Text>
            <Text style={styles.sessionPlatform}>
              Current Device • {session?.platform || Platform.OS}
            </Text>
          </View>
          <View style={styles.sessionActiveBadge}>
            <Text style={styles.sessionActiveText}>Active Now</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.sessionDetail}>
          <Feather name="clock" size={14} color={colors.text.tertiary} style={{ marginRight: 8 }} />
          <Text style={styles.sessionDetailText}>
            Last logged in: {formatLastLogin(session?.lastLoginAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text.tertiary,
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: spacing.xl + 4,
    marginBottom: spacing.sm + 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: spacing.lg + 2,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md + 2,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    letterSpacing: 0.1,
  },
  value: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.bold,
  },
  verificationAction: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  infoText: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    lineHeight: 18,
    marginBottom: spacing.md + 2,
    letterSpacing: 0.1,
  },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.18)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  resendText: {
    color: colors.neon.purple,
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.semiBold,
    letterSpacing: 0.1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  actionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.15,
  },
  actionDesc: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  disabledAction: {
    opacity: 0.45,
  },
  disabledText: {
    color: colors.text.tertiary,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionTextContainer: {
    flex: 1,
  },
  sessionDeviceName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.1,
  },
  sessionPlatform: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  sessionActiveBadge: {
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionActiveText: {
    color: colors.neon.green,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: spacing.lg,
  },
  sessionDetail: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionDetailText: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    letterSpacing: 0.1,
  },
});
