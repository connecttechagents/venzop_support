import { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

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
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState('All');
  const [issueFilter, setIssueFilter] = useState('All');
  const [assignFilter, setAssignFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  const agentId = 'current_agent_id'; // Mock agent ID for now

  const isInitialLoad = useRef(true);

  useEffect(() => {
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
            await sound.playAsync();
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
    return true;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'OPEN': return styles.statusOpen;
      case 'IN_PROGRESS': return styles.statusProgress;
      case 'PENDING_CUSTOMER': return styles.statusPending;
      case 'REOPENED': return styles.statusReopened;
      case 'CLOSED':
      case 'INVALID':
        return styles.statusClosed;
      default: return styles.statusOpen;
    }
  };

  const getCardStyle = (status: string) => {
    switch (status) {
      case 'OPEN': return styles.cardOpen;
      case 'IN_PROGRESS': return styles.cardProgress;
      case 'PENDING_CUSTOMER': return styles.cardPending;
      case 'REOPENED': return styles.cardReopened;
      case 'CLOSED':
      case 'INVALID':
        return styles.cardClosed;
      default: return styles.cardOpen;
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Venzop Agent</Text>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterToggle}>
            <Text style={styles.filterToggleText}>{showFilters ? 'Hide Filters' : 'Filters ▾'}</Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filterLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {['All', 'OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'CLOSED'].map(s => (
                <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>Issue Type:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {['All', 'Payment', 'Hardware', 'General'].map(s => (
                <TouchableOpacity key={s} onPress={() => setIssueFilter(s)} style={[styles.filterChip, issueFilter === s && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, issueFilter === s && styles.filterChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>Assignment:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {['All', 'Me', 'Unassigned'].map(s => (
                <TouchableOpacity key={s} onPress={() => setAssignFilter(s)} style={[styles.filterChip, assignFilter === s && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, assignFilter === s && styles.filterChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sortContainer}>
               <Text style={styles.filterLabel}>Sort Order:</Text>
               <TouchableOpacity onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} style={styles.sortToggle}>
                  <Text style={styles.sortToggleText}>{sortOrder === 'desc' ? 'Newest First ↓' : 'Oldest First ↑'}</Text>
               </TouchableOpacity>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
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
  cardOpen: {
    backgroundColor: '#f0fdf4',
  },
  cardProgress: {
    backgroundColor: '#eff6ff',
  },
  cardPending: {
    backgroundColor: '#fefce8',
  },
  cardReopened: {
    backgroundColor: '#fff7ed',
  },
  cardClosed: {
    backgroundColor: '#f8fafc',
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
  statusOpen: {
    backgroundColor: '#dcfce7',
  },
  statusProgress: {
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
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  filtersContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
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
