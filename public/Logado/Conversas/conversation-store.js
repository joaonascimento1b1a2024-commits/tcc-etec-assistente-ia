// Camada compartilhada pela Home e pelo histórico: cada conta usa seu próprio caminho.
// Um documento guarda até 100 mensagens de 700 caracteres. Assim, excluir a conversa
// também exclui suas mensagens, sem deixar subcoleções órfãs no Firestore.
export async function createConversationStore(app, uid) {
    const sdk = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    const db = sdk.getFirestore(app);
    const collection = sdk.collection(db, 'users', uid, 'conversas');
    const reference = (id) => {
        if (!/^[A-Za-z0-9]{20}$/.test(id)) throw new Error('Conversa inválida.');
        return sdk.doc(collection, id);
    };

    return {
        // A consulta é restrita ao usuário; as regras também verificam essa propriedade.
        watch(onChange, onError) {
            return sdk.onSnapshot(
                sdk.query(collection, sdk.orderBy('atualizadoEm', 'desc')),
                (snapshot) =>
                    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
                onError,
            );
        },
        // Reabre somente documentos confirmados pelo servidor; uma conversa excluída gera erro.
        async open(id) {
            const snapshot = await sdk.getDocFromServer(reference(id));
            if (!snapshot.exists()) throw new Error('Esta conversa não existe mais.');
            return snapshot.data();
        },
        // Transações evitam perder mensagens quando duas abas usam a mesma conversa.
        async append(id, text) {
            const cleanText = text.trim();
            if (!cleanText || cleanText.length > 700)
                throw new Error('Escreva entre 1 e 700 caracteres.');
            const ref = id ? reference(id) : sdk.doc(collection);
            await sdk.runTransaction(db, async (transaction) => {
                const snapshot = await transaction.get(ref);
                if (id && !snapshot.exists())
                    throw new Error('Conversa excluída. Inicie uma nova mensagem.');
                const previous = snapshot.exists() ? snapshot.data() : null;
                const items = previous?.mensagens || [];
                if (items.length >= 99)
                    throw new Error(
                        'Esta conversa atingiu 100 mensagens. Inicie uma nova conversa.',
                    );
                const message = { texto: cleanText, remetente: 'user', enviadoEm: Date.now() };
                if (previous) {
                    transaction.update(ref, {
                        mensagens: [...items, message],
                        atualizadoEm: sdk.serverTimestamp(),
                    });
                } else {
                    transaction.set(ref, {
                        titulo: cleanText.slice(0, 100),
                        tituloOrigem: 'provisorio',
                        mensagens: [message],
                        criadoEm: sdk.serverTimestamp(),
                        atualizadoEm: sdk.serverTimestamp(),
                    });
                }
            });
            return ref.id;
        },
        // Um título manual fica identificado para que uma futura IA não o sobrescreva.
        async rename(id, title) {
            const cleanTitle = title.trim();
            if (!cleanTitle || cleanTitle.length > 100)
                throw new Error('Digite um título entre 1 e 100 caracteres.');
            await sdk.updateDoc(reference(id), {
                titulo: cleanTitle,
                tituloOrigem: 'manual',
                atualizadoEm: sdk.serverTimestamp(),
            });
        },
        // A confirmação visual acontece em conversas.js; aqui título e mensagens são excluídos juntos.
        async remove(id) {
            await sdk.deleteDoc(reference(id));
        },
    };
}

// Ponto de integração reservado à IA própria do projeto, ainda ausente do repositório.
// O servidor deverá gerar o título usando as mensagens e atualizar titulo/tituloOrigem
// somente quando tituloOrigem == 'provisorio'. Não exponha chaves da IA no navegador.
