import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import { reduxMMKVStorage } from './storage';
import { apiSlice } from './apiSlice';

// Slices
import authReducer from './slices/authSlice';
import trendsReducer from './slices/trendsSlice';
import geoReducer from './slices/geoSlice';
import notificationsReducer from './slices/notificationsSlice';
import predictionReducer from './slices/predictionSlice';
const persistConfig = {
  key: 'root_v2',
  storage: reduxMMKVStorage,
  whitelist: ['auth', 'trends'], // Only persist these slices
};

const rootReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  auth: authReducer,
  trends: trendsReducer,
  geo: geoReducer,
  notifications: notificationsReducer,
  prediction: predictionReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
