import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

// Values come from your .env file (see .env.example).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured =
  Boolean(firebaseConfig.projectId) && firebaseConfig.projectId !== 'your_project_id';

const app = initializeApp(firebaseConfig);

// ignoreUndefinedProperties: optional fields (e.g. verificationRequestedAt)
// are simply skipped instead of making Firestore throw.
export const firestore = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
