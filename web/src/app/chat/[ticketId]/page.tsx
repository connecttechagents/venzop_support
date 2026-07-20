'use client';

import { useState, useEffect, useRef, use } from 'react';
import { db, storage } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
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

export default function ChatPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const unwrappedParams = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ticket, setTicket] = useState<{status?: string, ticketNumber?: number}>({});
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Temporary mock for the user, in a real app this would come from a session or token
  const customerId = 'current_customer_id'; // We would need a proper way to get this from local storage or context

  useEffect(() => {
    const ticketRef = doc(db, 'tickets', unwrappedParams.ticketId);
    const unsubscribeTicket = onSnapshot(ticketRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setTicket(data);
        if (typeof document !== 'undefined') {
          document.title = `Venzop Support #${data.ticketNumber || unwrappedParams.ticketId.slice(0, 8)}`;
        }
      }
    });

    const messagesRef = collection(db, `tickets/${unwrappedParams.ticketId}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => {
      unsubscribeTicket();
      unsubscribeMessages();
    };
  }, [unwrappedParams.ticketId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      // Fire notification in the background without awaiting Firestore
      fetch('/api/notifyAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `New Message on Ticket #${ticket.ticketNumber || unwrappedParams.ticketId.slice(0, 8)}`,
          body: messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
          url: `https://agent.venzop.com/chat/${unwrappedParams.ticketId}`
        })
      }).catch(console.error);

      if (ticket.status === 'CLOSED' || ticket.status === 'INVALID') {
        await updateDoc(doc(db, 'tickets', unwrappedParams.ticketId), { 
          status: 'REOPENED',
          lastMessageBy: 'CUSTOMER',
          lastMessageAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'tickets', unwrappedParams.ticketId), { 
          lastMessageBy: 'CUSTOMER',
          lastMessageAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, `tickets/${unwrappedParams.ticketId}/messages`), {
        text: messageText,
        senderId: localStorage.getItem('customerId') || 'temp-id',
        sender: { role: 'CUSTOMER' },
        createdAt: serverTimestamp()
      });

    } catch (e) {
      console.error(e);
      alert('Failed to send message.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      null, 
      (error) => {
        console.error('Failed to upload image:', error);
        alert('Failed to upload image. Please try again.');
        setIsUploading(false);
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        // Fire notification in the background without awaiting Firestore
        fetch('/api/notifyAgent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `New Image on Ticket #${ticket.ticketNumber || unwrappedParams.ticketId.slice(0, 8)}`,
            body: 'Customer uploaded an image',
            url: `https://agent.venzop.com/chat/${unwrappedParams.ticketId}`
          })
        }).catch(console.error);
        
        if (ticket.status === 'CLOSED' || ticket.status === 'INVALID') {
          await updateDoc(doc(db, 'tickets', unwrappedParams.ticketId), { 
            status: 'REOPENED',
            lastMessageBy: 'CUSTOMER',
            lastMessageAt: serverTimestamp()
          });
        } else {
          await updateDoc(doc(db, 'tickets', unwrappedParams.ticketId), { 
            lastMessageBy: 'CUSTOMER',
            lastMessageAt: serverTimestamp()
          });
        }

        await addDoc(collection(db, `tickets/${unwrappedParams.ticketId}/messages`), {
          text: '',
          imageUrl: downloadURL,
          senderId: localStorage.getItem('customerId') || 'temp-id',
          sender: { role: 'CUSTOMER' },
          createdAt: serverTimestamp()
        });

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    );
  };

  return (
    <div className="fixed inset-0 flex flex-col w-full bg-slate-900 overflow-hidden font-sans z-[9999]">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 z-0"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>
      {/* Header */}
      <header className="relative bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 md:px-6 py-4 flex items-center justify-between z-20 shadow-lg shadow-black/20 w-full box-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-start leading-[0.85] font-extrabold tracking-tighter text-[18px] select-none shadow-lg shadow-[#c7df23]/10 flex-shrink-0 mr-2 border border-[#c7df23] p-1.5 rounded-xl bg-slate-950/40">
            <div className="text-[#c7df23]">V</div>
            <div className="text-[#c7df23]">en</div>
            <div className="text-[#238ce5]">zop</div>
          </div>
          <div>
            <h1 className="font-bold text-white text-base md:text-lg tracking-wide truncate">Support Chat</h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-[10px] md:text-xs text-indigo-200/70 font-medium">Ticket #{ticket.ticketNumber || unwrappedParams.ticketId.slice(0, 8)}</p>
              {ticket.status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  ticket.status === 'CLOSED' || ticket.status === 'INVALID' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                  ticket.status === 'REOPENED' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                  ticket.status === 'IN_PROGRESS' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                  ticket.status === 'PENDING_CUSTOMER' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className="flex h-3 w-3 relative ml-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
      </header>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-6 space-y-6 z-10 relative w-full box-border">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-indigo-200/50 space-y-4">
            <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            <p className="font-medium tracking-wide">Send a message to start chatting...</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender.role === 'CUSTOMER';
            const isBot = msg.sender.role === 'BOT';

            return (
              <div
                key={idx}
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-5 py-4 shadow-xl ${
                    isMe
                      ? 'bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white rounded-tr-sm shadow-indigo-500/20'
                      : isBot
                      ? 'bg-white/10 backdrop-blur-md text-white rounded-tl-sm border border-white/10'
                      : 'bg-slate-800 text-white rounded-tl-sm border border-slate-700 shadow-black/30'
                  }`}
                >
                  {!isMe && (
                    <p className={`text-[11px] font-bold tracking-wider uppercase mb-1.5 ${isBot ? 'text-indigo-300' : 'text-fuchsia-400'}`}>
                      {isBot ? 'Auto-Reply' : 'Support Agent'}
                    </p>
                  )}
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Attachment" className="max-w-full rounded-lg mb-2 shadow-sm" />
                  )}
                  {msg.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative p-3 md:p-6 bg-white/5 backdrop-blur-xl border-t border-white/10 z-20 w-full box-border flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2 md:gap-3 max-w-4xl mx-auto items-center w-full">
          <input
            type="file"
            accept="image/*, image/jpeg, image/png, image/webp"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 md:p-3.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-50 flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newMessage.trim()) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }}
            placeholder="Type a message..."
            className="flex-1 min-w-0 px-4 md:px-6 py-3 md:py-4 rounded-full border border-white/10 bg-white/5 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-white placeholder-indigo-200/50 backdrop-blur-md text-sm md:text-base"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white p-3 md:p-4 rounded-full hover:from-indigo-400 hover:to-fuchsia-400 disabled:opacity-50 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/25 focus:outline-none flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
