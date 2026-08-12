import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { BASE_URL } from '../utils/config';
import { ExtendedTrend } from '../types/trend';
import { getAuth } from '@react-native-firebase/auth';
import { setAuthToken } from '../utils/storage';
import { setCredentials } from './slices/authSlice';

export interface FeedResponse {
  success: boolean;
  data: ExtendedTrend[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface FeedParams {
  category?: string;
  page?: number;
  limit?: number;
}

/**
 * baseQueryWithAuth — wraps fetchBaseQuery to inject a always-valid Bearer token.
 *
 * Strategy:
 *  1. Ask Firebase for a cached (or freshly renewed) ID token.
 *     Firebase SDK handles expiry internally — no network round-trip if the
 *     token is still valid; transparent refresh only when needed.
 *  2. Keep Redux + MMKV in sync with the latest token so the rest of the app
 *     (e.g. AIChatScreen) can read it without hitting Firebase again.
 *  3. Fall back to the Redux-stored token when no Firebase user is signed in
 *     (e.g. during the very first cold-boot before onAuthStateChanged fires).
 */
const rawBaseQuery = fetchBaseQuery({ baseUrl: `${BASE_URL}/api` });

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  try {
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      // forceRefresh=false → uses Firebase's own cached token, renews only if <5 min left
      const freshToken = await currentUser.getIdToken(false);
      // Sync with Redux and MMKV so other services stay in sync
      const storeToken = (api.getState() as any).auth?.token;
      if (freshToken && freshToken !== storeToken) {
        setAuthToken(freshToken);
        api.dispatch(
          setCredentials({
            user: {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
            },
            token: freshToken,
          }),
        );
      }
      // Inject into request
      const argsWithAuth =
        typeof args === 'string'
          ? { url: args, headers: { Authorization: `Bearer ${freshToken}` } }
          : { ...args, headers: { ...(args.headers || {}), Authorization: `Bearer ${freshToken}` } };
      return rawBaseQuery(argsWithAuth, api, extraOptions);
    }
  } catch (e) {
    console.warn('[apiSlice] Failed to get fresh token from Firebase:', e);
  }
  // Fallback: use whatever token is in Redux (may be stale, but best-effort)
  const fallbackToken = (api.getState() as any).auth?.token;
  const argsWithFallback =
    typeof args === 'string'
      ? { url: args, headers: fallbackToken ? { Authorization: `Bearer ${fallbackToken}` } : {} }
      : { ...args, headers: { ...(args.headers || {}), ...(fallbackToken ? { Authorization: `Bearer ${fallbackToken}` } : {}) } };
  return rawBaseQuery(argsWithFallback, api, extraOptions);
};

export const mapBackendTrend = (item: any): ExtendedTrend => {
  const sentimentRaw: string = item.analysis?.sentiment || 'Neutral';
  const capitalizedSentiment = sentimentRaw.charAt(0).toUpperCase() + sentimentRaw.slice(1);

  // Derive sentimentScore: backend stores 0-100, safe clamp applied
  const rawSentimentScore = item.analysis?.sentimentScore;
  const sentimentScore: number | undefined =
    typeof rawSentimentScore === 'number'
      ? Math.min(100, Math.max(0, rawSentimentScore))
      : undefined;

  // Build velocityHistory from backend scoreHistory (compact snapshot array)
  // Backend schema: scoreHistory[].v = viralScore, .c = compositeScore, .g = growthScore
  // We use compositeScore (c) as the chart value; fallback to undefined so UI keeps static bars
  let velocityHistory: number[] | undefined;
  if (Array.isArray(item.scoreHistory) && item.scoreHistory.length > 0) {
    const raw: number[] = item.scoreHistory
      .slice(-7) // last 7 snapshots
      .map((snap: any) => Math.min(100, Math.max(0, snap.c ?? snap.v ?? snap.g ?? 50)));
    // Pad to exactly 7 entries with the oldest value if fewer than 7
    while (raw.length < 7) { raw.unshift(raw[0] ?? 50); }
    velocityHistory = raw;
  }

  // growthMomentum from predictions.lifecycleState (e.g. 'viral', 'accelerating', 'declining')
  const lifecycleState: string | undefined = item.predictions?.lifecycleState;
  const growthMomentum: string | undefined = lifecycleState ?? undefined;

  return {
    trendId: item.trendId || item.id || String(Math.random()),
    title: item.title || 'Untitled Trend',
    category: item.category || 'General',
    source: item.source || item.author || 'Unknown Source',
    trendScore: typeof item.trendScore === 'number' ? item.trendScore : (item.scoring?.compositeScore || 75),
    viralScore: typeof item.viralScore === 'number' ? item.viralScore : (item.scoring?.viralScore || item.trendScore || 75),
    engagementScore: typeof item.engagementScore === 'number' ? item.engagementScore : 0,
    isEmerging: typeof item.isEmerging === 'boolean' ? item.isEmerging : false,
    image: item.image || 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
    time: item.time || 'Recent',
    growth: item.growth || '+50%',
    // Sentiment — always a capitalized string, never undefined
    sentiment: capitalizedSentiment,
    sentimentScore,
    // AI enrichment fields — undefined when analysis not yet processed (safe for UI)
    aiSummary: item.analysis?.summary || item.content || item.description || '',
    whyTrending: item.analysis?.whyTrending || undefined,
    targetAudience: item.analysis?.targetAudience || undefined,
    // AI confidence: prefer isolated aiConfidence.score, fallback to analysis.confidenceScore
    aiConfidence: item.aiConfidence?.score ?? item.analysis?.confidenceScore ?? 85,
    sourceConsistency: item.aiConfidence?.sourceConsistency ?? 80,
    dataCompleteness: item.aiConfidence?.dataCompleteness ?? 85,
    // Velocity chart data from backend score history
    velocityHistory,
    growthMomentum,
    // Source URL for deep-linking
    sourceUrl: item.sourceUrl || item.url || undefined,
  };
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Trend', 'User', 'Heatmap', 'Notification'],
  endpoints: (builder) => ({
    fetchTrends: builder.query<FeedResponse, FeedParams | void>({
      query: (params) => {
        const { category = 'All' } = params || {};
        
        // Map category names to backend expected keys for optimal scraper compatibility
        let backendCategory = category;
        if (category === 'AI & Tech') {
          backendCategory = 'Technology';
        } else if (category === 'Web Dev') {
          backendCategory = 'Developer Ecosystem';
        }

        if (backendCategory === 'All' || backendCategory === 'Home') {
          return '/trends/explore';
        }
        return `/trends/category?type=${encodeURIComponent(backendCategory)}`;
      },
      transformResponse: (response: any, meta: any, arg: FeedParams | void) => {
        const { page = 1, limit = 10 } = arg || {};
        const rawData = Array.isArray(response) ? response : (response?.data || []);
        
        // Map backend trends to ExtendedTrend structure with robust fallback protection
        const mappedTrends: ExtendedTrend[] = rawData.map(mapBackendTrend);

        // Client-side pagination logic
        const total = mappedTrends.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const slicedData = mappedTrends.slice(startIndex, endIndex);
        const hasMore = endIndex < total;

        return {
          success: true,
          data: slicedData,
          pagination: {
            page,
            limit,
            total,
            hasMore,
          },
        };
      },
      providesTags: ['Trend'],
      keepUnusedDataFor: 60,
    }),
    getHomeFeed: builder.query<any, void>({
      query: () => '/trends/home',
      transformResponse: (response: any) => {
        const rawData = Array.isArray(response) ? response : (response?.data || []);
        return {
          success: true,
          data: rawData.map(mapBackendTrend),
        };
      },
      providesTags: ['Trend'],
      keepUnusedDataFor: 30, // Drop unused feed data after 30s to save heap space
    }),
    getHeatmapPayload: builder.query<any, void>({
      query: () => '/trends/heatmap',
      providesTags: ['Heatmap'],
      keepUnusedDataFor: 300, // Increased cache retention from 30s to 300s to avoid unnecessary refetches
    }),
    // Resolves the user's geographic profile (country/state/city) populated
    // by geoProfileService after the SyncGate POST /api/users/sync call.
    // NOTE: /api/users/profile does NOT exist — this is the correct route.
    getGeoProfile: builder.query<any, void>({
      query: () => '/users/geo-profile',
      providesTags: ['User'],
    }),
    getUserProfile: builder.query<any, void>({
      query: () => '/users/profile',
      providesTags: ['User'],
    }),
    registerFcmToken: builder.mutation<any, { fcmToken: string; platform: string }>({
      query: (body) => ({
        url: '/users/fcm-token',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
    getIntelligenceStats: builder.query<any, void>({
      query: () => '/system/intelligence-stats',
      providesTags: ['User'],
    }),
    getAIAnalysis: builder.query<any, string>({
      query: (trendId) => `/trends/${encodeURIComponent(trendId)}/analysis`,
      keepUnusedDataFor: 300,
    }),
    sendAIMessage: builder.mutation<any, { message: string; trendId?: string; trendContext?: any; history: any[] }>({
      query: (body) => ({
        url: '/ai/chat',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useFetchTrendsQuery,
  useGetHomeFeedQuery,
  useGetHeatmapPayloadQuery,
  useGetGeoProfileQuery,
  useGetUserProfileQuery,
  useRegisterFcmTokenMutation,
  useGetIntelligenceStatsQuery,
  useGetAIAnalysisQuery,
  useSendAIMessageMutation,
} = apiSlice;
