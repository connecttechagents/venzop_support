import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';

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
const storage = getStorage(app);

async function testUpload() {
  try {
    console.log("Attempting to upload a test file...");
    const storageRef = ref(storage, 'test_upload.txt');
    await uploadString(storageRef, 'This is a test upload');
    console.log("Upload succeeded!");
  } catch (error) {
    console.error("Upload failed with error:");
    console.error(error.message);
  }
}

testUpload();
