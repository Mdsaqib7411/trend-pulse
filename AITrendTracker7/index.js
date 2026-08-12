/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import { handleIncomingFCM } from './src/services/fcmService';

// Register background message handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Background notification received:', remoteMessage);
  handleIncomingFCM(remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
