import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../';

// Mirrors Notification Mongoose schema enum exactly.
// Previous values 'MAJOR_BREAKOUT' | 'MILD_SPIKE' do not exist in the DB.
export type NotificationType =
  | 'hot_trend'
  | 'multi_source'
  | 'viral_spike'
  | 'system'
  | 'rising'
  | 'breaking'
  | 'community'
  | 'video';

export interface NotificationPayload {
  // _id is used for REST responses (MongoDB ObjectId string).
  // id is used for socket-pushed alerts generated in-app.
  id: string;
  _id?: string;
  title: string;
  message: string;
  type: NotificationType;
  trendId?: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationsState {
  alerts: NotificationPayload[];
  unreadCount: number;
}

const initialState: NotificationsState = {
  alerts: [],
  unreadCount: 0,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addSystemAlert: (state, action: PayloadAction<Omit<NotificationPayload, 'read' | 'timestamp'>>) => {
      state.alerts.unshift({
        ...action.payload,
        read: false,
        timestamp: Date.now(),
      });
      state.unreadCount += 1;
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find(a => a.id === action.payload);
      if (alert && !alert.read) {
        alert.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: (state) => {
      state.alerts.forEach(a => a.read = true);
      state.unreadCount = 0;
    },
    clearAllAlerts: (state) => {
      state.alerts = [];
      state.unreadCount = 0;
    },
    // Used by HomeScreen polling (GET /api/notifications/unread-count)
    // to keep the badge accurate without fetching full notification list.
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
  },
});

export const { addSystemAlert, markAsRead, markAllAsRead, clearAllAlerts, setUnreadCount } = notificationsSlice.actions;

export const selectNotificationsState = (state: RootState) => state.notifications;
export const selectAllAlerts = createSelector(selectNotificationsState, (state) => state.alerts);
export const selectUnreadCount = createSelector(selectNotificationsState, (state) => state.unreadCount);

export default notificationsSlice.reducer;
