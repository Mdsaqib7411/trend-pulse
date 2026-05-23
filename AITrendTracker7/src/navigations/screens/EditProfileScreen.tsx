import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import LinearGradient from "react-native-linear-gradient";
import { getAuth, updateProfile } from "@react-native-firebase/auth";
import ImagePicker from "react-native-image-crop-picker";
import { Screen } from "../../components/common/Screen";
import Header from "../../components/common/Header";
import { useGetUserProfileQuery } from "../../store/apiSlice";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { Config } from "../../config/env";
import { ROUTES } from "../../navigation/routes";
import { RootStackScreenProps } from "../../navigation/types";
import { BASE_URL } from "../../utils/config";
import { useAppDispatch } from "../../store/hooks";
import { setCredentials } from "../../store/slices/authSlice";

type Props = RootStackScreenProps<typeof ROUTES.EDIT_PROFILE>;

export default function EditProfileScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: profileRes, refetch: refetchProfile } = useGetUserProfileQuery();
  const backendUser = profileRes?.data;

  const isInitialized = useRef(false);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if ((backendUser || currentUser) && !isInitialized.current) {
      setDisplayName(backendUser?.displayName || currentUser?.displayName || "");
      setBio(backendUser?.bio || "");
      setPhotoURL(backendUser?.photoURL || currentUser?.photoURL || "");
      isInitialized.current = true;
    }
  }, [backendUser, currentUser]);

  const handleSelectImage = useCallback(async () => {
    try {
      const image = await ImagePicker.openPicker({
        width: 400,
        height: 400,
        cropping: true,
        cropperCircleOverlay: true,
        includeBase64: true,
        mediaType: "photo",
      });

      if (!image || !image.data) return;

      setUploadingImage(true);
      const base64Data = image.data;
      const payload = {
        file: `data:image/jpeg;base64,${base64Data}`,
        upload_preset: Config.CLOUDINARY_UPLOAD_PRESET,
      };

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${Config.CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (data.secure_url) {
        setPhotoURL(data.secure_url);
      } else {
        Alert.alert("Upload Error", data.error?.message || "Failed to upload image.");
      }
    } catch (error: any) {
      if (error.code !== "E_PICKER_CANCELLED") {
        Alert.alert("Error", error.message || "Failed to select image.");
      }
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const authUser = getAuth().currentUser;
      if (!authUser) throw new Error("No authenticated user found.");

      // 1. Update Firebase profile
      await updateProfile(authUser, {
        displayName: displayName.trim(),
        photoURL: photoURL || undefined,
      });

      // 2. Fetch Firebase ID Token
      const token = await authUser.getIdToken();

      // 3. Update MongoDB backend user record
      const res = await fetch(`${BASE_URL}/api/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          photoURL: photoURL,
          bio: bio.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update backend profile.");
      }

      // Refresh the query cache
      refetchProfile();

      // 4. Update Redux store
      dispatch(
        setCredentials({
          user: {
            uid: authUser.uid,
            email: authUser.email,
            displayName: displayName.trim(),
            photoURL: photoURL || null,
          },
          token,
        })
      );

      Alert.alert("Success", "Profile updated successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.log("Profile Save Error:", error);
      Alert.alert("Save Failed", error.message || "Could not save profile details.");
    } finally {
      setLoading(false);
    }
  }, [displayName, photoURL, bio, dispatch, navigation, refetchProfile]);

  return (
    <Screen scrollable={true} keyboardAvoiding={true}>
      <Header title="Edit Profile" showBack={true} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarGlow} />
              <LinearGradient
                colors={["#7C3AED", "#6A25F4", "#3B82F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatar}>
                  {uploadingImage ? (
                    <ActivityIndicator size="large" color={colors.neon.purple} />
                  ) : photoURL ? (
                    <Image source={{ uri: photoURL }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={44} color={colors.text.primary} />
                  )}
                </View>
              </LinearGradient>
              <TouchableOpacity
                style={styles.editAvatarBtn}
                activeOpacity={0.8}
                onPress={handleSelectImage}
                disabled={uploadingImage}
              >
                <LinearGradient
                  colors={[colors.neon.purple, "#8B5CF6"]}
                  style={styles.editAvatarGradient}
                >
                  <Feather name="camera" size={14} color={colors.text.primary} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </View>

          {/* Form Fields Card */}
          <View style={styles.card}>
            {/* Display Name Input */}
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputContainer}>
              <Feather name="user" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter Full Name"
                placeholderTextColor={colors.text.tertiary}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            {/* Email (Read Only) */}
            <Text style={styles.label}>Email Address (Read-only)</Text>
            <View style={[styles.inputContainer, styles.readOnlyInput]}>
              <Feather name="mail" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text.tertiary }]}
                value={currentUser?.email || ""}
                editable={false}
              />
            </View>

            {/* Bio Input */}
            <Text style={styles.label}>Bio</Text>
            <View style={[styles.inputContainer, styles.bioInputContainer]}>
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Write a short bio..."
                placeholderTextColor={colors.text.tertiary}
                multiline={true}
                numberOfLines={4}
                maxLength={200}
                value={bio}
                onChangeText={setBio}
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || uploadingImage}
            activeOpacity={0.8}
            style={[
              styles.saveBtnWrapper,
              (loading || uploadingImage) && { opacity: 0.5 },
            ]}
          >
            <LinearGradient
              colors={[colors.neon.purple, colors.neon.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
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
  avatarSection: {
    alignItems: "center",
    marginBottom: spacing.xl + 4,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: spacing.md,
  },
  avatarGlow: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 70,
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    ...Platform.select({
      ios: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
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
    overflow: "hidden",
  },
  editAvatarGradient: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: {
    color: colors.neon.purple,
    fontSize: typography.size.sm + 1,
    fontWeight: typography.weight.semiBold,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: spacing.xl,
    marginBottom: spacing.xl,
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
  readOnlyInput: {
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    borderColor: "rgba(255, 255, 255, 0.03)",
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.base,
  },
  bioInputContainer: {
    height: 100,
    paddingVertical: spacing.sm,
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  bioInput: {
    height: "100%",
  },
  charCount: {
    color: colors.text.tertiary,
    fontSize: typography.size.xs,
    alignSelf: "flex-end",
    marginRight: 4,
    marginBottom: spacing.sm,
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
