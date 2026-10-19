import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
// Configuração exclusiva do staging de autenticação; nenhum endpoint online.
const ambienteLocalAssistente = Object.freeze({ origin: 'http://127.0.0.1:5000',
    projectId: 'demo-sylvinho-render-poc', auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' });

// Somente na cópia de staging. Nunca autentica automaticamente um visitante.
if (location.origin !== ambienteLocalAssistente.origin) throw new Error('LOCAL_ORIGIN_REQUIRED');
const app = initializeApp({ projectId: ambienteLocalAssistente.projectId, apiKey: 'local-emulator-only' });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${ambienteLocalAssistente.auth}`, { disableWarnings: true });
const db = getFirestore(app);
const [host, port] = ambienteLocalAssistente.firestore.split(':');
connectFirestoreEmulator(db, host, Number(port));
// Preserva a escolha feita no Login (local ou sessão) entre páginas.
await auth.authStateReady();
globalThis.__LOCAL_E2E__ = Object.freeze({ uid: auth.currentUser?.uid || null,
    projectId: app.options.projectId, auth: ambienteLocalAssistente.auth, firestore: ambienteLocalAssistente.firestore });
const routes = {
    '/Login/login.html': '../../Login/login.js',
    '/Criar-Conta/cadastro.html': '../../Criar-Conta/cadastro.js',
    '/Logado/Home/home.html': './home.js',
    '/Logado/Conversas/conversas.html': '../Conversas/conversas.js',
    '/Logado/Configurações Aluno/configAl.html': '../Configurações Aluno/configAl.js',
};
const modulePath = routes[decodeURI(location.pathname)];
if (!modulePath) throw new Error('LOCAL_PAGE_REQUIRED');
await import(modulePath);
