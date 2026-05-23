/**
 * TrendPulse — High-speed native storage via MMKV.
 * Replaces AsyncStorage for direct C++ memory-mapped performance.
 * 
 * Store is encrypted with a static app key.
 * Provides typed helpers for JSON, offline snapshots, and stale timestamps.
 */

import { createMMKV } from 'react-native-mmkv';

// Initialize encrypted MMKV store
export const storage = createMMKV({
    id: 'trendpulse-global-store',
    encryptionKey: 'trendpulse-secure-key-99'
});

// --- Typed Helpers ---

export function setJSON(key: string, value: any): void {
    storage.set(key, JSON.stringify(value));
}

export function getJSON<T = any>(key: string): T | null {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function remove(key: string): void {
    storage.remove(key);
}

// --- Offline Snapshot Helpers ---

const OFFLINE_HOME_KEY = 'trendpulse:offline:home';
const OFFLINE_STALE_KEY = 'trendpulse:offline:staleTimestamp';

/**
 * Persist the raw JSON trend feed to MMKV for offline access.
 */
export function cacheHomeFeed(trends: any[]): void {
    setJSON(OFFLINE_HOME_KEY, trends);
    storage.set(OFFLINE_STALE_KEY, Date.now().toString());
}

/**
 * Retrieve cached offline feed and its staleness.
 */
export function getCachedHomeFeed(): { data: any[] | null; staleTimestamp: number } {
    const data = getJSON<any[]>(OFFLINE_HOME_KEY);
    const ts = storage.getString(OFFLINE_STALE_KEY);
    return {
        data,
        staleTimestamp: ts ? parseInt(ts, 10) : 0
    };
}

/**
 * Check if the cached feed is stale (older than given ms).
 */
export function isCacheStale(maxAgeMs: number = 5 * 60 * 1000): boolean {
    const ts = storage.getString(OFFLINE_STALE_KEY);
    if (!ts) return true;
    return (Date.now() - parseInt(ts, 10)) > maxAgeMs;
}

// --- Auth Token Cache ---

export function setAuthToken(token: string): void {
    storage.set('trendpulse:auth:token', token);
}

export function getAuthToken(): string | undefined {
    return storage.getString('trendpulse:auth:token');
}

export function clearAuth(): void {
    storage.remove('trendpulse:auth:token');
    storage.remove('trendpulse:user:profile');
}

// --- User Profile Cache ---

export function setUserProfile(profile: any): void {
    setJSON('trendpulse:user:profile', profile);
}

export function getUserProfile(): any {
    return getJSON('trendpulse:user:profile');
}
