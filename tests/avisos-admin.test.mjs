// Exercita os eventos reais da gestão de avisos sem rede nem dados de produção.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
    new URL('../public/Logado/Avisos/avisos-admin.js', import.meta.url),
    'utf8',
).replace('export function', 'function');
class Element {
    dataset = {};
    attributes = {};
    children = [];
    handlers = [];
    matches = {};
    value = '';
    textContent = '';
    disabled = false;
    hidden = false;
    checked = false;
    open = false;
    classList = { toggle() {} };
    addEventListener(type, callback, options = {}) {
        this.handlers.push({ type, callback, ...options });
    }
    async fire(type, target = this) {
        const event = { target, preventDefault() {} };
        await Promise.all(
            this.handlers
                .filter((handler) => handler.type === type && !handler.signal?.aborted)
                .map((handler) => handler.callback(event)),
        );
    }
    closest(selector) {
        return this.matches[selector] || null;
    }
    setAttribute(name, value) {
        this.attributes[name] = value;
    }
    append(child) {
        this.children.push(child);
    }
    replaceChildren(...children) {
        this.children = children;
    }
    showModal() {
        this.open = true;
    }
    close() {
        this.open = false;
    }
    focus() {}
    reset() {}
}
const makeNotice = (id) => ({
    id,
    titulo: `Aviso ${id}`,
    descricao: 'Descrição original',
    categoria: 'geral',
    publicado: true,
});
function scenario() {
    const elements = new Map();
    const get = (id) => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
    };
    let cards = [];
    const writes = [];
    const commits = [];
    const state = { allowed: true, verify: null, editError: null, batchError: null };
    const cancelEdit = new Element();
    cancelEdit.dataset.close = 'edit-dialog';
    get('cancel-delete').dataset.close = 'delete-dialog';
    get('noticeList').querySelectorAll = () => cards.map((card) => card.checkbox);
    const context = vm.createContext({
        AbortController,
        document: {
            getElementById: get,
            createElement: () => new Element(),
            querySelectorAll: (selector) =>
                selector === '[data-close]'
                    ? [cancelEdit, get('cancel-delete')]
                    : [
                          ...elements.values(),
                          ...cards.flatMap((card) => [card.checkbox, card.edit, card.remove]),
                      ],
        },
    });
    vm.runInContext(source, context);
    const manager = context.iniciarGestaoAvisos({
        db: {},
        verificarAcesso: async () => (state.verify ? state.verify() : state.allowed),
        sdk: {
            doc: (_, ...path) => path.join('/'),
            serverTimestamp: () => 'SERVER_TIME',
            updateDoc: async (ref, data) => {
                if (state.editError) throw state.editError;
                writes.push({ ref, data });
            },
            writeBatch: () => {
                const refs = [];
                return {
                    delete: (ref) => refs.push(ref),
                    commit: async () => {
                        if (state.batchError) await state.batchError(refs);
                        commits.push(refs);
                    },
                };
            },
        },
    });
    function render(items) {
        cards = items.map((notice) => {
            const article = new Element();
            const checkbox = new Element();
            checkbox.matches = { '.notice-select': checkbox, '.notice-card': article };
            const edit = new Element();
            edit.dataset.action = 'edit';
            edit.matches['button[data-action]'] = edit;
            const remove = new Element();
            remove.dataset.action = 'delete';
            remove.matches['button[data-action]'] = remove;
            const controls = new Element();
            const selectors = {
                '.notice-admin': controls,
                '.notice-select': checkbox,
                '[data-action="edit"]': edit,
                '[data-action="delete"]': remove,
            };
            manager.prepareCard(
                {
                    querySelector: (selector) => selectors[selector],
                    querySelectorAll: () => [checkbox, edit, remove],
                },
                notice,
            );
            return { checkbox, edit, remove };
        });
        manager.updateNotices(items);
    }
    const card = (id) => cards.find((item) => item.checkbox.dataset.id === id);
    return {
        get,
        state,
        manager,
        render,
        writes,
        commits,
        card,
        click: (id, action) => get('noticeList').fire('click', card(id)[action]),
        select: async (id, checked) => {
            card(id).checkbox.checked = checked;
            await get('noticeList').fire('change', card(id).checkbox);
        },
    };
}

const selection = scenario();
selection.render(['a', 'b'].map(makeNotice));
assert.equal(selection.get('delete-selected').disabled, true);
await selection.select('a', true);
assert.equal(selection.get('selection-count').textContent, '1 aviso selecionado');
assert.equal(selection.get('select-all').indeterminate, true);
selection.render(['a', 'b', 'c'].map(makeNotice));
assert.equal(selection.card('a').checkbox.checked, true, 'mantém seleção após atualização');
assert.equal(selection.card('c').checkbox.checked, false, 'não seleciona novos avisos');
selection.get('select-all').checked = true;
await selection.get('select-all').fire('change');
assert.equal(selection.get('select-all').checked, true);
assert.equal(selection.get('select-all').indeterminate, false);
selection.render(['b'].map(makeNotice));
assert.equal(selection.get('selection-count').textContent, '1 aviso selecionado');
selection.get('select-all').checked = false;
await selection.get('select-all').fire('change');
assert.equal(selection.get('delete-selected').disabled, true);
selection.render([]);
assert.equal(selection.get('select-all').disabled, true);

const edit = scenario();
edit.render([makeNotice('a')]);
await edit.click('a', 'edit');
assert.equal(edit.get('edit-name').value, 'Aviso a');
assert.equal(edit.get('edit-description').value, 'Descrição original');
edit.get('edit-name').value = '   ';
await edit.get('edit-form').fire('submit');
assert.equal(edit.writes.length, 0, 'título em branco é rejeitado');
edit.get('edit-name').value = ' Novo título ';
edit.get('edit-description').value = ' Linha 1\nLinha 2 ';
edit.get('edit-category').value = 'evento';
edit.state.editError = { code: 'unavailable' };
await edit.get('edit-form').fire('submit');
assert.equal(edit.get('edit-dialog').open, true, 'erro preserva formulário');
assert.equal(edit.get('edit-name').disabled, false);
assert.match(edit.get('edit-feedback').textContent, /conexão/);
edit.state.editError = null;
await edit.get('edit-form').fire('submit');
assert.deepEqual(JSON.parse(JSON.stringify(edit.writes)), [
    {
        ref: 'avisos/a',
        data: {
            titulo: 'Novo título',
            descricao: 'Linha 1\nLinha 2',
            categoria: 'evento',
            atualizadoEm: 'SERVER_TIME',
        },
    },
]);
assert.equal(edit.get('edit-dialog').open, false);

const individual = scenario();
individual.render(['a', 'b', 'c'].map(makeNotice));
await individual.select('b', true);
await individual.click('a', 'remove');
assert.equal(individual.get('delete-preview').children[0].textContent, 'Aviso a');
await individual.get('cancel-delete').fire('click');
assert.equal(individual.get('delete-dialog').open, false);
assert.equal(individual.commits.length, 0, 'cancelar nunca exclui');
await individual.click('a', 'remove');
await individual.get('delete-form').fire('submit');
assert.deepEqual(
    individual.commits,
    [['avisos/a']],
    'exclusão individual não inclui seleção anterior',
);
assert.equal(individual.card('b').checkbox.checked, true);
await individual.select('c', true);
await individual.get('delete-selected').fire('click');
await individual.get('delete-form').fire('submit');
assert.deepEqual(individual.commits[1], ['avisos/b', 'avisos/c']);
assert.equal(individual.get('delete-selected').disabled, true);

const bulk = scenario();
bulk.render(Array.from({ length: 405 }, (_, i) => makeNotice(String(i))));
bulk.get('select-all').checked = true;
await bulk.get('select-all').fire('change');
await bulk.get('delete-selected').fire('click');
bulk.state.batchError = async () => {
    if (bulk.commits.length === 1) throw { code: 'unavailable' };
};
await bulk.get('delete-form').fire('submit');
assert.equal(bulk.commits[0].length, 400);
assert.equal(bulk.get('delete-dialog').open, true);
assert.equal(bulk.get('delete-preview').children.length, 5);
assert.match(bulk.get('delete-feedback').textContent, /400 avisos já foram excluídos/);
bulk.state.batchError = null;
await bulk.get('delete-form').fire('submit');
assert.deepEqual(bulk.commits[1], [
    'avisos/400',
    'avisos/401',
    'avisos/402',
    'avisos/403',
    'avisos/404',
]);

const revoked = scenario();
revoked.render([makeNotice('a')]);
await revoked.click('a', 'remove');
revoked.state.allowed = false;
await revoked.get('delete-form').fire('submit');
assert.equal(revoked.commits.length, 0);
assert.match(revoked.get('delete-feedback').textContent, /acesso administrativo/);
await revoked.click('a', 'edit');
await revoked.get('edit-form').fire('submit');
assert.equal(revoked.writes.length, 0);

const pending = scenario();
pending.render([makeNotice('a')]);
await pending.click('a', 'remove');
let resolveAccess;
pending.state.verify = () =>
    new Promise((resolve) => {
        resolveAccess = resolve;
    });
const submission = pending.get('delete-form').fire('submit');
await pending.get('delete-form').fire('submit');
assert.equal(pending.get('confirm-delete').disabled, true, 'bloqueia envio duplicado');
pending.manager.dispose();
resolveAccess(true);
await submission;
assert.equal(pending.commits.length, 0, 'sessão encerrada durante validação não grava');
assert.equal(pending.get('admin-toolbar').hidden, true);
assert.equal(pending.get('delete-dialog').open, false);
await pending.get('delete-form').fire('submit');
assert.equal(pending.commits.length, 0, 'remove eventos ao encerrar a sessão');

console.log(
    'OK: edição, validação, seleção, exclusão individual/múltipla, cancelamento, lotes, falhas, revogação e sessão encerrada.',
);
