/**
 * TrendPulse Enforced Standard Header Component
 * Enforces spacing design tokens, typography weight, back button behavior, and custom operations.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
}

export default function Header({
  title,
  showBack = true,
  onBack,
  rightComponent,
}: HeaderProps) {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}

      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      {rightComponent ? (
        <View style={styles.rightComponentContainer}>{rightComponent}</View>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    height: layout.HEADER_HEIGHT,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.overlay.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg + 2,
    fontWeight: typography.weight.bold,
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 44,
  },
  rightComponentContainer: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
