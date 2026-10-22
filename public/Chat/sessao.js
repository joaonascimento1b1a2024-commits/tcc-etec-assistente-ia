// Apenas observa uma sessão existente: não cria conta anônima nem lê históricos.
export async function observarSessao(onUser, onError) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (local && !globalThis.__LOCAL_E2E__) {
        onUser(null);
        return () => {};
    }
    const [appSDK, authSDK] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    ]);
    if (globalThis.__LOCAL_E2E__ && (!appSDK.getApps().length ||
        appSDK.getApp().options.projectId !== 'demo-sylvinho-render-poc'))
        throw new Error('LOCAL_DEMO_REQUIRED');
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
