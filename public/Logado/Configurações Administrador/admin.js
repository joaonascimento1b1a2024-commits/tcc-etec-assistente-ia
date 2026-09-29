import { verificarAdministrador } from '../acesso.js';

// Este módulo só é iniciado após a conferência do cargo. As regras do Firestore
// continuam sendo a barreira de segurança, mesmo se alguém modificar o HTML/JS.
export function iniciarAdministracao({ user, db, sdk }) {
    // 1. Estado da tela: operações pendentes pertencem somente à sessão atual.
    const lifecycle = new AbortController();
    const byId = (id) => document.getElementById(id);
    const noticeForm = byId('notice-form');
    const promotionForm = byId('promotion-form');
    const uidInput = byId('promotion-uid');
    const confirm = byId('confirm-promotion');
    let pendingUser = null;
    let busy = false;
    let pendingNotice = null;

    // Eventos são removidos quando a sessão muda ou o cargo é revogado.
    const listen = (element, event, handler) =>
        element.addEventListener(event, handler, { signal: lifecycle.signal });
    function feedback(id, text, error = false) {
        if (lifecycle.signal.aborted) return;
        const element = byId(id);
        element.textContent = text;
        element.hidden = !text;
        element.dataset.error = String(error);
    }
    function lock(locked) {
        busy = locked;
        document
            .querySelectorAll('dialog button, dialog input, dialog textarea, dialog select')
            .forEach((element) => (element.disabled = locked));
        confirm.disabled = locked || !pendingUser;
        if (!locked && pendingNotice)
            noticeForm
                .querySelectorAll('input, textarea, select')
                .forEach((element) => (element.disabled = true));
    }
    async function requireAdmin() {
        // Confere novamente antes de gravar e invalida pedidos iniciados em uma sessão encerrada.
        if (lifecycle.signal.aborted) throw new Error('A sessão foi encerrada.');
        const allowed = await verificarAdministrador(user, db);
        if (lifecycle.signal.aborted || !allowed) {
            throw new Error('Seu acesso administrativo não está ativo. Recarregue a página.');
        }
    }
    function showFailure(id, error) {
        feedback(
            id,
            error.code === 'permission-denied'
                ? 'Acesso negado. Confira seu cargo e a publicação das regras do Firebase.'
                : error.code
                  ? 'Não foi possível concluir. Verifique a conexão e tente novamente.'
                  : error.message,
            true,
        );
    }

    // Uma troca de conta não reaproveita rascunhos, perfis buscados ou confirmações.
    noticeForm.reset();
    promotionForm.reset();
    byId('promotion-preview').hidden = true;
    feedback('notice-feedback', '');
    feedback('promotion-feedback', '');
    lock(false);

    // Abrir/fechar não apaga rascunhos. Durante uma gravação, aguarda o resultado.
    for (const [button, dialog] of [
        ['open-notice', 'notice-dialog'],
        ['open-promotion', 'promotion-dialog'],
    ]) {
        listen(byId(button), 'click', () => byId(dialog).showModal());
        listen(byId(dialog), 'cancel', (event) => {
            if (busy) event.preventDefault();
        });
    }
    document.querySelectorAll('[data-close]').forEach((button) =>
        listen(button, 'click', () => {
            if (!busy) byId(button.dataset.close).close();
        }),
    );

    // 2. Publicação: usa o contrato já consumido pela tela Avisos. A referência é
    // mantida nas tentativas para não duplicar avisos após perda da confirmação.
    listen(noticeForm, 'submit', async (event) => {
        event.preventDefault();
        if (busy) return;
        const values = pendingNotice?.data || Object.fromEntries(new FormData(noticeForm));
        const titulo = String(values.titulo).trim();
        const descricao = String(values.descricao).trim();
        if (!titulo || !descricao) {
            feedback('notice-feedback', 'Preencha título e descrição.', true);
            return;
        }
        lock(true);
        feedback('notice-feedback', 'Publicando aviso...');
        try {
            await requireAdmin();
            pendingNotice ||= {
                ref: sdk.doc(sdk.collection(db, 'avisos')),
                data: { titulo, descricao, categoria: values.categoria, publicado: true },
            };
            await sdk.runTransaction(db, async (transaction) => {
                if (lifecycle.signal.aborted) throw new Error('A sessão foi encerrada.');
                const existing = await transaction.get(pendingNotice.ref);
                if (lifecycle.signal.aborted) throw new Error('A sessão foi encerrada.');
                if (!existing.exists())
                    transaction.set(pendingNotice.ref, {
                        ...pendingNotice.data,
                        criadoEm: sdk.serverTimestamp(),
                    });
            });
            if (lifecycle.signal.aborted) return;
            pendingNotice = null;
            noticeForm.reset();
            feedback(
                'notice-feedback',
                'Aviso publicado! Ele já está disponível na página de Avisos.',
            );
        } catch (error) {
            showFailure('notice-feedback', error);
            // Mantém os dados originais da tentativa até uma confirmação do banco.
            if (pendingNotice)
                feedback(
                    'notice-feedback',
                    'Publicação não confirmada. Tente novamente para confirmar o mesmo aviso, sem duplicá-lo.',
                    true,
                );
        } finally {
            if (!lifecycle.signal.aborted) {
                lock(false);
            }
        }
    });

    // 3. Promoção: alterar o UID invalida a confirmação, evitando promover outra pessoa.
    listen(uidInput, 'input', () => {
        pendingUser = null;
        confirm.disabled = true;
        byId('promotion-preview').hidden = true;
        feedback('promotion-feedback', '');
    });
    listen(promotionForm, 'submit', async (event) => {
        event.preventDefault();
        if (busy) return;
        const uid = uidInput.value.trim();
        pendingUser = null;
        byId('promotion-preview').hidden = true;
        if (!uid || uid.length > 128 || uid.includes('/')) {
            confirm.disabled = true;
            feedback(
                'promotion-feedback',
                'Informe um UID válido, copiado do Firebase Authentication.',
                true,
            );
            return;
        }
        lock(true);
        feedback('promotion-feedback', 'Buscando usuário...');
        try {
            await requireAdmin();
            const [profile, membership] = await Promise.all([
                sdk.getDocFromServer(sdk.doc(db, 'users', uid)),
                sdk.getDocFromServer(sdk.doc(db, 'administradores', uid)),
            ]);
            if (lifecycle.signal.aborted) return;
            if (!profile.exists())
                throw new Error(
                    'Perfil não encontrado. Peça à pessoa para entrar na Home primeiro e confira o UID.',
                );
            if (membership.exists())
                throw new Error(
                    membership.data().ativo === true
                        ? 'Esta pessoa já é administradora.'
                        : 'Este acesso foi desativado. A reativação deve ser feita pelo responsável no console Firebase.',
                );
            pendingUser = uid;
            byId('promotion-preview').textContent =
                `UID: ${uid}\nNome: ${profile.data().nome || 'Não informado'}\nE-mail: ${profile.data().email || 'Não informado'}`;
            byId('promotion-preview').hidden = false;
            feedback(
                'promotion-feedback',
                'Confira o UID e confirme abaixo para conceder acesso administrativo.',
            );
        } catch (error) {
            showFailure('promotion-feedback', error);
        } finally {
            if (!lifecycle.signal.aborted) lock(false);
        }
    });

    // Só cria uma nova permissão. As regras exigem que o autor já seja administrador.
    listen(confirm, 'click', async () => {
        if (busy || !pendingUser) return;
        const target = pendingUser;
        lock(true);
        feedback('promotion-feedback', 'Confirmando promoção...');
        try {
            await requireAdmin();
            await sdk.runTransaction(db, async (transaction) => {
                if (lifecycle.signal.aborted) throw new Error('A sessão foi encerrada.');
                const reference = sdk.doc(db, 'administradores', target);
                const existing = await transaction.get(reference);
                if (lifecycle.signal.aborted) throw new Error('A sessão foi encerrada.');
                if (existing.exists()) {
                    if (existing.data().ativo !== true)
                        throw new Error('Acesso desativado. Procure o responsável pelo Firebase.');
                    return;
                }
                transaction.set(reference, {
                    ativo: true,
                    promovidoPor: user.uid,
                    criadoEm: sdk.serverTimestamp(),
                });
            });
            pendingUser = null;
            feedback(
                'promotion-feedback',
                'Promoção concluída! A pessoa pode abrir as configurações para acessar as novas funções.',
            );
        } catch (error) {
            showFailure('promotion-feedback', error);
        } finally {
            if (!lifecycle.signal.aborted) lock(false);
        }
    });

    // 4. Limpeza: o módulo compartilhado de configurações chama dispose ao trocar conta/cargo.
    return {
        dispose() {
            lifecycle.abort();
            byId('notice-dialog').close();
            byId('promotion-dialog').close();
        },
    };
}
