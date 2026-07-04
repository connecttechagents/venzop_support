import { Stack } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { AlarmProvider, AlarmContext } from '../context/AlarmContext';
import { useContext } from 'react';

function GlobalBanner() {
  const { alarmActive, alarmTickets, stopAlarm } = useContext(AlarmContext);
  if (!alarmActive) return null;
  return (
    <View style={styles.alarmBanner}>
      <Text style={styles.alarmText}>🔔 Incoming Message on Ticket(s): #{alarmTickets.join(', #')}</Text>
      <TouchableOpacity onPress={stopAlarm} style={styles.alarmButton}>
        <Text style={styles.alarmButtonText}>Stop Alarm</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AlarmProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="chat/[ticketId]" />
        </Stack>
        <GlobalBanner />
      </View>
    </AlarmProvider>
  );
}

const styles = StyleSheet.create({
  alarmBanner: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10
  },
  alarmText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16
  },
  alarmButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  alarmButtonText: {
    color: '#ef4444',
    fontWeight: 'bold'
  },
});
