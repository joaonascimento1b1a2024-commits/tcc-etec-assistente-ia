import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { ambienteLocalAssistente } from './assistente-config.js';

// Existe apenas na copia gerada, nunca no Hosting normal de public/.
if (location.origin !== ambienteLocalAssistente.origin) throw new Error('LOCAL_ORIGIN_REQUIRED');
const app = initializeApp({ projectId: ambienteLocalAssistente.projectId, apiKey: 'local-emulator-only' });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${ambienteLocalAssistente.auth}`, { disableWarnings: true });
const db = getFirestore(app);
const [firestoreHost, firestorePort] = ambienteLocalAssistente.firestore.split(':');
connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
// Mantem a conta demo ao recarregar Home ou abrir a lista de conversas.
await setPersistence(auth, browserSessionPersistence);
await auth.authStateReady();
const user = auth.currentUser || (await signInAnonymously(auth)).user;
globalThis.__LOCAL_E2E__ = Object.freeze({ uid: user.uid, projectId: app.options.projectId,
    auth: ambienteLocalAssistente.auth, firestore: ambienteLocalAssistente.firestore });
if (location.pathname === '/Logado/Home/home.html') await import('./home.js');
else if (location.pathname === '/Logado/Conversas/conversas.html') await import('../Conversas/conversas.js');
else throw new Error('LOCAL_PAGE_REQUIRED');
