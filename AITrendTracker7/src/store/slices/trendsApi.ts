import { apiSlice } from '../apiSlice';

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
    getTrending: builder.query<{ success: boolean; data: Trend[] }, string>({
      query: (tab) => {
        let endpoint = '/trends/explore';
        if (tab === 'For You') endpoint = '/trends/foryou';
        else if (tab === 'Emerging') endpoint = '/trends/emerging';
        return endpoint;
      },
      providesTags: ['Trend'],
    }),
    getForYou: builder.query<{ success: boolean; data: Trend[] }, void>({
      query: () => '/trends/foryou',
      providesTags: ['Trend'],
    }),
    searchTrends: builder.query<{ success: boolean; data: Trend[] }, string>({
      query: (query) => `/trends/search?q=${encodeURIComponent(query)}`,
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
    getCategoryTrends: builder.query<{ success: boolean; data: Trend[] }, string>({
      query: (category) => category === 'All' ? '/trends/explore' : `/trends/category?type=${encodeURIComponent(category)}`,
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
} = trendsApi;
