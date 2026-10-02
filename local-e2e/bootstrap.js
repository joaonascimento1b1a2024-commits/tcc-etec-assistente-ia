import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, connectAuthEmulator, setPersistence, inMemoryPersistence, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

// Existe apenas na copia gerada, nunca no Hosting normal de public/.
if (location.origin !== 'http://127.0.0.1:5000') throw new Error('LOCAL_ORIGIN_REQUIRED');
const app = initializeApp({ projectId: 'tcc-ia-d8891', apiKey: 'local-emulator-only' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
await setPersistence(auth, inMemoryPersistence);
const session = await signInAnonymously(auth);
globalThis.__LOCAL_E2E__ = Object.freeze({ uid: session.user.uid, projectId: app.options.projectId,
    auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' });
await import('./home.js');
