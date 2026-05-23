import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { BASE_URL } from '../utils/config';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${BASE_URL}/api`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as any).auth?.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Trend', 'User', 'Heatmap', 'Notification'],
  endpoints: (builder) => ({
    getHomeFeed: builder.query<any, void>({
      query: () => '/trends/home',
      providesTags: ['Trend'],
      keepUnusedDataFor: 30, // Drop unused feed data after 30s to save heap space
    }),
    getHeatmapPayload: builder.query<any, void>({
      query: () => '/trends/heatmap',
      providesTags: ['Heatmap'],
      keepUnusedDataFor: 30, // Extremely aggressive cache pruning for heavy map data
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
  }),
});

export const {
  useGetHomeFeedQuery,
  useGetHeatmapPayloadQuery,
  useGetGeoProfileQuery,
  useGetUserProfileQuery,
} = apiSlice;
