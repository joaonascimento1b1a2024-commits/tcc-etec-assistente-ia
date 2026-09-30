// Controles administrativos vivem apenas durante a sessão e o cargo confirmados.
// As regras do Firestore validam novamente cada gravação.
export function iniciarGestaoAvisos({ db, sdk, verificarAcesso }) {
    const lifecycle = new AbortController();
    const byId = (id) => document.getElementById(id);
    const list = byId('noticeList');
    const toolbar = byId('admin-toolbar');
    const selectAll = byId('select-all');
    const deleteSelected = byId('delete-selected');
    const editDialog = byId('edit-dialog');
    const deleteDialog = byId('delete-dialog');
    const selected = new Set();
    let notices = new Map();
    let editingId = null;
    let deleting = [];
    let busy = false;

    const listen = (element, event, handler) =>
        element.addEventListener(event, handler, { signal: lifecycle.signal });
    function feedback(id, text, error = false) {
        if (lifecycle.signal.aborted) return;
        const element = byId(id);
        element.textContent = text;
        element.hidden = !text;
        element.dataset.error = String(error);
    }
    function updateSelection() {
        selectAll.checked = notices.size > 0 && selected.size === notices.size;
        selectAll.indeterminate = selected.size > 0 && selected.size < notices.size;
        selectAll.disabled = busy || notices.size === 0;
        deleteSelected.disabled = busy || selected.size === 0;
        byId('selection-count').textContent =
            selected.size === 1 ? '1 aviso selecionado' : `${selected.size} avisos selecionados`;
        list.querySelectorAll('.notice-select').forEach((checkbox) => {
            checkbox.checked = selected.has(checkbox.dataset.id);
            checkbox.closest('.notice-card').classList.toggle('is-selected', checkbox.checked);
        });
    }
    function lock(value) {
        busy = value;
        document
            .querySelectorAll(
                '.notice-admin button, .notice-admin input, dialog button, dialog input, dialog textarea, dialog select',
            )
            .forEach((element) => (element.disabled = value));
        updateSelection();
    }
    async function requireAdmin() {
        if (lifecycle.signal.aborted) throw new Error('A sessão foi encerrada.');
        const allowed = await verificarAcesso();
        if (lifecycle.signal.aborted || !allowed) {
            throw new Error('Seu acesso administrativo não está ativo. Recarregue a página.');
        }
    }
    function failure(error) {
        if (error.code === 'permission-denied')
            return 'Acesso negado. Confira seu acesso de administrador.';
        if (error.code === 'not-found')
            return 'Este aviso já foi excluído. Feche esta janela e confira a lista.';
        return error.code
            ? 'Não foi possível concluir. Verifique a conexão e tente novamente.'
            : error.message;
    }
    function openEdit(id) {
        const notice = notices.get(id);
        if (busy || !notice) return;
        editingId = id;
        byId('edit-name').value = notice.titulo;
        byId('edit-description').value = notice.descricao;
        byId('edit-category').value = notice.categoria;
        feedback('edit-feedback', '');
        editDialog.showModal();
        byId('edit-name').focus();
    }
    function renderDeletePreview() {
        const count = deleting.length;
        byId('delete-title').textContent =
            count === 1 ? 'Excluir aviso?' : `Excluir ${count} avisos?`;
        byId('delete-description').textContent =
            'A exclusão é permanente. Confira os avisos antes de confirmar.';
        const preview = byId('delete-preview');
        preview.replaceChildren();
        for (const notice of deleting) {
            const item = document.createElement('li');
            item.textContent = notice.titulo;
            preview.append(item);
        }
        byId('confirm-delete').textContent =
            count === 1 ? 'Excluir aviso' : `Excluir ${count} avisos`;
    }
    function openDelete(ids) {
        if (busy) return;
        deleting = ids.map((id) => notices.get(id)).filter(Boolean);
        if (!deleting.length) return;
        renderDeletePreview();
        feedback('delete-feedback', '');
        deleteDialog.showModal();
        byId('cancel-delete').focus();
    }

    toolbar.hidden = false;
    byId('edit-form').reset();
    feedback('action-feedback', '');
    lock(false);
    listen(selectAll, 'change', () => {
        if (busy) return;
        selected.clear();
        if (selectAll.checked) notices.forEach((_, id) => selected.add(id));
        updateSelection();
    });
    listen(deleteSelected, 'click', () => openDelete([...selected]));
    listen(list, 'change', (event) => {
        const checkbox = event.target.closest('.notice-select');
        if (busy || !checkbox || !notices.has(checkbox.dataset.id)) return;
        if (checkbox.checked) selected.add(checkbox.dataset.id);
        else selected.delete(checkbox.dataset.id);
        updateSelection();
    });
    listen(list, 'click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button || busy) return;
        if (button.dataset.action === 'edit') openEdit(button.dataset.id);
        if (button.dataset.action === 'delete') openDelete([button.dataset.id]);
    });
    for (const dialog of [editDialog, deleteDialog]) {
        listen(dialog, 'cancel', (event) => {
            if (busy) event.preventDefault();
        });
    }
    document.querySelectorAll('[data-close]').forEach((button) => {
        listen(button, 'click', () => {
            if (!busy) byId(button.dataset.close).close();
        });
    });

    listen(byId('edit-form'), 'submit', async (event) => {
        event.preventDefault();
        if (busy || !editingId) return;
        const titulo = byId('edit-name').value.trim();
        const descricao = byId('edit-description').value.trim();
        const categoria = byId('edit-category').value;
        if (!titulo || titulo.length > 150 || !descricao || descricao.length > 5000) {
            feedback(
                'edit-feedback',
                'Informe um título de até 150 caracteres e uma descrição de até 5000 caracteres.',
                true,
            );
            return;
        }
        if (!['geral', 'matricula', 'provas', 'feriado', 'evento'].includes(categoria)) {
            feedback('edit-feedback', 'Selecione uma categoria válida.', true);
            return;
        }
        const id = editingId;
        lock(true);
        feedback('edit-feedback', 'Salvando alterações...');
        try {
            await requireAdmin();
            // Atualiza somente os campos editáveis, preservando criação e publicação.
            await sdk.updateDoc(sdk.doc(db, 'avisos', id), {
                titulo,
                descricao,
                categoria,
                atualizadoEm: sdk.serverTimestamp(),
            });
            if (lifecycle.signal.aborted) return;
            editDialog.close();
            feedback('action-feedback', 'Aviso atualizado com sucesso.');
        } catch (error) {
            feedback('edit-feedback', failure(error), true);
        } finally {
            if (!lifecycle.signal.aborted) lock(false);
        }
    });

    listen(byId('delete-form'), 'submit', async (event) => {
        event.preventDefault();
        if (busy || !deleting.length) return;
        lock(true);
        let confirmed = 0;
        feedback('delete-feedback', 'Excluindo avisos...');
        try {
            // Divide seleções grandes em lotes. Só retira da tentativa os lotes confirmados.
            while (deleting.length) {
                await requireAdmin();
                const chunk = deleting.slice(0, 400);
                const batch = sdk.writeBatch(db);
                chunk.forEach(({ id }) => batch.delete(sdk.doc(db, 'avisos', id)));
                await batch.commit();
                if (lifecycle.signal.aborted) return;
                chunk.forEach(({ id }) => selected.delete(id));
                deleting = deleting.slice(chunk.length);
                confirmed += chunk.length;
            }
            deleteDialog.close();
            feedback(
                'action-feedback',
                confirmed === 1
                    ? 'Aviso excluído com sucesso.'
                    : `${confirmed} avisos excluídos com sucesso.`,
            );
        } catch (error) {
            if (lifecycle.signal.aborted) return;
            renderDeletePreview();
            feedback(
                'delete-feedback',
                `${confirmed ? `${confirmed} avisos já foram excluídos. ` : ''}${failure(error)} A lista acima mostra as exclusões ainda não confirmadas.`,
                true,
            );
        } finally {
            if (!lifecycle.signal.aborted) lock(false);
        }
    });

    return {
        prepareCard(card, notice) {
            card.querySelector('.notice-admin').hidden = false;
            card.querySelectorAll('.notice-admin button, .notice-select').forEach((element) => {
                element.dataset.id = notice.id;
                element.disabled = busy;
            });
            card.querySelector('.notice-select').setAttribute(
                'aria-label',
                `Selecionar aviso: ${notice.titulo}`,
            );
            card.querySelector('[data-action="edit"]').setAttribute(
                'aria-label',
                `Editar aviso: ${notice.titulo}`,
            );
            card.querySelector('[data-action="delete"]').setAttribute(
                'aria-label',
                `Excluir aviso: ${notice.titulo}`,
            );
        },
        updateNotices(items) {
            notices = new Map(items.map((notice) => [notice.id, notice]));
            for (const id of selected) {
                if (!notices.has(id)) selected.delete(id);
            }
            updateSelection();
        },
        dispose() {
            lifecycle.abort();
            selected.clear();
            notices.clear();
            deleting = [];
            toolbar.hidden = true;
            editDialog.close();
            deleteDialog.close();
            byId('edit-form').reset();
            byId('delete-preview').replaceChildren();
            byId('action-feedback').hidden = true;
        },
    };
}
