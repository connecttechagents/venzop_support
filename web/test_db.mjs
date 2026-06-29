import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
  const querySnapshot = await getDocs(collection(db, 'tickets'));
  const tickets = [];
  querySnapshot.forEach((doc) => {
    tickets.push({ id: doc.id, ...doc.data() });
  });
  console.log("Found", tickets.length, "tickets");
  console.log(tickets);
}

test().catch(console.error);
