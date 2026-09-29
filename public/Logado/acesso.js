// Única fonte do cargo: administradores/{UID}. O perfil users/{UID} e o
// localStorage nunca concedem permissões. As regras do banco repetem a validação.
export async function verificarAdministrador(user, db) {
    if (!user) throw new Error('Entre na sua conta para continuar.');
    const sdk = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    if (!db) {
        const { getApp } = await import(
            'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'
        );
        db = sdk.getFirestore(getApp());
    }
    // Não usa o cache para decidir o cargo; uma falha não vira permissão de aluno/admin.
    const snapshot = await sdk.getDocFromServer(sdk.doc(db, 'administradores', user.uid));
    return snapshot.exists() && snapshot.data().ativo === true;
}

// Caminhos relativos ao módulo funcionam mesmo quando o site fica em uma subpasta.
export function paginaConfiguracoes(admin) {
    return new URL(
        admin
            ? './Configurações Administrador/configAdmin.html'
            : './Configurações Aluno/configAl.html',
        import.meta.url,
    ).href;
}

// As duas contas usam a mesma Home; apenas o destino das configurações muda.
export async function entrarNaAreaLogada(user) {
    await verificarAdministrador(user);
    window.location.assign(new URL('./Home/home.html', import.meta.url).href);
}
