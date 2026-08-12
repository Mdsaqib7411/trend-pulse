/**
 * Firebase Crashlytics & Error Telemetry Service for TrendPulse
 */
import crashlytics from '@react-native-firebase/crashlytics';

class CrashlyticsService {
  private isAvailable: boolean = true;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Enable Crashlytics collection in production/staging environments
      await crashlytics().setCrashlyticsCollectionEnabled(true);
      console.log('[CrashlyticsService] Firebase Crashlytics telemetry initialized.');
    } catch (err) {
      this.isAvailable = false;
      console.warn('[CrashlyticsService] Failed to initialize Crashlytics:', (err as Error).message);
    }
  }

  /**
   * Log custom diagnostic breadcrumbs to be attached to subsequent crash reports
   */
  log(message: string) {
    try {
      console.log(`[Crashlytics Log] ${message}`);
      if (this.isAvailable) {
        crashlytics().log(message);
      }
    } catch (e) {
      // Ignore logging failures
    }
  }

  /**
   * Record a non-fatal JS exception or component boundary error
   */
  recordError(error: Error, jsStack?: string) {
    try {
      console.error('[Crashlytics RecordError]:', error, jsStack);
      if (this.isAvailable) {
        if (jsStack) {
          crashlytics().log(`Component Stack: ${jsStack}`);
        }
        crashlytics().recordError(error);
      }
    } catch (e) {
      // Ignore fallback
    }
  }

  /**
   * Attach authenticated User Identifier to crash reports for debugging user-specific issues
   */
  setUser(userId: string, email?: string) {
    try {
      if (this.isAvailable) {
        crashlytics().setUserId(userId);
        if (email) {
          crashlytics().setAttribute('user_email', email);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Attach custom key-value attributes to crash reports
   */
  setAttribute(key: string, value: string) {
    try {
      if (this.isAvailable) {
        crashlytics().setAttribute(key, value);
      }
    } catch (e) {
      // Ignore
    }
  }
}

export const crashlyticsService = new CrashlyticsService();
