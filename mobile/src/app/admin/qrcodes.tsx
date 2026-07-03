import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';

const MACHINES = [
  { id: 'M1', location: 'Airport Terminal 1, Gate C', name: 'Vending Machine A' },
  { id: 'M2', location: 'Mall of America, Level 2', name: 'Vending Machine B' },
  { id: 'M3', location: 'Central Train Station', name: 'Vending Machine C' }
];

export default function AdminQRCodes() {
  const router = useRouter();
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [machines, setMachines] = useState(MACHINES);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const getBaseUrl = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin.replace('agent', 'support');
    }
    return 'https://support.venzop.com';
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      for (const machine of machines) {
        await setDoc(doc(db, 'machines', machine.id), {
          location: machine.location,
          name: machine.name
        });
      }
      const counterRef = doc(db, 'counters', 'tickets');
      const counterSnap = await getDoc(counterRef);
      if (!counterSnap.exists()) {
        await setDoc(counterRef, { currentId: 1000 });
      }
      setSeeded(true);
    } catch (e) {
      console.error(e);
      alert('Failed to seed database');
    } finally {
      setSeeding(false);
    }
  };

  const handleAddMachine = async () => {
    if (!newId || !newName || !newLocation) {
      alert('Please fill out all fields');
      return;
    }
    
    const newMachine = { id: newId, name: newName, location: newLocation };
    
    try {
      await setDoc(doc(db, 'machines', newId), {
        name: newName,
        location: newLocation
      });
      
      setMachines(prev => [...prev, newMachine]);
      setNewId('');
      setNewName('');
      setNewLocation('');
      alert('Machine added and saved to database successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save machine to database.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => router.push('/')} style={{marginRight: 16}}>
            <Text style={{color: '#c7df23', fontSize: 24, fontWeight: 'bold'}}>←</Text>
          </TouchableOpacity>
          <View style={{
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginRight: 12,
            borderWidth: 1.5,
            borderColor: '#c7df23',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: 'rgba(2, 6, 23, 0.6)',
          }}>
            <Text style={{ color: '#c7df23', fontWeight: '900', fontSize: 18, lineHeight: 16 }}>V</Text>
            <Text style={{ color: '#c7df23', fontWeight: '900', fontSize: 18, lineHeight: 16 }}>en</Text>
            <Text style={{ color: '#238ce5', fontWeight: '900', fontSize: 18, lineHeight: 16 }}>zop</Text>
          </View>
          <Text style={styles.headerTitle}>QR Codes Admin</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>Print these QR codes and place them on your vending machines. Customers can scan them to immediately open a support ticket for that specific location.</Text>
        
        <View style={styles.card}>
          <View style={{flex: 1, marginRight: 16}}>
            <Text style={styles.cardTitle}>Database Setup</Text>
            <Text style={styles.cardSubtitle}>Seed the Firestore database with the machines below and initialize the ticket sequence counter.</Text>
          </View>
          <TouchableOpacity 
            onPress={handleSeedDatabase} 
            disabled={seeding || seeded}
            style={[styles.button, seeded ? {backgroundColor: '#22c55e'} : {}]}
          >
            <Text style={styles.buttonText}>{seeded ? 'Seeded ✓' : seeding ? 'Seeding...' : 'Seed Database'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Custom Machine</Text>
          <View style={styles.formRow}>
            <TextInput style={styles.input} placeholder="Machine ID (e.g. M4)" value={newId} onChangeText={setNewId} placeholderTextColor="#94a3b8" />
            <TextInput style={styles.input} placeholder="Name (e.g. Snack Vending)" value={newName} onChangeText={setNewName} placeholderTextColor="#94a3b8" />
            <TextInput style={styles.input} placeholder="Location (e.g. Lobby)" value={newLocation} onChangeText={setNewLocation} placeholderTextColor="#94a3b8" />
            <TouchableOpacity onPress={handleAddMachine} style={styles.addButton}>
              <Text style={styles.buttonText}>Add & Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.grid}>
          {machines.map(machine => (
            <View key={machine.id} style={styles.gridItem}>
              <Text style={styles.machineName}>{machine.name}</Text>
              <Text style={styles.machineLocation}>{machine.location}</Text>
              <View style={styles.qrContainer}>
                <QRCode
                  value={`${getBaseUrl()}/machine/${machine.id}`}
                  size={180}
                  color="black"
                  backgroundColor="white"
                />
              </View>
              <View style={styles.urlTag}>
                <Text style={styles.urlTagText}>/machine/{machine.id}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    padding: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: Platform.OS !== 'web' ? 16 : 0,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Platform.OS !== 'web' ? 16 : 0,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  formRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    marginTop: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    marginBottom: Platform.OS !== 'web' ? 12 : 0,
  },
  addButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  gridItem: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: Platform.OS === 'web' ? '30%' : '100%',
    minWidth: 280,
    alignItems: 'center',
  },
  machineName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  machineLocation: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  qrContainer: {
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#ffffff',
  },
  urlTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  urlTagText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#475569',
  }
});
