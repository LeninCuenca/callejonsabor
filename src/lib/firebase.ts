import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
	appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Emulator toggle: set VITE_USE_EMULATOR=true to force using the local emulator.
const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';
const emulatorHost = useEmulator
	? import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || (typeof process !== 'undefined' ? process.env.FIRESTORE_EMULATOR_HOST : undefined)
	: undefined;

if (useEmulator && emulatorHost) {
	// emulatorHost format: host:port
	const parts = emulatorHost.split(':');
	const host = parts[0] || 'localhost';
	const port = parts[1] ? parseInt(parts[1], 10) : 8080;
	connectFirestoreEmulator(db, host, port);
}
