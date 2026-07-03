import { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Picker } from '@react-native-picker/picker';
import { BlurView } from 'expo-blur';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

interface Ticket {
  id: string;
  status: string;
  machineId: string;
  createdAt: any;
  machine: {
    location: string;
  };
}

export default function TicketDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [machines, setMachines] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState('All');
  const [issueFilter, setIssueFilter] = useState('All');
  const [assignFilter, setAssignFilter] = useState('All');
  const [machineFilter, setMachineFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  const agentId = 'current_agent_id'; // Mock agent ID for now
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const enableNotifications = async () => {
    try {
      const supported = await isSupported();
      if (!supported) {
        alert("Push notifications are not supported in this browser.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const messaging = getMessaging();
        const token = await getToken(messaging, {
          vapidKey: process.env.EXPO_PUBLIC_VAPID_KEY || 'BPamwgenEOHlJ-zASpfkCZpK_Qe6zXewFLFDW4MCz_uQ744V-fkHmXl8mDFmAfT1Lt4-S0CL-6C-cCIgYRYboJs'
        });
        if (token) {
          // Save to firestore
          await setDoc(doc(db, 'agentFcmTokens', agentId), {
            token: token,
            updatedAt: new Date()
          });
          setNotificationsEnabled(true);
          alert('Notifications Enabled successfully!');
        } else {
          alert('Failed to get push token.');
        }
      } else {
        alert('Notification permission denied.');
      }
    } catch (error: any) {
      console.error(error);
      alert('Error enabling notifications: ' + (error?.message || error));
    }
  };

  const isInitialLoad = useRef(true);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const snap = await getDocs(collection(db, 'machines'));
        const mList: any[] = [];
        snap.forEach(doc => mList.push({ id: doc.id, ...doc.data() }));
        setMachines(mList);
      } catch (e) {
        console.error("Error fetching machines", e);
      }
    };
    fetchMachines();

    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedTickets: Ticket[] = [];
      snapshot.forEach((doc) => {
        fetchedTickets.push({ id: doc.id, ...doc.data() } as Ticket);
      });
      setTickets(fetchedTickets);
      setLoading(false);
      setErrorMsg(null);

      if (!isInitialLoad.current) {
        let shouldBeep = false;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            shouldBeep = true;
          } else if (change.type === 'modified') {
            const data = change.doc.data();
            if (data.lastMessageBy === 'CUSTOMER') {
              shouldBeep = true;
            }
          }
        });

        if (shouldBeep) {
          try {
            const { sound } = await Audio.Sound.createAsync(
               require('../../assets/beep.wav')
            );
            await sound.setVolumeAsync(1.0);
            await sound.playAsync();
            
            // Double beep for attention
            setTimeout(async () => {
              try {
                await sound.replayAsync();
              } catch (err) {
                console.error("Error on second beep", err);
              }
            }, 600);
          } catch (e) {
            console.error("Error playing sound", e);
          }
        }
      } else {
        isInitialLoad.current = false;
      }
    }, (error) => {
      console.error(error);
      setErrorMsg(error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (issueFilter !== 'All' && (t as any).issueType !== issueFilter) return false;
    if (assignFilter === 'Me' && (t as any).agentId !== agentId) return false;
    if (assignFilter === 'Unassigned' && (t as any).agentId) return false;
    if (machineFilter !== 'All' && t.machineId !== machineFilter) return false;
    return true;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'NEW': return styles.statusNew;
      case 'WORKING': return styles.statusWorking;
      case 'PENDING_CUSTOMER': return styles.statusPending;
      case 'REOPENED': return styles.statusReopened;
      case 'CLOSED':
      case 'INVALID':
        return styles.statusClosed;
      default: return styles.statusNew;
    }
  };

  const getCardStyle = (status: string) => {
    switch(status) {
      case 'NEW': return styles.cardNew;
      case 'WORKING': return styles.cardWorking;
      case 'PENDING_CUSTOMER': return styles.cardPending;
      case 'REOPENED': return styles.cardReopened;
      case 'CLOSED':
      case 'INVALID':
        return styles.cardClosed;
      default: return styles.cardNew;
    }
  };

  const renderItem = ({ item }: { item: Ticket }) => {
    const isUnread = (item as any).lastMessageBy === 'CUSTOMER';
    return (
      <TouchableOpacity
        style={[styles.card, getCardStyle(item.status), isUnread && styles.cardUnread]}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.machineLocation}>
                {`${item.machineId}-${(item as any).machineName || 'Unknown'}-${(item as any).location || 'Unknown Location'}`}
              </Text>
              {isUnread && <View style={styles.unreadDot} />}
            </View>
            {(item as any).issueType && <Text style={styles.issueTypeLabel}>{(item as any).issueType}</Text>}
          </View>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.ticketId}>Ticket #{(item as any).ticketNumber || item.id.slice(0, 8)}</Text>
        <Text style={styles.time}>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Just now'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BlurView intensity={60} tint="dark" style={styles.header}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
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
            <Text style={styles.headerTitle}>Venzop Agent</Text>
            {!notificationsEnabled && (
              <TouchableOpacity onPress={enableNotifications} style={{marginLeft: 12, backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4}}>
                <Text style={{color: '#fff', fontSize: 12, fontWeight: 'bold'}}>Enable Notifications</Text>
              </TouchableOpacity>
            )}
            <View style={{flexDirection: 'row', marginLeft: 16, gap: 8}}>
              <TouchableOpacity onPress={() => router.push('/admin/qrcodes')} style={{backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4}}>
                <Text style={{color: '#cbd5e1', fontSize: 12, fontWeight: 'bold'}}>QR Codes</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/admin/quick-replies')} style={{backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4}}>
                <Text style={{color: '#cbd5e1', fontSize: 12, fontWeight: 'bold'}}>Quick Replies</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterToggle}>
            <Text style={styles.filterToggleText}>{showFilters ? 'Hide Filters' : 'Filters ▾'}</Text>
          </TouchableOpacity>
          </View>
        </BlurView>

        {showFilters && (
          <View style={[styles.filtersContainer, { padding: 10, gap: 10 }]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              
              <View style={{ flex: 1, minWidth: 140 }}>
                <Text style={styles.filterLabel}>Machine:</Text>
                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                  <Picker
                    selectedValue={machineFilter}
                    onValueChange={(itemValue) => setMachineFilter(itemValue)}
                    style={{ height: 40, border: 'none', backgroundColor: 'transparent' }}
                  >
                    <Picker.Item label="All" value="All" />
                    {machines.map(m => (
                      <Picker.Item key={m.id} label={`${m.id} - ${m.name || 'Unknown'}`} value={m.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 140 }}>
                <Text style={styles.filterLabel}>Status:</Text>
                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                  <Picker
                    selectedValue={statusFilter}
                    onValueChange={(itemValue) => setStatusFilter(itemValue)}
                    style={{ height: 40, border: 'none', backgroundColor: 'transparent' }}
                  >
                    <Picker.Item label="All Status" value="All" />
                    {['NEW', 'WORKING', 'PENDING_CUSTOMER', 'CLOSED'].map(s => (
                      <Picker.Item key={s} label={s.replace('_', ' ')} value={s} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 140 }}>
                <Text style={styles.filterLabel}>Issue Type:</Text>
                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                  <Picker
                    selectedValue={issueFilter}
                    onValueChange={(itemValue) => setIssueFilter(itemValue)}
                    style={{ height: 40, border: 'none', backgroundColor: 'transparent' }}
                  >
                    {['All', 'Payment', 'Hardware', 'General'].map(s => (
                      <Picker.Item key={s} label={s} value={s} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 140 }}>
                <Text style={styles.filterLabel}>Assignment:</Text>
                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                  <Picker
                    selectedValue={assignFilter}
                    onValueChange={(itemValue) => setAssignFilter(itemValue)}
                    style={{ height: 40, border: 'none', backgroundColor: 'transparent' }}
                  >
                    {['All', 'Me', 'Unassigned'].map(s => (
                      <Picker.Item key={s} label={s} value={s} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 140 }}>
                <Text style={styles.filterLabel}>Sort Order:</Text>
                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                  <Picker
                    selectedValue={sortOrder}
                    onValueChange={(itemValue) => setSortOrder(itemValue)}
                    style={{ height: 40, border: 'none', backgroundColor: 'transparent' }}
                  >
                    <Picker.Item label="Newest First ↓" value="desc" />
                    <Picker.Item label="Oldest First ↑" value="asc" />
                  </Picker>
                </View>
              </View>

            </View>
          </View>
        )}
      </View>
      {errorMsg ? (
        <Text style={{color: 'red', padding: 20}}>Error loading tickets: {errorMsg}</Text>
      ) : loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={sortedTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No active tickets.</Text>}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardUnread: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  cardNew: {
    backgroundColor: '#fee2e2',
  },
  cardWorking: {
    backgroundColor: '#dbeafe',
  },
  cardPending: {
    backgroundColor: '#fefce8',
  },
  cardReopened: {
    backgroundColor: '#fff7ed',
  },
  cardClosed: {
    backgroundColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  machineLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  issueTypeLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusNew: {
    backgroundColor: '#fecaca',
  },
  statusWorking: {
    backgroundColor: '#dbeafe',
  },
  statusPending: {
    backgroundColor: '#fef9c3',
  },
  statusReopened: {
    backgroundColor: '#ffedd5',
  },
  statusClosed: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  ticketId: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 20,
  },
  filterToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
  },
  filterToggleText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  filtersContainer: {
    marginTop: 16,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  sortToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
  },
  sortToggleText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
});
