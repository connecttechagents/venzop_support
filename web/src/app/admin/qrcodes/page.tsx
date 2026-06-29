'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import QRCode from 'qrcode';

const MACHINES = [
  { id: 'M1', location: 'Airport Terminal 1, Gate C', name: 'Vending Machine A' },
  { id: 'M2', location: 'Mall of America, Level 2', name: 'Vending Machine B' },
  { id: 'M3', location: 'Central Train Station', name: 'Vending Machine C' }
];

export default function AdminQRCodes() {
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [machines, setMachines] = useState(MACHINES);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    // Generate QR Codes for the current list of machines
    const generateQRs = async () => {
      const qrs: Record<string, string> = {};
      for (const machine of machines) {
        try {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
          const url = `${baseUrl}/machine/${machine.id}`;
          qrs[machine.id] = await QRCode.toDataURL(url);
        } catch (err) {
          console.error(err);
        }
      }
      setQrCodes(qrs);
    };
    generateQRs();
  }, [machines]);

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

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName || !newLocation) return;
    
    const newMachine = { id: newId, name: newName, location: newLocation };
    
    try {
      // Save directly to database
      await setDoc(doc(db, 'machines', newId), {
        name: newName,
        location: newLocation
      });
      
      // Update local state to render the new QR code
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
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Admin: Machine QR Codes</h1>
        <p className="text-slate-500 mb-8">Print these QR codes and place them on your vending machines. Customers can scan them to immediately open a support ticket for that specific location.</p>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Database Setup</h2>
            <p className="text-sm text-slate-500">Seed the Firestore database with the machines below and initialize the ticket sequence counter.</p>
          </div>
          <button
            onClick={handleSeedDatabase}
            disabled={seeding || seeded}
            className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${
              seeded ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-70`}
          >
            {seeded ? 'Seeded ✓' : seeding ? 'Seeding...' : 'Seed Database'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Custom Machine</h2>
          <form onSubmit={handleAddMachine} className="flex flex-col md:flex-row gap-4">
            <input type="text" placeholder="Machine ID (e.g. M4)" value={newId} onChange={e => setNewId(e.target.value)} required className="flex-1 px-4 py-2 rounded border border-slate-300 text-slate-900 bg-white placeholder-slate-400" />
            <input type="text" placeholder="Name (e.g. Snack Vending)" value={newName} onChange={e => setNewName(e.target.value)} required className="flex-1 px-4 py-2 rounded border border-slate-300 text-slate-900 bg-white placeholder-slate-400" />
            <input type="text" placeholder="Location (e.g. Lobby)" value={newLocation} onChange={e => setNewLocation(e.target.value)} required className="flex-1 px-4 py-2 rounded border border-slate-300 text-slate-900 bg-white placeholder-slate-400" />
            <button type="submit" className="bg-slate-800 text-white px-6 py-2 rounded hover:bg-slate-700">Add & Save</button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {machines.map(machine => (
            <div key={machine.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
              <h3 className="font-bold text-slate-800 text-lg mb-1">{machine.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{machine.location}</p>
              
              {qrCodes[machine.id] ? (
                <img src={qrCodes[machine.id]} alt={`QR Code for ${machine.id}`} className="w-48 h-48 mb-4" />
              ) : (
                <div className="w-48 h-48 bg-slate-100 flex items-center justify-center mb-4">
                  <span className="text-slate-400">Loading QR...</span>
                </div>
              )}
              
              <div className="text-xs font-mono bg-slate-100 px-3 py-1 rounded text-slate-600">
                /machine/{machine.id}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
