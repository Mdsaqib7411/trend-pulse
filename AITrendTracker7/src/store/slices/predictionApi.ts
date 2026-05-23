import { apiSlice } from '../apiSlice';

export const predictionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrendPrediction: builder.query<any, string>({
      query: (id) => `/trends/${encodeURIComponent(id)}/prediction`,
      providesTags: ['Trend'],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetTrendPredictionQuery,
} = predictionApi;
