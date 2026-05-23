import { apiSlice } from '../apiSlice';

export interface Notification {
  _id: string;
  id?: string;
  title: string;
  message: string;
  type: string;
  trendId?: string;
  createdAt: string;
  read: boolean;
}

export const notificationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<{ success: boolean; data: Notification[]; unreadCount: number }, void>({
      query: () => '/notifications',
      providesTags: ['Notification'],
    }),
    markAllNotificationsRead: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PUT',
      }),
      invalidatesTags: ['Notification'],
    }),
    clearAllNotifications: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/notifications/clear-all',
        method: 'DELETE',
      }),
      invalidatesTags: ['Notification'],
    }),
    markSingleNotificationRead: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/notifications/${encodeURIComponent(id)}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notification'],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useClearAllNotificationsMutation,
  useMarkSingleNotificationReadMutation,
} = notificationApi;
