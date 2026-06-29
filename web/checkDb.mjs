import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
  projectId: "venzop-support",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDb() {
  console.log("Checking machines...");
  const machinesSnap = await getDocs(collection(db, "machines"));
  machinesSnap.forEach(m => console.log(`Machine ${m.id}:`, m.data()));

  console.log("Checking tickets...");
  const ticketsSnap = await getDocs(query(collection(db, "tickets"), orderBy("createdAt", "desc")));
  ticketsSnap.forEach(t => {
    console.log(`Ticket ${t.id}:`, t.data());
  });
}

checkDb().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
