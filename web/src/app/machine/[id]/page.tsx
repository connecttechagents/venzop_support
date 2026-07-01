'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, runTransaction } from 'firebase/firestore';

export default function MachineLanding({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const [step, setStep] = useState(1);
  const [activeTickets, setActiveTickets] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [issueType, setIssueType] = useState('Payment');
  const [subIssueType, setSubIssueType] = useState('Amount deducted but item not dispensed');
  const [loading, setLoading] = useState(false);
  const [machineLocation, setMachineLocation] = useState('Loading location...');
  const [machineName, setMachineName] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchMachine = async () => {
      try {
        const machineRef = doc(db, 'machines', unwrappedParams.id);
        const machineSnap = await getDoc(machineRef);
        if (machineSnap.exists()) {
          setMachineLocation(machineSnap.data().location);
          setMachineName(machineSnap.data().name);
        } else {
          setMachineLocation('Unknown Location');
        }
      } catch (err) {
        setMachineLocation('Location error');
      }
    };
    fetchMachine();
  }, [unwrappedParams.id]);

  useEffect(() => {
    if (issueType === 'Payment') setSubIssueType('Amount deducted but item not dispensed');
    else if (issueType === 'Hardware') setSubIssueType('Item stuck in coil');
    else setSubIssueType('How to use the machine');
  }, [issueType]);

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('mobileNumber', '==', mobileNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const cId = querySnapshot.docs[0].id;
        setCustomerId(cId);

        const ticketsRef = collection(db, 'tickets');
        const activeTicketsQuery = query(ticketsRef, 
          where('customerId', '==', cId),
          where('machineId', '==', unwrappedParams.id)
        );
        const activeTicketsSnap = await getDocs(activeTicketsQuery);
        
        const tickets = activeTicketsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((t: any) => t.status !== 'CLOSED' && t.status !== 'INVALID');
        
        if (tickets.length > 0) {
          setActiveTickets(tickets);
          setStep(2);
        } else {
          setStep(3);
        }
      } else {
        setStep(3);
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalCustomerId = customerId;
      if (!finalCustomerId) {
        const usersRef = collection(db, 'users');
        const newUserRef = await addDoc(usersRef, {
          mobileNumber,
          role: 'CUSTOMER',
          createdAt: serverTimestamp()
        });
        finalCustomerId = newUserRef.id;
        setCustomerId(finalCustomerId);
      }

      const ticketsRef = collection(db, 'tickets');
      const newTicketRef = doc(ticketsRef);
      let newTicketNumber = 0;

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'tickets');
        const counterDoc = await transaction.get(counterRef);
        
        if (!counterDoc.exists()) {
           newTicketNumber = 1000;
           transaction.set(counterRef, { currentId: 1000 });
        } else {
           newTicketNumber = counterDoc.data().currentId + 1;
           transaction.update(counterRef, { currentId: newTicketNumber });
        }
        
        transaction.set(newTicketRef, {
          machineId: unwrappedParams.id,
          customerId: finalCustomerId,
          status: 'OPEN',
          issueType,
          subIssueType,
          location: machineLocation,
          machineName: machineName,
          ticketNumber: newTicketNumber,
          createdAt: serverTimestamp()
        });
      });

      // Add default welcome message
      await addDoc(collection(db, `tickets/${newTicketRef.id}/messages`), {
        text: `Welcome to Venzop Support!\n\nI see you have a ${issueType === 'General' ? 'general' : issueType.toLowerCase()} issue regarding: "${subIssueType}". An agent will be with you shortly. Please provide any additional details (like the item name or transaction ID) below.`,
        senderId: 'system-bot',
        sender: { role: 'BOT', name: 'System' },
        createdAt: serverTimestamp()
      });

      // Notify agents
      fetch('/api/notifyAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `New Ticket #${newTicketNumber}`,
          body: `${machineName || unwrappedParams.id}: ${issueType} - ${subIssueType}`,
          url: `https://agent.venzop.com` // Opening the app will redirect to the tickets list
        })
      }).catch(console.error);

      localStorage.setItem('customerId', finalCustomerId);
      router.push(`/chat/${newTicketRef.id}`);
    } catch (error) {
      console.error(error);
      alert('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 opacity-40"></div>
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-70 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-70 animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="max-w-md w-full bg-white/10 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-8 space-y-8 relative z-10 border border-white/20">
        <div className="text-center space-y-2">
          <div className="flex flex-col items-start leading-[0.85] font-extrabold tracking-tighter text-[52px] mb-6 mx-auto w-fit select-none drop-shadow-md border-2 border-[#c7df23] p-4 px-5 rounded-3xl bg-slate-950/40 shadow-xl shadow-[#c7df23]/10">
            <div className="text-[#c7df23]">V</div>
            <div className="text-[#c7df23]">en</div>
            <div className="text-[#238ce5]">zop</div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sr-only">Venzop Support</h1>
          <div className="inline-flex items-center justify-center space-x-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <p className="text-sm text-indigo-100 font-medium">{machineName || `Machine ${unwrappedParams.id}`}</p>
          </div>
          <p className="text-xs text-indigo-200/70 pt-1">{machineLocation}</p>
        </div>

        {step === 1 && (
          <form onSubmit={handleMobileSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="mobile" className="block text-sm font-semibold text-indigo-100 ml-1">
                Mobile Number
              </label>
              <input
                type="tel"
                id="mobile"
                required
                pattern="[0-9]{10}"
                minLength={10}
                maxLength={10}
                title="Please enter a 10 digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 9876543210"
                className="w-full px-5 py-4 rounded-xl border border-white/10 bg-white/5 focus:bg-white/10 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all text-white placeholder-indigo-200/50 outline-none backdrop-blur-sm"
              />
              <p className="text-xs text-indigo-200/70 mt-2 text-center">
                Please enter the mobile number with Whatsapp and UPI payment setup
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center mt-4 border border-white/10"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking...
                </span>
              ) : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-white text-center">Active Tickets Found</h2>
            <p className="text-indigo-200/70 text-sm text-center">You have open support tickets. You can resume an existing chat or create a new one.</p>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {activeTickets.map(ticket => (
                <div 
                  key={ticket.id} 
                  onClick={() => {
                    localStorage.setItem('customerId', customerId);
                    router.push(`/chat/${ticket.id}`);
                  }}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 p-4 rounded-xl cursor-pointer transition-all active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-white">Ticket #{ticket.ticketNumber || ticket.id.slice(0,8)}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-sm text-indigo-200">{ticket.machineId} - {ticket.machineName || 'Unknown'} - {ticket.issueType}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-white/10"
            >
              Create New Ticket
            </button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleCreateTicket} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="issueType" className="block text-sm font-semibold text-indigo-100 ml-1">
                What can we help you with?
              </label>
            <div className="relative">
              <select
                id="issueType"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border border-white/10 bg-white/5 focus:bg-white/10 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all text-white outline-none backdrop-blur-sm appearance-none cursor-pointer [&>option]:text-black"
              >
                <option value="Payment">Payment or Refund</option>
                <option value="Hardware">Item Stuck / Hardware</option>
                <option value="General">General Inquiry</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-indigo-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="subIssueType" className="block text-sm font-semibold text-indigo-100 ml-1">
              Specifically...
            </label>
            <div className="relative">
              <select
                id="subIssueType"
                value={subIssueType}
                onChange={(e) => setSubIssueType(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border border-white/10 bg-white/5 focus:bg-white/10 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all text-white outline-none backdrop-blur-sm appearance-none cursor-pointer [&>option]:text-black"
              >
                {issueType === 'Payment' && (
                  <>
                    <option value="Amount deducted but item not dispensed">Amount deducted but item not dispensed</option>
                    <option value="Did not receive exact change">Did not receive exact change</option>
                    <option value="Card reader not working">Card reader not working</option>
                    <option value="Other payment issue">Other payment issue</option>
                  </>
                )}
                {issueType === 'Hardware' && (
                  <>
                    <option value="Item stuck in coil">Item stuck in coil</option>
                    <option value="Screen is frozen or unresponsive">Screen is frozen or unresponsive</option>
                    <option value="Machine is powered off">Machine is powered off</option>
                    <option value="Other hardware issue">Other hardware issue</option>
                  </>
                )}
                {issueType === 'General' && (
                  <>
                    <option value="How to use the machine">How to use the machine</option>
                    <option value="Suggest new items">Suggest new items</option>
                    <option value="General feedback">General feedback</option>
                    <option value="Other">Other</option>
                  </>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-indigo-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center mt-4 border border-white/10"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Starting Chat...
              </span>
            ) : 'Start Support Chat'}
          </button>
        </form>
        )}
      </div>
    </main>
  );
}
