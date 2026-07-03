import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkTicket() {
  const ticketsRef = db.collection('tickets');
  const snapshot = await ticketsRef.orderBy('createdAt', 'desc').limit(1).get();
  
  if (snapshot.empty) {
    console.log("No tickets found.");
    return;
  }

  const ticket = snapshot.docs[0].data();
  console.log("Latest ticket:", ticket);
}

checkTicket().catch(console.error);
