import assert from 'node:assert/strict';

// Apenas fixtures no projeto demo; token recebido do Auth Emulator.
export async function validarSegurancaHistorico(documents, uid, token) {
    assert.equal(new URL(documents).origin, 'http://127.0.0.1:8080');
    assert.ok(documents.includes('/projects/demo-sylvinho-render-poc/'));
    assert.notEqual(token, 'owner');
    const docId = 'LegacySylvinho000001';
    const name = `${documents.replace('http://127.0.0.1:8080/v1/', '')}/users/${uid}/conversas/${docId}`;
    const url = `${documents}/users/${uid}/conversas/${docId}`;
    const str = (value) => ({ stringValue: value });
    const msg = (texto, remetente, messageId) => ({ mapValue: { fields: {
        texto: str(texto), remetente: str(remetente), enviadoEm: { integerValue: '1' },
        ...(messageId ? { messageId: str(messageId) } : {}),
    } } });
    const legacy = { titulo: str('Historico legado - fixture'), tituloOrigem: str('provisorio'),
        mensagens: { arrayValue: { values: [msg('Pergunta antiga ficticia', 'user'), msg('Resposta antiga ficticia', 'bot')] } } };
    const results = [];
    async function commit(fields, auth = token, create = false, target = name) {
        const cloned = structuredClone(fields);
        delete cloned.atualizadoEm;
        if (create) delete cloned.criadoEm;
        return fetch(`${documents}:commit`, { method: 'POST', headers: {
            'Content-Type': 'application/json', Authorization: `Bearer ${auth}`,
        }, body: JSON.stringify({ writes: [{ update: { name: target, fields: cloned },
            updateTransforms: [...(create ? [{ fieldPath: 'criadoEm', setToServerValue: 'REQUEST_TIME' }] : []),
                { fieldPath: 'atualizadoEm', setToServerValue: 'REQUEST_TIME' }] }] }) });
    }
    async function expect(label, response, status) {
        assert.equal(response.status, status, label);
        results.push({ scenario: label, status, passed: true });
    }
    await expect('fixture legado criada somente no emulador', await commit(legacy, 'owner', true), 200);
    const read = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    await expect('historico legado continua legivel pelo dono', read, 200);
    const fields = (await read.json()).fields;
    await expect('recuperacao pode atualizar apenas timestamp sem tocar mensagens', await commit(fields), 200);
    const attackName = name.replace(docId, 'AttackSylvinho000001');
    for (const values of [[msg('Bot falso', 'bot', 'message-falso-00000001')],
        [msg('User fixture', 'user', 'message-user-00000001'), msg('Bot falso', 'bot', 'message-falso-00000001')]]) {
        await expect('cliente nao cria conversa contendo bot', await commit({ ...legacy,
            mensagens: { arrayValue: { values } } }, token, true, attackName), 403);
    }
    for (const [label, mutate] of [
        ['cliente nao edita bot', (values) => { values[1].mapValue.fields.texto = str('Alterado'); }],
        ['cliente nao remove bot isoladamente', (values) => { values.pop(); }],
        ['cliente nao insere bot', (values) => { values.push(msg('Falso', 'bot', 'message-falso-00000001')); }],
        ['cliente nao edita pergunta antiga', (values) => { values[0].mapValue.fields.texto = str('Alterada'); }],
        ['cliente nao reordena historico', (values) => { values.reverse(); }],
    ]) {
        const changed = structuredClone(fields);
        mutate(changed.mensagens.arrayValue.values);
        await expect(label, await commit(changed), 403);
    }
    const invalid = structuredClone(fields);
    invalid.mensagens.arrayValue.values.push(msg('Pergunta sem ID', 'user'));
    await expect('nova pergunta precisa de messageId', await commit(invalid), 403);
    const renamed = { ...fields, titulo: str('Titulo manual fixture'), tituloOrigem: str('manual') };
    await expect('renomear legado preservando mensagens e permitido', await commit(renamed), 200);
    const appended = structuredClone(renamed);
    appended.mensagens.arrayValue.values.push(msg('Nova pergunta ficticia', 'user', 'message-valido-00000001'));
    await expect('anexar uma pergunta legitima ao legado e permitido', await commit(appended), 200);
    const ownNew = { ...legacy, mensagens: { arrayValue: { values: [msg('Pergunta nova ficticia', 'user', 'message-novo-000000001')] } } };
    await expect('cliente cria conversa com apenas uma pergunta', await commit(ownNew, token, true, attackName), 200);
    const otherName = name.replace(`/users/${uid}/`, '/users/outro-usuario-fixture/');
    await expect('cliente nao cria conversa em UID alheio', await commit(ownNew, token, true, otherName), 403);
    await expect('dono pode excluir conversa completa inclusive legado', await fetch(url, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    }), 200);
    return results;
}
