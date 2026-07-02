import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Image, ActivityIndicator, Linking, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface Message {
  id: string;
  text: string;
  senderId: string;
  sender: {
    role: string;
    name?: string;
  };
  createdAt: string;
  imageUrl?: string;
}

export default function ChatScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [ticket, setTicket] = useState<{status?: string, agentId?: string, ticketNumber?: number, issueType?: string, machineId?: string, customerId?: string}>({});
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const agentId = 'current_agent_id';

  useEffect(() => {
    const ticketRef = doc(db, 'tickets', ticketId);
    const unsubscribeTicket = onSnapshot(ticketRef, async (docSnap) => {
      if (docSnap.exists()) {
        const tData = docSnap.data() as any;
        setTicket(tData);
        if (tData.customerId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', tData.customerId));
            if (userDoc.exists()) {
              setCustomerPhone(userDoc.data().mobileNumber || '');
            }
          } catch (e) { console.error("Error fetching user", e); }
        }
      }
    });

    const q = query(collection(db, `tickets/${ticketId}/messages`), orderBy('createdAt', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => msgs.push({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
    const qReplies = query(collection(db, 'quick_replies'));
    const unsubscribeReplies = onSnapshot(qReplies, (snapshot) => {
      const replies: any[] = [];
      snapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
      setQuickReplies(replies);
    });

    return () => {
      unsubscribeTicket();
      unsubscribeMessages();
      unsubscribeReplies();
    };
  }, [ticketId]);

  useEffect(() => {
    if (ticket.status === 'NEW') {
      updateDoc(doc(db, 'tickets', ticketId), {
        status: 'WORKING',
        agentId: agentId
      }).catch(console.error);
    }
  }, [ticket.status, ticketId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const messageText = newMessage;
    setNewMessage('');
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        lastMessageBy: 'AGENT'
      });
      await addDoc(collection(db, `tickets/${ticketId}/messages`), {
        text: messageText,
        senderId: agentId,
        sender: { role: 'AGENT' },
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const localUri = result.assets[0].uri;
        const filename = localUri.split('/').pop() || 'photo.jpg';

        const response = await fetch(localUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `uploads/${Date.now()}_${filename}`);
        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on('state_changed', null, (error) => {
          console.error(error);
          setIsUploading(false);
        }, async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, 'tickets', ticketId), {
            lastMessageBy: 'AGENT'
          });
          await addDoc(collection(db, `tickets/${ticketId}/messages`), {
            text: '',
            imageUrl: downloadURL,
            senderId: agentId,
            sender: { role: 'AGENT' },
            createdAt: serverTimestamp()
          });
          setIsUploading(false);
        });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      setIsUploading(false);
    }
  };

  const handleAssignTicket = async () => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { agentId });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { status });
      setShowStatusPicker(false);
      if (status === 'CLOSED') router.push('/');
    } catch (e) {
      console.error(e);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender.role === 'AGENT'; // Assuming agent is using this app
    const isBot = item.sender.role === 'BOT';

    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : isBot ? styles.botBubble : styles.customerBubble]}>
        {!isMe && <Text style={styles.senderName}>{isBot ? 'System Auto-Reply' : 'Customer'}</Text>}
        {item.imageUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.imageUrl!)}>
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
          </TouchableOpacity>
        ) : null}
        {item.text ? <Text style={[styles.messageText, isMe ? styles.myMessageText : null]}>{item.text}</Text> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton}>
            <Text style={[styles.backButtonText, { fontSize: 22, fontWeight: 'bold' }]}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle}>#{ticket.ticketNumber || ticketId?.slice(0, 8)}</Text>
              {customerPhone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${customerPhone.replace(/\D/g, '')}`)}>
                  <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: 'bold', textDecorationLine: 'underline' }}>{customerPhone} (WhatsApp)</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={{ marginTop: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1e293b' }}>
                {ticket.issueType} - {ticket.subIssueType}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>
                {`${ticket.machineId || ''} • ${(ticket as any).machineName || 'Unknown'} • ${(ticket as any).location || 'Unknown Location'}`}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {ticket.agentId !== agentId && (
              <TouchableOpacity onPress={handleAssignTicket} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Assign</Text>
              </TouchableOpacity>
            )}
            {ticket.status !== 'CLOSED' && (
              <TouchableOpacity onPress={() => handleUpdateStatus('CLOSED')} style={[styles.actionButton, { backgroundColor: '#ef4444', marginRight: 4 }]}>
                <Text style={[styles.actionButtonText, { color: 'white' }]}>Close</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowStatusPicker(!showStatusPicker)} style={[styles.actionButton, styles.statusChangeButton]}>
              <Text style={styles.actionButtonText}>{ticket.status || 'Status'} ▾</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showStatusPicker && (
          <View style={styles.statusDropdown}>
            {['NEW', 'WORKING', 'PENDING_CUSTOMER', 'CLOSED', 'INVALID'].map(s => (
              <TouchableOpacity key={s} onPress={() => handleUpdateStatus(s)} style={styles.statusOption}>
                <Text style={[styles.statusOptionText, ticket.status === s && styles.statusOptionActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputWrapper}>
          {(newMessage.startsWith('/') || newMessage.startsWith('\\')) && (
            <View style={styles.slashCommandDropdown}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {(() => {
                  const queryText = newMessage.substring(1).toLowerCase();
                  const matched = quickReplies.filter(qr => {
                    const matchesQuery = qr.trigger.toLowerCase().includes(queryText) || qr.category.toLowerCase().includes(queryText);
                    if (!matchesQuery) return false;
                    
                    const ticketStatus = ticket.status || 'NEW';
                    const ticketIssue = (ticket as any).issueType || 'General';
                    
                    const qrStatuses = qr.statuses || ['ALL'];
                    const qrIssues = qr.issueTypes || ['ALL'];
                    
                    const statusMatch = qrStatuses.includes('ALL') || qrStatuses.includes(ticketStatus);
                    const issueMatch = qrIssues.includes('ALL') || qrIssues.includes(ticketIssue);
                    
                    return statusMatch && issueMatch;
                  });
                  
                  if (matched.length === 0) {
                    return <Text style={styles.noMatchText}>No matching quick replies found</Text>;
                  }

                  return matched.map((qr, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={styles.slashCommandItem} 
                      onPress={() => setNewMessage(qr.text)}
                    >
                      <Text style={styles.slashCommandTrigger}>/{qr.trigger} <Text style={styles.slashCommandCategory}>• {qr.category}</Text></Text>
                      <Text style={styles.slashCommandPreview} numberOfLines={1}>{qr.text}</Text>
                    </TouchableOpacity>
                  ));
                })()}
              </ScrollView>
            </View>
          )}
          <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={handleImageUpload} disabled={isUploading}>
            {isUploading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Text style={styles.attachIcon}>+</Text>
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type your reply..."
            placeholderTextColor="#94a3b8"
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!newMessage.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  messageList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  customerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#334155',
  },
  myMessageText: {
    color: '#ffffff',
  },
  inputWrapper: {
    position: 'relative',
  },
  slashCommandDropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: 200,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  slashCommandItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  slashCommandTrigger: {
    fontWeight: 'bold',
    color: '#2563eb',
    fontSize: 14,
    marginBottom: 2,
  },
  slashCommandCategory: {
    fontWeight: 'normal',
    color: '#64748b',
    fontSize: 12,
  },
  slashCommandPreview: {
    color: '#475569',
    fontSize: 13,
  },
  noMatchText: {
    padding: 16,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#0f172a',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  attachIcon: {
    fontSize: 24,
    color: '#475569',
    fontWeight: '300',
    lineHeight: 28,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeButton: {
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  statusChangeButton: {
    backgroundColor: '#64748b',
    marginLeft: 8,
  },
  statusDropdown: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
  },
  statusOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusOptionText: {
    color: '#334155',
    fontWeight: '500',
  },
  statusOptionActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
