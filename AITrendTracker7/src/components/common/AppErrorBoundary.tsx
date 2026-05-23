/**
 * TrendPulse App Error Boundary
 * Premium recovery view that wraps main navigation to prevent absolute screen blackouts.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled crash caught:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.glow} />
          
          <Feather name="alert-triangle" size={64} color={colors.neon.red} style={styles.icon} />
          
          <Text style={styles.title}>System Interrupted</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred while rendering the trend dashboard. Let's reset the active view to recover.
          </Text>
          
          {this.state.error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText} numberOfLines={4}>
                {this.state.error.toString()}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Restart Dashboard</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing.xl,
  },
  glow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    filter: 'blur(50px)',
  },
  icon: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  errorCard: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.cardRadius - 4,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    marginBottom: spacing.xl,
  },
  errorText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.neon.pink,
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    backgroundColor: colors.neon.purple,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: spacing.buttonRadius,
    shadowColor: colors.neon.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: colors.text.primary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.base,
  },
});
import { Platform } from 'react-native';
