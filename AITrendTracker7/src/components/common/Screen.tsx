/**
 * TrendPulse Shared Screen Wrapper Component
 * Enforces unified layouts, status bar settings, scrolling, and keyboard avoiding capabilities.
 */
import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ScrollViewProps,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/layout';

interface ScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
  safeAreaEdges?: Edge[];
  keyboardAvoiding?: boolean;
  statusBarBg?: string;
  barStyle?: 'light-content' | 'dark-content' | 'default';
  statusBarTranslucent?: boolean;
  keyboardVerticalOffset?: number;
  scrollViewProps?: Partial<ScrollViewProps>;
  bottomOffset?: number;
}

export function Screen({
  children,
  style,
  contentContainerStyle,
  scrollable = false,
  safeAreaEdges = ['top', 'left', 'right'],
  keyboardAvoiding = true,
  statusBarBg = 'transparent',
  barStyle = 'light-content',
  statusBarTranslucent = true,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 0 : 0,
  scrollViewProps,
  bottomOffset = layout.BOTTOM_TAB_OVERLAP_PADDING,
}: ScreenProps) {
  
  const Container = safeAreaEdges.length > 0 ? SafeAreaView : View;
  const containerProps = safeAreaEdges.length > 0 ? { edges: safeAreaEdges } : {};

  const content = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollViewProps}
      style={[styles.scrollView, style]}
      contentContainerStyle={[
        styles.scrollContent,
        contentContainerStyle,
        bottomOffset !== undefined ? { paddingBottom: bottomOffset } : null
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.staticContent, style, contentContainerStyle]}>
      {children}
    </View>
  );

  const wrappedContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={styles.keyboardContainer}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <Container {...containerProps} style={styles.container}>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={statusBarBg}
        translucent={statusBarTranslucent}
      />
      {wrappedContent}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: layout.BOTTOM_TAB_OVERLAP_PADDING,
  },
  staticContent: {
    flex: 1,
  },
});
