import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('raiz do Hosting tem aviso acadêmico acessível', () => { assert.match(read('public/index.html'), /class="academic-demo-banner" role="note"/); assert.match(read('public/index.html'), /não é atendimento oficial da escola/); });
test('Avisos acadêmicos não carregam SDK, Firestore ou controles administrativos', async () => {
    const elements = new Map(); const get = id => { if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', addEventListener() {}, setAttribute() {}, replaceChildren(...items) { this.textContent = items.map(i => i.textContent).join(''); } }); return elements.get(id); };
    vm.runInNewContext(read('public/Logado/Avisos/avisos.js').replaceAll('import(', 'blocked('), { document: { documentElement: { dataset: { demoAcademica: 'true' } }, createElement: () => ({ textContent: '' }), querySelector: get }, window: {}, console, blocked() { assert.fail('Consulta institucional proibida'); } });
    await new Promise(resolve => setImmediate(resolve));
    assert.match(get('#noticeList').textContent, /Fixture de demonstração/); assert.equal(get('#retry').hidden, true);
    assert.match(read('public/Logado/Avisos/avisos.html'), /data-demo-academica="true"/);
});
test('Serviços mantém chat web sem prometer WhatsApp ou disponibilidade contínua', () => {
    const s = read('public/Logado/Serviços/servicos.html'); assert.doesNotMatch(s, /<script src="servicos.js"|href="https:\/\/web.whatsapp.com|Disponível 24 horas/);
    assert.match(s, /Não há integração com WhatsApp/); assert.match(s, /href="..\/Home\/home.html"/);
});
test('apresentação não promete base oficial, contatos pessoais ou atendimento 24h', () => {
    assert.doesNotMatch(read('public/Pagina-Inicial/pagina-in.html'), /Dados oficiais da ETEC sempre atualizados|Atendimento 24h/);
    assert.doesNotMatch(read('public/Sobre/sobre.html'), /mailto:|@gmail.com/);
});
