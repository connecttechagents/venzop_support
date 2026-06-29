import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "venzop-support",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
  await updateDoc(doc(db, 'tickets', 'CfESVLbbFISpyaIvSuJ1'), { machineName: 'Snacks' });
  console.log("Fixed Ticket 1002");
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
