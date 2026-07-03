import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../lib/firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';

interface QuickReply {
  id: string;
  trigger: string;
  text: string;
  category: string;
  statuses: string[];
  issueTypes: string[];
}

const ALL_STATUSES = ['NEW', 'WORKING', 'PENDING_CUSTOMER', 'CLOSED', 'INVALID'];
const ALL_ISSUE_TYPES = ['Payment', 'Hardware', 'General'];

export default function AdminQuickReplies() {
  const router = useRouter();
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [trigger, setTrigger] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['ALL']);
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<string[]>(['ALL']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'quick_replies'), orderBy('trigger', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: QuickReply[] = [];
      snapshot.forEach((d) => {
        data.push({ id: d.id, ...d.data() } as QuickReply);
      });
      setReplies(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleStatus = (s: string) => {
    if (s === 'ALL') {
      setSelectedStatuses(['ALL']);
      return;
    }
    const current = selectedStatuses.filter(x => x !== 'ALL');
    if (current.includes(s)) {
      setSelectedStatuses(current.filter(x => x !== s));
    } else {
      setSelectedStatuses([...current, s]);
    }
  };

  const toggleIssueType = (i: string) => {
    if (i === 'ALL') {
      setSelectedIssueTypes(['ALL']);
      return;
    }
    const current = selectedIssueTypes.filter(x => x !== 'ALL');
    if (current.includes(i)) {
      setSelectedIssueTypes(current.filter(x => x !== i));
    } else {
      setSelectedIssueTypes([...current, i]);
    }
  };

  const handleAdd = async () => {
    if (!trigger.trim() || !text.trim() || !category.trim()) {
      alert("Trigger, Text, and Category are required");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'quick_replies'), {
        trigger: trigger.trim().toLowerCase(),
        text: text.trim(),
        category: category.trim(),
        statuses: selectedStatuses.length ? selectedStatuses : ['ALL'],
        issueTypes: selectedIssueTypes.length ? selectedIssueTypes : ['ALL']
      });
      setTrigger('');
      setText('');
      setCategory('');
      setSelectedStatuses(['ALL']);
      setSelectedIssueTypes(['ALL']);
    } catch (err) {
      console.error(err);
      alert("Failed to add quick reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to delete this quick reply?")) {
        await deleteDoc(doc(db, 'quick_replies', id));
      }
    } else {
      await deleteDoc(doc(db, 'quick_replies', id));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BlurView intensity={60} tint="dark" style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton}>
            <SymbolView 
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} 
              size={32} 
              tintColor="#c7df23"
              fallback={<Text style={{ fontSize: 32, fontWeight: '900', color: '#c7df23' }}>←</Text>}
            />
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
          <Text style={styles.headerTitle}>Quick Replies Admin</Text>
        </BlurView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {/* Add Form */}
          <View style={[styles.card, {flex: 1, minWidth: 300, alignSelf: 'flex-start'}]}>
            <Text style={styles.cardTitle}>Add New Reply</Text>
            
            <Text style={styles.label}>Trigger (No spaces, e.g. "hello")</Text>
            <View style={styles.triggerInputContainer}>
              <Text style={styles.triggerPrefix}>/</Text>
              <TextInput
                style={styles.triggerInput}
                value={trigger}
                onChangeText={(t) => setTrigger(t.replace(/\s+/g, '').toLowerCase())}
                placeholder="keyword"
                placeholderTextColor="#64748b"
              />
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={category}
                onValueChange={(itemValue) => setCategory(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Select a Category..." value="" />
                <Picker.Item label="Greeting" value="Greeting" />
                <Picker.Item label="Clarification" value="Clarification" />
                <Picker.Item label="Solution" value="Solution" />
                <Picker.Item label="Apology" value="Apology" />
                <Picker.Item label="Follow-up" value="Follow-up" />
                <Picker.Item label="Closing" value="Closing" />
                <Picker.Item label="General" value="General" />
              </Picker>
            </View>

            <Text style={styles.label}>Message Text</Text>
            <TextInput
              style={[styles.input, {height: 100, textAlignVertical: 'top'}]}
              value={text}
              onChangeText={setText}
              multiline
              placeholder="The full message to insert..."
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Target Statuses</Text>
            <View style={styles.tagGroup}>
              <TouchableOpacity
                onPress={() => toggleStatus('ALL')}
                style={[styles.tag, selectedStatuses.includes('ALL') ? styles.tagActiveStatus : styles.tagInactive]}
              >
                <Text style={[styles.tagText, selectedStatuses.includes('ALL') ? styles.tagTextActive : styles.tagTextInactive]}>ALL</Text>
              </TouchableOpacity>
              {ALL_STATUSES.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => toggleStatus(s)}
                  style={[styles.tag, selectedStatuses.includes(s) && !selectedStatuses.includes('ALL') ? styles.tagActiveStatus : styles.tagInactive]}
                >
                  <Text style={[styles.tagText, selectedStatuses.includes(s) && !selectedStatuses.includes('ALL') ? styles.tagTextActive : styles.tagTextInactive]}>{s.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Target Issue Types</Text>
            <View style={styles.tagGroup}>
              <TouchableOpacity
                onPress={() => toggleIssueType('ALL')}
                style={[styles.tag, selectedIssueTypes.includes('ALL') ? styles.tagActiveIssue : styles.tagInactive]}
              >
                <Text style={[styles.tagText, selectedIssueTypes.includes('ALL') ? styles.tagTextActive : styles.tagTextInactive]}>ALL</Text>
              </TouchableOpacity>
              {ALL_ISSUE_TYPES.map(i => (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleIssueType(i)}
                  style={[styles.tag, selectedIssueTypes.includes(i) && !selectedIssueTypes.includes('ALL') ? styles.tagActiveIssue : styles.tagInactive]}
                >
                  <Text style={[styles.tagText, selectedIssueTypes.includes(i) && !selectedIssueTypes.includes('ALL') ? styles.tagTextActive : styles.tagTextInactive]}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleAdd}
              disabled={isSubmitting}
              style={[styles.button, isSubmitting && {opacity: 0.5}, {marginTop: 16}]}
            >
              <Text style={styles.buttonText}>{isSubmitting ? 'Adding...' : 'Add Quick Reply'}</Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          <View style={[styles.card, {flex: 2, minWidth: 300}]}>
            <Text style={styles.cardTitle}>Existing Quick Replies</Text>
            
            {loading ? (
              <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 40}} />
            ) : replies.length === 0 ? (
              <Text style={styles.emptyText}>No quick replies found.</Text>
            ) : (
              <View style={styles.replyList}>
                {replies.map(r => (
                  <View key={r.id} style={styles.replyItem}>
                    <View style={{flex: 1}}>
                      <View style={styles.replyHeader}>
                        <View style={styles.triggerBadge}>
                          <Text style={styles.triggerBadgeText}>/{r.trigger}</Text>
                        </View>
                        <Text style={styles.categoryText}>• {r.category}</Text>
                      </View>
                      
                      <Text style={styles.replyText}>{r.text}</Text>
                      
                      <View style={styles.metaGroup}>
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>STATUS:</Text>
                          <View style={styles.metaTags}>
                            {(r.statuses || ['ALL']).map(s => (
                              <View key={s} style={styles.metaTag}>
                                <Text style={styles.metaTagText}>{s}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>ISSUE:</Text>
                          <View style={styles.metaTags}>
                            {(r.issueTypes || ['ALL']).map(i => (
                              <View key={i} style={styles.metaTag}>
                                <Text style={styles.metaTagText}>{i}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    </View>
                    
                    <TouchableOpacity onPress={() => handleDelete(r.id)} style={styles.deleteButton}>
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    padding: 24,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  grid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 16,
  },
  triggerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  triggerPrefix: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  triggerInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    outlineStyle: 'none'
  } as any,
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    outlineStyle: 'none'
  } as any,
  pickerContainer: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'transparent',
    color: '#ffffff',
    padding: 12,
    borderWidth: 0,
    outlineStyle: 'none'
  } as any,
  tagGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagInactive: {
    backgroundColor: '#334155',
  },
  tagActiveStatus: {
    backgroundColor: '#2563eb',
  },
  tagActiveIssue: {
    backgroundColor: '#9333ea',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagTextInactive: {
    color: '#cbd5e1',
  },
  tagTextActive: {
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    paddingVertical: 40,
    fontSize: 16,
  },
  replyList: {
    gap: 16,
  },
  replyItem: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 16,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  triggerBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  triggerBadgeText: {
    color: '#60a5fa',
    fontWeight: 'bold',
    fontSize: 14,
  },
  categoryText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  replyText: {
    color: '#e2e8f0',
    fontSize: 14,
    marginBottom: 12,
  },
  metaGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
  },
  metaTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaTag: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaTagText: {
    color: '#cbd5e1',
    fontSize: 10,
  },
  deleteButton: {
    padding: 8,
    alignSelf: Platform.OS === 'web' ? 'flex-start' : 'flex-end',
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#f87171',
    fontWeight: '600',
  }
});
