import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAGxC6exUuybxy9RDdY8SgoTo7tWzYxtRY",
  authDomain: "venzop-support.firebaseapp.com",
  projectId: "venzop-support",
  storageBucket: "venzop-support.firebasestorage.app",
  messagingSenderId: "832832578378",
  appId: "1:832832578378:web:033630ea042d23b6e1d7b3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const QUICK_REPLIES = [
  { trigger: 'greet', category: 'General', text: 'Hello! I am looking into this issue for you right now.' },
  { trigger: 'wait', category: 'General', text: 'Please allow me a few minutes to process this.' },
  { trigger: 'refund1', category: 'Payment', text: 'I have successfully initiated a refund to your account. It should reflect in 3-5 business days.' },
  { trigger: 'refund2', category: 'Payment', text: 'Could you please provide the transaction ID from your bank statement?' },
  { trigger: 'stuck1', category: 'Hardware', text: 'I am dispatching a technician to look at the machine and release your item.' },
  { trigger: 'stuck2', category: 'Hardware', text: 'Since the item is stuck, I can offer you a full refund or credit for your next purchase.' },
  { trigger: 'contact', category: 'General', text: 'If you need further assistance, please contact our helpline at 1-800-VENZOP.' }
];

async function seed() {
  console.log('Clearing existing quick replies...');
  const existing = await getDocs(collection(db, 'quick_replies'));
  for (const docSnap of existing.docs) {
    await deleteDoc(docSnap.ref);
  }

  console.log('Seeding new quick replies...');
  for (const reply of QUICK_REPLIES) {
    await addDoc(collection(db, 'quick_replies'), reply);
    console.log(`Added: /${reply.trigger}`);
  }
  
  console.log('Done!');
  process.exit(0);
}

seed().catch(console.error);
