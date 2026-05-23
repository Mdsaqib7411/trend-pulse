import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import BootSplash from 'react-native-bootsplash';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store, persistor } from './src/store';
import AuthGate from './src/navigation/AuthGate';
import { ToastProvider } from './src/context/ToastProvider';
import { AppErrorBoundary } from './src/components/common/AppErrorBoundary';
import { OfflineBanner } from './src/components/common/OfflineBanner';
import { socketService } from './src/services/socketService';
import { SyncGate } from './src/components/common/SyncGate';

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Initial connection
    socketService.connect();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[App] App has come to the foreground! Reconnecting sockets...');
        socketService.connect();
        // Here we could also dispatch an RTK Query invalidateTags to refetch fresh data
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('[App] App has gone to the background. Freezing resources...');
        socketService.disconnect();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      socketService.disconnect();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              {/* SyncGate lives inside Provider+PersistGate so useAppDispatch works
                  and persisted state is rehydrated before the first sync fires. */}
              <SyncGate>
                <ToastProvider>
                  <OfflineBanner />
                  <NavigationContainer onReady={() => BootSplash.hide({ fade: true })}>
                    <AuthGate />
                  </NavigationContainer>
                </ToastProvider>
              </SyncGate>
            </PersistGate>
          </Provider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}