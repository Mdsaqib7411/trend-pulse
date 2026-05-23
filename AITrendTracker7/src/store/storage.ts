import { createMMKV } from 'react-native-mmkv';
import { Storage } from 'redux-persist';

export const storage = createMMKV({
  id: 'trendpulse-persist-store',
  encryptionKey: 'trendpulse-secure-key',
});

export const reduxMMKVStorage: Storage = {
  setItem: (key, value) => {
    storage.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key) => {
    const value = storage.getString(key);
    return Promise.resolve(value);
  },
  removeItem: (key) => {
    storage.remove(key);
    return Promise.resolve();
  },
};
