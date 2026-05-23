import React, { useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { NativeModules, Platform } from 'react-native';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials, logout } from '../../store/slices/authSlice';
import { setUserLocation } from '../../store/slices/geoSlice';
import { BASE_URL } from '../../utils/config';

// Firebase JWTs expire after 60 minutes. Refresh every 55 min with a 5 min safety margin.
const TOKEN_REFRESH_MS = 55 * 60 * 1000;

/**
 * SyncGate — mounts once at the authenticated navigator root.
 * Responsibility chain:
 *   1. onAuthStateChanged → get Firebase JWT
 *   2. dispatch setCredentials  (fixes RTK Query Bearer token gap)
 *   3. POST /api/users/sync     (creates/updates MongoDB User doc + triggers geo-resolution)
 *   4. GET /api/users/geo-profile → dispatch setUserLocation (seeds geoSlice for heatmap / emerging feeds)
 */

const getDeviceLocale = (): string => {
  try {
    return (
      NativeModules.I18nManager?.localeIdentifier ||
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
      'en_US'
    );
  } catch {
    return 'en_US';
  }
};

export function SyncGate({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const isSyncing = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clears any existing token refresh interval.
  const clearRefreshInterval = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clear any previous refresh interval when auth state changes.
      clearRefreshInterval();

      if (!firebaseUser) {
        dispatch(logout());
        return;
      }

      // Prevent concurrent sync calls on rapid auth events
      if (isSyncing.current) return;
      isSyncing.current = true;

      try {
        // ── Step 1: Mint fresh JWT, seed Redux auth ───────────────────────
        const token = await firebaseUser.getIdToken(/* forceRefresh */ false);
        dispatch(
          setCredentials({
            user: {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
            },
            token,
          })
        );

        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };

        // ── Step 2: Sync user record to MongoDB ───────────────────────────
        await fetch(`${BASE_URL}/api/users/sync`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            deviceLocale: getDeviceLocale(),
            session: {
              deviceName: Platform.select({
                ios: 'iPhone',
                android: 'Android Device',
                default: 'Mobile Device',
              }),
              platform: Platform.OS,
              lastLoginAt: new Date().toISOString(),
            },
          }),
        });

        // ── Step 3: Fetch resolved geo-profile, seed geoSlice ────────────
        const geoRes = await fetch(`${BASE_URL}/api/users/geo-profile`, { headers });
        if (geoRes.ok) {
          const { data } = await geoRes.json();
          if (data) {
            dispatch(
              setUserLocation({
                lat: data.lat ?? 0,
                lng: data.lng ?? 0,
                city: data.city,
                country: data.country,
              })
            );
          }
        }

        // ── Step 4: Schedule proactive token refresh every 55 minutes ────
        // Firebase tokens expire at 60 min; refresh early to keep RTK Query
        // Bearer header valid without any screen needing to re-authenticate.
        refreshIntervalRef.current = setInterval(async () => {
          try {
            const currentUser = getAuth().currentUser;
            if (!currentUser) return;
            const freshToken = await currentUser.getIdToken(/* forceRefresh */ true);
            dispatch(
              setCredentials({
                user: {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  displayName: currentUser.displayName,
                  photoURL: currentUser.photoURL,
                },
                token: freshToken,
              })
            );
          } catch (e) {
            console.warn('[SyncGate] Token refresh failed:', e);
          }
        }, TOKEN_REFRESH_MS);
      } catch (err) {
        // Non-fatal: token dispatch already succeeded; sync/geo are best-effort.
        console.warn('[SyncGate] Background sync failed:', err);
      } finally {
        isSyncing.current = false;
      }
    });

    return () => {
      unsub();
      clearRefreshInterval();
    };
  }, [dispatch]);

  return <>{children}</>;
}
