import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import LinearGradient from "react-native-linear-gradient";
import { getAuth, signOut, updateProfile, sendEmailVerification } from '@react-native-firebase/auth';
import ImagePicker from 'react-native-image-crop-picker';
import { Screen } from "../../components/common/Screen";
import Header from "../../components/common/Header";
import { BASE_URL } from "../../utils/config";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { Config } from "../../config/env";
import { ROUTES } from "../../navigation/routes";
import { RootStackScreenProps } from "../../navigation/types";
import { useFocusEffect } from '@react-navigation/native';
import { useGetUserProfileQuery } from "../../store/apiSlice";
import { useAppDispatch } from "../../store/hooks";
import { setCredentials } from "../../store/slices/authSlice";

// ── Menu Configuration ────────────────────────────────────────────────
const MENU_ITEMS = [
  { key: 'edit',          icon: 'user',   label: 'Edit Profile',      color: colors.neon.purple, bg: colors.overlay.purpleGlow },
  { key: 'saved',         icon: 'bookmark', label: 'Saved Posts',     color: colors.neon.cyan,   bg: colors.overlay.cyanGlow },
  { key: 'security',      icon: 'shield', label: 'Account Security',  color: colors.neon.blue,   bg: 'rgba(37, 99, 235, 0.15)' },
  { key: 'notifications', icon: 'bell',   label: 'Notifications',     color: colors.neon.green,  bg: 'rgba(74, 222, 128, 0.12)' },
] as const;

type MenuKey = typeof MENU_ITEMS[number]['key'];

export default function ProfileScreen({ navigation }: RootStackScreenProps<typeof ROUTES.PROFILE>) {
  const dispatch = useAppDispatch();
  const [user, setUser] = useState<any>(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const { data: profileRes, isLoading: isProfileLoading, refetch: refetchProfile } = useGetUserProfileQuery();
  const backendUser = profileRes?.data;

  useFocusEffect(
    React.useCallback(() => {
      refetchProfile();
      // Refresh Firebase user so emailVerified reflects latest state
      const refreshed = getAuth().currentUser;
      if (refreshed) setUser(refreshed);
    }, [refetchProfile])
  );

  useEffect(() => {
    // Get current user
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  const updateBackendProfile = async (data: any) => {
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) return;
      
      // Get the Firebase ID Token
      const token = await currentUser.getIdToken();

      await fetch(`${BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.log("Backend profile update error:", error);
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    try {
      setLogoutModalVisible(false);
      await signOut(getAuth());
      // No navigation.replace needed as SyncGate + AuthNavigator handles it reactively!
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    setSavingName(true);
    try {
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        // ✅ Modular Firebase v23 API
        await updateProfile(currentUser, {
          displayName: newName.trim(),
        });
        await updateBackendProfile({ displayName: newName.trim() });

        const token = await currentUser.getIdToken();
        dispatch(
          setCredentials({
            user: {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: newName.trim(),
              photoURL: currentUser.photoURL,
            },
            token,
          })
        );

        setUser({ ...user, displayName: newName.trim() });
        setEditModalVisible(false);
        Alert.alert("Success", "Profile updated successfully!");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdateAvatar = async () => {
    try {
      const image = await ImagePicker.openPicker({
        width: 400,
        height: 400,
        cropping: true,
        cropperCircleOverlay: true,
        includeBase64: true,
        mediaType: 'photo'
      });

      if (!image || !image.data || !user) return;

      const base64Data = image.data;

      setUploading(true);
      
      try {
        const payload = {
          file: `data:image/jpeg;base64,${base64Data}`,
          upload_preset: Config.CLOUDINARY_UPLOAD_PRESET,
        };

        const response = await fetch(`https://api.cloudinary.com/v1_1/${Config.CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        
        const data = await response.json();
        
        if (data.secure_url) {
          const downloadURL = data.secure_url;
          
          const currentUser = getAuth().currentUser;
          if (currentUser) {
            // ✅ Modular Firebase v23 API
            await updateProfile(currentUser, {
              photoURL: downloadURL,
            });
            await updateBackendProfile({ photoURL: downloadURL });

            const token = await currentUser.getIdToken();
            dispatch(
              setCredentials({
                user: {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  displayName: currentUser.displayName,
                  photoURL: downloadURL,
                },
                token,
              })
            );
          }
          
          // Update local state to reflect immediately
          setUser({ ...user, photoURL: downloadURL });
          Alert.alert("Success", "Profile picture updated successfully!");
        } else {
          Alert.alert("Cloudinary Server Error", data.error?.message || "Failed to upload image");
        }
      } catch (uploadError: any) {
        Alert.alert("App Code Error", uploadError.message);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleResendVerification = async () => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;
    setResendingVerification(true);
    try {
      await sendEmailVerification(currentUser);
      Alert.alert(
        "Verification Email Sent",
        `A verification link has been sent to ${currentUser.email}. Check your inbox and spam folder.`
      );
    } catch (error: any) {
      let msg = error.message || "Failed to send verification email.";
      if (error.code === 'auth/too-many-requests') {
        msg = "Too many requests. Please wait a moment before trying again.";
      } else if (error.code === 'auth/network-request-failed') {
        msg = "Network error. Please check your connection and try again.";
      } else if (error.code === 'auth/user-not-found') {
        msg = "No account found for this email address.";
      }
      Alert.alert("Error", msg);
    } finally {
      setResendingVerification(false);
    }
  };

  // ── Menu Item Press Handler ───────────────────────────────────────
  const handleMenuPress = (key: MenuKey) => {
    switch (key) {
      case 'edit':
        navigation.navigate(ROUTES.EDIT_PROFILE);
        break;
      case 'saved':
        navigation.navigate(ROUTES.MAIN_TABS, { screen: ROUTES.SAVED });
        break;
      case 'security':
        navigation.navigate(ROUTES.SECURITY);
        break;
      case 'notifications':
        navigation.navigate(ROUTES.NOTIFICATIONS);
        break;
    }
  };

  return (
    <Screen scrollable={true}>
      <Header title="Profile" showBack={true} onBack={() => navigation.goBack()} />

      {/* PROFILE INFO */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarGlow} />
          <LinearGradient
            colors={['#7C3AED', '#6A25F4', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatar}>
              {(backendUser?.photoURL || user?.photoURL) ? (
                <Image source={{ uri: backendUser?.photoURL || user?.photoURL }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={44} color={colors.text.primary} />
              )}
            </View>
          </LinearGradient>
          <TouchableOpacity 
            style={styles.editAvatarBtn} 
            activeOpacity={0.8}
            onPress={handleUpdateAvatar}
            disabled={uploading}
          >
            <LinearGradient
              colors={[colors.neon.purple, '#8B5CF6']}
              style={styles.editAvatarGradient}
            >
              <Feather name="camera" size={14} color={colors.text.primary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>
          {uploading ? "Updating..." : (backendUser?.displayName || user?.displayName || "TrendPulse User")}
        </Text>
        <Text style={styles.email}>{backendUser?.email || user?.email || "user@example.com"}</Text>

        {/* ── EMAIL VERIFICATION BADGE ─────────────────────────────── */}
        <View style={[
          styles.verificationBadge,
          { backgroundColor: user?.emailVerified ? 'rgba(74, 222, 128, 0.08)' : 'rgba(239, 68, 68, 0.08)' },
        ]}>
          <Feather
            name={user?.emailVerified ? "check-circle" : "alert-circle"}
            size={12}
            color={user?.emailVerified ? colors.neon.green : colors.neon.red}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.verificationBadgeText, { color: user?.emailVerified ? colors.neon.green : colors.neon.red }]}>
            {user?.emailVerified ? "Email Verified" : "Email Not Verified"}
          </Text>
        </View>

        {/* ── RESEND BUTTON (unverified only) ──────────────────────── */}
        {!user?.emailVerified && (
          <TouchableOpacity
            onPress={handleResendVerification}
            disabled={resendingVerification}
            style={styles.resendVerificationBtn}
            activeOpacity={0.7}
          >
            {resendingVerification ? (
              <ActivityIndicator size="small" color={colors.neon.purple} style={{ marginRight: 6 }} />
            ) : (
              <Feather name="send" size={12} color={colors.neon.purple} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.resendVerificationText}>
              {resendingVerification ? "Sending..." : "Resend Verification Email"}
            </Text>
          </TouchableOpacity>
        )}

        {backendUser?.bio ? (
          <Text style={styles.bio}>{backendUser.bio}</Text>
        ) : null}
      </View>

      {/* SETTINGS MENU */}
      <View style={styles.menuContainer}>
        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.card}>
          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.key}>
              <TouchableOpacity 
                style={styles.menuItem} 
                activeOpacity={0.6}
                onPress={() => handleMenuPress(item.key)}
              >
                <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                  <Feather name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={styles.menuText}>{item.label}</Text>
                <Feather name="chevron-right" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
              {index < MENU_ITEMS.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* LOGOUT BUTTON */}
      <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={styles.logoutWrapper}>
        <View style={styles.logoutBtn}>
          <Feather name="log-out" size={18} color={colors.neon.red} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Logout</Text>
        </View>
      </TouchableOpacity>



      {/* CUSTOM LOGOUT MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Feather name="log-out" size={28} color={colors.neon.red} />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalText}>
              Are you sure you want to logout from your account?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.confirmBtn} 
                onPress={confirmLogout}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.neon.red, "#dc2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmGradient}
                >
                  <Text style={styles.confirmBtnText}>Logout</Text>
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
  // ── Profile Section ─────────────────────────────────────────────
  profileSection: {
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.xxl + 4,
    paddingHorizontal: spacing.screenPadding,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: spacing.xl,
  },
  avatarGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 70,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  avatarRing: {
    padding: 3,
    borderRadius: 56,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.background.tertiary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3.5,
    borderColor: colors.background.primary,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.background.primary,
    overflow: 'hidden',
  },
  editAvatarGradient: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  email: {
    color: colors.text.secondary,
    fontSize: typography.size.sm + 1,
    letterSpacing: 0.2,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verificationBadgeText: {
    fontSize: 12,
    fontWeight: typography.weight.semiBold,
    letterSpacing: 0.2,
  },
  resendVerificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(106, 37, 244, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(106, 37, 244, 0.18)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  resendVerificationText: {
    color: colors.neon.purple,
    fontSize: 12,
    fontWeight: typography.weight.semiBold,
    letterSpacing: 0.1,
  },
  bio: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
    letterSpacing: 0.15,
  },

  // ── Settings Menu ───────────────────────────────────────────────
  menuContainer: {
    paddingHorizontal: spacing.screenPadding,
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.lg,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: spacing.lg + 2 + 40 + spacing.lg, // paddingLeft + iconBox width + iconBox marginRight
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  menuText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base + 1,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.15,
  },

  // ── Logout ──────────────────────────────────────────────────────
  logoutWrapper: {
    paddingHorizontal: spacing.screenPadding,
    marginTop: spacing.xxl + 8,
  },
  logoutBtn: {
    flexDirection: "row",
    paddingVertical: spacing.lg,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.18)',
  },
  logoutIcon: {
    marginRight: spacing.sm + 2,
  },
  logoutText: {
    color: colors.neon.red,
    fontSize: typography.size.base + 1,
    fontWeight: typography.weight.semiBold,
    letterSpacing: 0.3,
  },




  // ── Modals ──────────────────────────────────────────────────────
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
    borderColor: 'rgba(239, 68, 68, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  editModalCard: {
    borderColor: 'rgba(124, 58, 237, 0.25)',
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
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base,
  },
});
