import React, { createContext, useState, useRef } from 'react';
import { Audio } from 'expo-av';

export const AlarmContext = createContext<any>(null);

export const AlarmProvider = ({ children }: { children: React.ReactNode }) => {
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmTickets, setAlarmTickets] = useState<string[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);

  const triggerAlarm = async (ticketIds: string[]) => {
    setAlarmTickets(ticketIds);
    setAlarmActive(true);
    try {
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          // Ignore unload errors
        }
      }
      const { sound } = await Audio.Sound.createAsync(
         require('../../assets/message_alert.mp3')
      );
      soundRef.current = sound;
      
      let loopCount = 0;
      sound.setOnPlaybackStatusUpdate((status) => {
         if (status.isLoaded && status.didJustFinish) {
           loopCount++;
           if (loopCount < 2) {
             sound.replayAsync();
           } else {
             sound.stopAsync();
             setAlarmActive(false);
           }
         }
      });
      
      await sound.setVolumeAsync(1.0);
      await sound.playAsync();
    } catch (e: any) {
      console.error("Error playing sound. This is usually due to browser autoplay policies requiring a user click first.", e);
    }
  };

  const stopAlarm = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
    }
    setAlarmActive(false);
  };

  return (
    <AlarmContext.Provider value={{ alarmActive, alarmTickets, triggerAlarm, stopAlarm }}>
      {children}
    </AlarmContext.Provider>
  );
};
