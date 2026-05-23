import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface AuthState {
  uid: string | null;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  uid: null,
  displayName: null,
  email: null,
  photoURL: null,
  token: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: Partial<AuthState>; token: string }>
    ) => {
      const { user, token } = action.payload;
      state.uid = user.uid || null;
      state.displayName = user.displayName || null;
      state.email = user.email || null;
      state.photoURL = user.photoURL || null;
      state.token = token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.uid = null;
      state.displayName = null;
      state.email = null;
      state.photoURL = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectIsAuthenticated = createSelector(selectAuth, (auth) => auth.isAuthenticated);
export const selectUser = createSelector(selectAuth, (auth) => ({
  uid: auth.uid,
  displayName: auth.displayName,
  email: auth.email,
  photoURL: auth.photoURL,
}));
export const selectAuthToken = createSelector(selectAuth, (auth) => auth.token);

export default authSlice.reducer;
