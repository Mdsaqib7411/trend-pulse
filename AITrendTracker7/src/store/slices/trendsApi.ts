import { apiSlice, mapBackendTrend } from '../apiSlice';
import { ExtendedTrend } from '../../types/trend';

export interface Trend {
  trendId: string;
  id?: string;
  title: string;
  category: string;
  sentiment?: string;
  targetAudience?: string;
  readTime?: string;
  growth?: string;
  image?: string;
  time?: string;
  aiSummary?: string;
  url?: string;
  sourceUrl?: string;
}

export interface GraphPoint {
  month: string;
  value: number;
}

export interface RegionalData {
  region: string;
  percentage: number;
}

export interface TrendAnalytics {
  currentScore: number;
  growthRate: number;
  viralityTrend: string;
  mentionsCount: number;
  highestScore: number;
  graphData: GraphPoint[];
  regionalDistribution?: RegionalData[];
}

export const trendsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrending: builder.query<{ success: boolean; data: ExtendedTrend[] }, string>({
      query: (tab) => {
        let endpoint = '/trends/explore';
        if (tab === 'For You') endpoint = '/trends/foryou';
        else if (tab === 'Emerging') endpoint = '/trends/emerging';
        return endpoint;
      },
      transformResponse: (response: any) => {
        const rawData = Array.isArray(response) ? response : (response?.data || []);
        return {
          success: response?.success ?? true,
          data: rawData.map(mapBackendTrend)
        };
      },
      providesTags: ['Trend'],
    }),
    getForYou: builder.query<{ success: boolean; data: ExtendedTrend[] }, void>({
      query: () => '/trends/foryou',
      transformResponse: (response: any) => {
        const rawData = Array.isArray(response) ? response : (response?.data || []);
        return {
          success: response?.success ?? true,
          data: rawData.map(mapBackendTrend)
        };
      },
      providesTags: ['Trend'],
    }),
    searchTrends: builder.query<{ success: boolean; data: ExtendedTrend[] }, string>({
      query: (query) => `/trends/search?q=${encodeURIComponent(query)}`,
      transformResponse: (response: any) => {
        const rawData = Array.isArray(response) ? response : (response?.data || []);
        return {
          success: response?.success ?? true,
          data: rawData.map(mapBackendTrend)
        };
      },
      providesTags: ['Trend'],
    }),
    getTrendAnalytics: builder.query<{ success: boolean; data: TrendAnalytics }, string>({
      query: (id) => `/trends/${encodeURIComponent(id)}/analytics`,
      providesTags: ['Trend'],
    }),
    getTrendPrediction: builder.query<any, string>({
      query: (id) => `/trends/${encodeURIComponent(id)}/prediction`,
      providesTags: ['Trend'],
    }),
    getCategoryTrends: builder.query<{ success: boolean; data: ExtendedTrend[] }, string>({
      query: (category) => category === 'All' ? '/trends/explore' : `/trends/category?type=${encodeURIComponent(category)}`,
      transformResponse: (response: any) => {
        const rawData = Array.isArray(response) ? response : (response?.data || []);
        return {
          success: response?.success ?? true,
          data: rawData.map(mapBackendTrend)
        };
      },
      providesTags: ['Trend'],
    }),
    getTrendHistory: builder.query<any, { id: string; timeframe: string }>({
      query: ({ id, timeframe }) => `/trends/${encodeURIComponent(id)}/history?timeframe=${timeframe}`,
      providesTags: ['Trend'],
    }),
    getSavedTrends: builder.query<{ success: boolean; data: any[] }, void>({
      query: () => '/users/saved',
      providesTags: ['User'],
    }),
    bookmarkTrend: builder.mutation<{ success: boolean; bookmarked: boolean }, string>({
      query: (trendId) => ({
        url: '/trends/bookmark',
        method: 'POST',
        body: { trendId },
      }),
      invalidatesTags: ['User', 'Trend'],
    }),
    getTrendById: builder.query<any, string>({
      query: (id) => `/trends/${encodeURIComponent(id)}`,
      transformResponse: (response: any) => {
        const item = response?.data || response;
        return mapBackendTrend(item);
      },
      providesTags: (result, error, id) => [{ type: 'Trend', id }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetTrendingQuery,
  useGetForYouQuery,
  useSearchTrendsQuery,
  useGetTrendAnalyticsQuery,
  useGetTrendPredictionQuery,
  useGetCategoryTrendsQuery,
  useLazyGetCategoryTrendsQuery,
  useGetTrendHistoryQuery,
  useLazyGetTrendHistoryQuery,
  useGetSavedTrendsQuery,
  useBookmarkTrendMutation,
  useGetTrendByIdQuery,
} = trendsApi;
