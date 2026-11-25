// Apenas observa uma sessão existente: não cria conta anônima nem lê históricos.
export async function observarSessao(onUser, onError) {
    // No computador local (sem os testes E2E), não conecta ao Firebase real: o chat funciona como visitante.
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (local && !globalThis.__LOCAL_E2E__) {
        onUser(null);
        return () => {};
    }
    // Carrega o Firebase só quando necessário, direto do CDN oficial do Google.
    const [appSDK, authSDK] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    ]);
    if (globalThis.__LOCAL_E2E__ && (!appSDK.getApps().length ||
        appSDK.getApp().options.projectId !== 'demo-sylvinho-render-poc'))
        throw new Error('LOCAL_DEMO_REQUIRED');
    // Configuração pública do app web do Firebase (identifica o projeto; não é senha). O acesso aos dados é
    // controlado pelas regras do Firestore e pelo login.
    const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp({
        apiKey: 'AIzaSyCjKDPXTG8PUp8T4aY5qSQ8KbWut5EdZKU',
        authDomain: 'tcc-ia-d8891.firebaseapp.com',
        projectId: 'tcc-ia-d8891',
        storageBucket: 'tcc-ia-d8891.firebasestorage.app',
        messagingSenderId: '767501525275',
        appId: '1:767501525275:web:9153a051a817504f64b3be',
    });
    return authSDK.onAuthStateChanged(authSDK.getAuth(app), onUser, onError);
}
