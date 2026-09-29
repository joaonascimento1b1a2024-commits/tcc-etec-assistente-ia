// Testes reais das regras, exclusivamente nos emuladores e em um projeto demo.
// Não usa credenciais, contas ou documentos do ambiente de produção.
import assert from 'node:assert/strict';
const project = 'demo-etec-rbac';
const root = `http://127.0.0.1:18080/v1/projects/${project}/databases/(default)/documents`;
const documentName = (path) => `projects/${project}/databases/(default)/documents/${path}`;
const encode = (value) =>
    typeof value === 'boolean'
        ? { booleanValue: value }
        : typeof value === 'string'
          ? { stringValue: value }
          : Array.isArray(value)
            ? { arrayValue: { values: value.map(encode) } }
            : { mapValue: { fields: fields(value) } };
const fields = (data) =>
    Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));

async function request(path, token, method = 'GET', body) {
    const response = await fetch(`${root}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
}
async function signup(name) {
    const response = await fetch(
        'http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `${name}@example.test`,
                password: 'test-password-123',
                returnSecureToken: true,
            }),
        },
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    return { uid: data.localId, token: data.idToken };
}
async function write(path, data, token, times = []) {
    return request(':commit', token, 'POST', {
        writes: [
            {
                update: { name: documentName(path), fields: fields(data) },
                ...(times.length
                    ? {
                          updateTransforms: times.map((fieldPath) => ({
                              fieldPath,
                              setToServerValue: 'REQUEST_TIME',
                          })),
                      }
                    : {}),
            },
        ],
    });
}
function expect(result, status, label) {
    assert.equal(result.status, status, `${label}: ${JSON.stringify(result.data)}`);
    console.log(`OK: ${label}`);
}

const admin = await signup(`admin-${Date.now()}`);
const aluno = await signup(`aluno-${Date.now()}`);
const outro = await signup(`outro-${Date.now()}`);
const notice = {
    titulo: 'Calendário escolar',
    descricao: 'Aviso de teste',
    categoria: 'geral',
    publicado: true,
};
expect(
    await request(`/administradores/${aluno.uid}`, aluno.token),
    404,
    'aluno consulta cargo inexistente',
);
expect(await request(`/administradores/${aluno.uid}`), 403, 'visitante não consulta cargo');
for (const user of [admin, aluno, outro]) {
    expect(
        await write(
            `users/${user.uid}`,
            { uid: user.uid, nome: 'Teste', email: 'teste@example.test' },
            user.token,
        ),
        200,
        'cadastro do próprio perfil',
    );
}
expect(
    await write(`users/${aluno.uid}`, { admin: true, cargo: 'admin' }, aluno.token),
    200,
    'perfil editável não é fonte de autorização',
);
expect(
    await write(`avisos/bloqueado`, notice, aluno.token, ['criadoEm']),
    403,
    'aluno não publica aviso, mesmo alterando perfil',
);
expect(
    await write(
        `administradores/${aluno.uid}`,
        { ativo: true, promovidoPor: aluno.uid },
        aluno.token,
        ['criadoEm'],
    ),
    403,
    'aluno não se promove',
);

// "owner" é exclusivo do emulador; simula o cadastro inicial pelo console.
expect(
    await write(`administradores/${admin.uid}`, { ativo: true }, 'owner'),
    200,
    'bootstrap pelo ambiente confiável',
);
expect(
    await request(`/administradores/${admin.uid}`, aluno.token),
    403,
    'aluno não consulta cargo alheio',
);
expect(
    await request(`/users/${outro.uid}`, admin.token),
    200,
    'administrador consulta perfil por UID',
);
expect(await request(`/users/${outro.uid}`, aluno.token), 403, 'aluno não consulta perfil alheio');
expect(await request('/users', admin.token), 403, 'administrador não lista todos os perfis');
expect(
    await request(`/avisos/novo`, admin.token),
    404,
    'administrador pode verificar ID de aviso ainda inexistente',
);
expect(
    await write(`avisos/publicado`, notice, admin.token, ['criadoEm']),
    200,
    'administrador publica aviso',
);
expect(
    await write(`avisos/invalido`, { ...notice, categoria: 'inexistente' }, admin.token, [
        'criadoEm',
    ]),
    403,
    'contrato de aviso inválido bloqueado',
);
expect(await request('/avisos/publicado', aluno.token), 200, 'aluno lê aviso publicado');
expect(
    await write(`avisos/rascunho`, { ...notice, publicado: false }, admin.token, ['criadoEm']),
    200,
    'administrador pode criar rascunho',
);
expect(await request('/avisos/rascunho', aluno.token), 403, 'aluno não lê rascunho');

expect(
    await write(
        `administradores/${outro.uid}`,
        { ativo: true, promovidoPor: aluno.uid },
        admin.token,
        ['criadoEm'],
    ),
    403,
    'não aceita autoria falsificada',
);
expect(
    await write(
        'administradores/uid-inexistente',
        { ativo: true, promovidoPor: admin.uid },
        admin.token,
        ['criadoEm'],
    ),
    403,
    'não promove perfil inexistente',
);
expect(
    await write(
        `administradores/${outro.uid}`,
        { ativo: true, promovidoPor: admin.uid },
        admin.token,
        ['criadoEm'],
    ),
    200,
    'administrador promove outra conta',
);
expect(
    await write('avisos/novo-admin', notice, outro.token, ['criadoEm']),
    200,
    'cargo novo autoriza sem trocar token',
);
expect(
    await write(`administradores/${outro.uid}`, { ativo: false }, admin.token),
    403,
    'site não altera permissões existentes',
);
expect(
    await write(`administradores/${outro.uid}`, { ativo: false }, 'owner'),
    200,
    'console revoga acesso',
);
expect(
    await write('avisos/revogado', notice, outro.token, ['criadoEm']),
    403,
    'revogação bloqueia imediatamente novas publicações',
);
expect(
    await write(
        `administradores/${aluno.uid}`,
        { ativo: true, promovidoPor: outro.uid },
        outro.token,
        ['criadoEm'],
    ),
    403,
    'revogado não promove outras contas',
);
expect(
    await request(`/users/${aluno.uid}/conversas/privada`, admin.token),
    403,
    'admin não acessa conversa alheia',
);
console.log('Todos os testes de autorização passaram. Nenhuma alteração em produção.');
