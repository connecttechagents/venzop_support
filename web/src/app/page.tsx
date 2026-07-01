'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Home() {
  const [machineId, setMachineId] = useState('');
  const [machines, setMachines] = useState<{id: string, location: string, name: string}[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'machines'));
        const mList: any[] = [];
        querySnapshot.forEach((doc) => {
          mList.push({ id: doc.id, ...doc.data() });
        });
        setMachines(mList);
        if (mList.length > 0) {
          setMachineId(mList[0].id);
        }
      } catch (e) {
        console.error("Error fetching machines", e);
      }
    };
    fetchMachines();
  }, []);

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    if (machineId.trim()) {
      router.push(`/machine/${machineId.trim()}`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-extrabold text-slate-900">Venzop Support</h1>
        <p className="text-slate-500">Normally, you would arrive here by scanning a QR code on a vending machine.</p>
        
        <div className="pt-4 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-700 mb-3">For testing, select a Machine:</p>
          <form onSubmit={handleGo} className="flex gap-2">
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors truncate text-ellipsis overflow-hidden"
              required
            >
              {machines.length === 0 && <option value="">Loading machines...</option>}
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} - {m.name || 'Unknown'} ({m.location || 'Unknown Location'})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!machineId}
              className="bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm"
            >
              Go
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
