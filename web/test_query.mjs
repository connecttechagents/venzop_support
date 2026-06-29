import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAGxC6exUuybxy9RDdY8SgoTo7tWzYxtRY",
  authDomain: "venzop-support.firebaseapp.com",
  projectId: "venzop-support",
  storageBucket: "venzop-support.firebasestorage.app",
  messagingSenderId: "832832578378",
  appId: "1:832832578378:web:033630ea042d23b6e1d7b3",
  measurementId: "G-642PBCK8BX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    console.log("Querying...");
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const tickets = [];
    snapshot.forEach(doc => tickets.push(doc.data()));
    console.log("Success! Tickets:", tickets.length);
  } catch (err) {
    console.error("Error querying:", err);
  }
}

test().catch(console.error);
