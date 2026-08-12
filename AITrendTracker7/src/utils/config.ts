// Environment configuration
// In development (__DEV__ is true), it uses the Android Emulator localhost loopback IP
// In production, you will change the string to your actual deployed server URL

export const BASE_URL = __DEV__ 
  ? "http://127.0.0.1:5000" 
  : "https://your-production-url.com";
