import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Feather from 'react-native-vector-icons/Feather';

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected === false);
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={16} color="#FFF" style={{ marginRight: 8 }} />
      <Text style={styles.text}>You are currently offline. Viewing cached data.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#ef4444',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999, // ensures it sits on top of everything
  },
  text: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
