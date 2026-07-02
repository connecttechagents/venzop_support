'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

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
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [trigger, setTrigger] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['ALL']);
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<string[]>(['ALL']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'quick_replies'), orderBy('trigger', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: QuickReply[] = [];
      snapshot.forEach((d) => {
        data.push({ id: d.id, ...d.data() } as QuickReply);
      });
      setReplies(data);
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (confirm("Are you sure you want to delete this quick reply?")) {
      await deleteDoc(doc(db, 'quick_replies', id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex justify-between items-end border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Quick Replies</h1>
            <p className="text-slate-400 mt-1">Manage slash commands and pre-written responses</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-4">Add New Reply</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Trigger (No spaces, e.g. "hello")</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-bold">/</span>
                  <input
                    type="text"
                    value={trigger}
                    onChange={e => setTrigger(e.target.value.replace(/\s+/g, '').toLowerCase())}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="keyword"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="" disabled>Select a Category...</option>
                  <option value="Greeting">Greeting</option>
                  <option value="Clarification">Clarification</option>
                  <option value="Solution">Solution</option>
                  <option value="Apology">Apology</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Closing">Closing</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Message Text</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="The full message to insert..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Target Statuses</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggleStatus('ALL')} className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedStatuses.includes('ALL') ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>ALL</button>
                  {ALL_STATUSES.map(s => (
                    <button key={s} type="button" onClick={() => toggleStatus(s)} className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedStatuses.includes(s) && !selectedStatuses.includes('ALL') ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Target Issue Types</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggleIssueType('ALL')} className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedIssueTypes.includes('ALL') ? 'bg-fuchsia-600 text-white' : 'bg-slate-700 text-slate-300'}`}>ALL</button>
                  {ALL_ISSUE_TYPES.map(i => (
                    <button key={i} type="button" onClick={() => toggleIssueType(i)} className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedIssueTypes.includes(i) && !selectedIssueTypes.includes('ALL') ? 'bg-fuchsia-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl shadow-lg transition-colors disabled:opacity-50 mt-4"
              >
                {isSubmitting ? 'Adding...' : 'Add Quick Reply'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl overflow-hidden flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-4">Existing Quick Replies</h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              {replies.length === 0 ? (
                <div className="text-center text-slate-500 py-12">No quick replies found.</div>
              ) : (
                replies.map(r => (
                  <div key={r.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded text-sm">/{r.trigger}</span>
                        <span className="text-slate-400 text-sm">• {r.category}</span>
                      </div>
                      <p className="text-slate-200 text-sm mb-3 whitespace-pre-wrap">{r.text}</p>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 uppercase font-semibold">Status:</span>
                          <div className="flex flex-wrap gap-1">
                            {(r.statuses || ['ALL']).map(s => (
                              <span key={s} className="bg-slate-800 border border-slate-600 text-slate-300 px-1.5 py-0.5 rounded">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 uppercase font-semibold">Issue:</span>
                          <div className="flex flex-wrap gap-1">
                            {(r.issueTypes || ['ALL']).map(s => (
                              <span key={s} className="bg-slate-800 border border-slate-600 text-slate-300 px-1.5 py-0.5 rounded">{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-400 hover:text-red-300 self-start sm:self-center p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
