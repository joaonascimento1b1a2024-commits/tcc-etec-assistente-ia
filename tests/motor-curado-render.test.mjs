// Motor curado no servidor Render: adaptador, modos e rota visitante.
// Somente transportes simulados; nenhuma chamada externa, chave real ou Firebase.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {hashIndice} from '../render-poc/motor-curado/curadoria-local.mjs';
import {criarEndpointVisitante} from '../functions/lib/assistente/visitante.js';
import {ErroRespostaTemporaria} from '../functions/lib/assistente/handler.js';

const require = createRequire(import.meta.url);
const {criarMotorCurado, resolverMotor, lerBase} = require('../render-poc/motor-curado.cjs');
const base = lerBase();
const ambiente = () => ({GEMINI_API_KEY: 'chave-sintetica'});

const gerado = corpo => new Response(JSON.stringify({candidates: [{finishReason: 'STOP',
    content: {role: 'model', parts: [{text: JSON.stringify(corpo)}]}}]}), {status: 200});
const vetor = () => Array.from({length: 768}, (_, i) => i === 0 ? 1 : 0);

// Embeddings sintéticos (sem semelhança real) e geração que cita o primeiro fato recebido.
function provedor({geracao, atraso = 0} = {}) {
    const chamadas = {embeddings: 0, geracao: 0, revisao: 0};
    const transporte = async (url, init) => {
        if (atraso) await new Promise(r => setTimeout(r, atraso));
        const corpo = JSON.parse(init.body);
        if (url.includes('Embed')) {
            chamadas.embeddings++;
            return new Response(JSON.stringify({embeddings: corpo.requests.map(() => ({values: vetor()}))}), {status: 200});
        }
        const pedido = JSON.parse(corpo.contents[0].parts[0].text);
        if ('resposta' in pedido) {chamadas.revisao++; return gerado({sustentada: true});}
        chamadas.geracao++;
        if (geracao) return geracao(pedido);
        return gerado({resposta: 'Resposta curada de teste.', ids: [pedido.fatos[0].id]});
    };
    return {transporte, chamadas};
}

const motor = (modo, opcoes = {}) => criarMotorCurado({modo, lerAmbiente: ambiente, base, ...opcoes});

test('SYLVINHO_MOTOR: padrão fluxo, valor inválido bloqueia e falta de chave volta ao fluxo', () => {
    assert.deepEqual({...resolverMotor({})}, {solicitado: 'fluxo', efetivo: 'fluxo', motivo: null});
    assert.equal(resolverMotor({SYLVINHO_MOTOR: ''}).efetivo, 'fluxo');
    assert.throws(() => resolverMotor({SYLVINHO_MOTOR: 'gemini'}), /SYLVINHO_MOTOR_INVALIDO/);
    assert.deepEqual({...resolverMotor({SYLVINHO_MOTOR: 'hibrido'})},
        {solicitado: 'hibrido', efetivo: 'fluxo', motivo: 'GEMINI_API_KEY_AUSENTE'});
    assert.equal(resolverMotor({SYLVINHO_MOTOR: 'hibrido', GEMINI_API_KEY: '  '}).efetivo, 'fluxo');
    assert.equal(resolverMotor({SYLVINHO_MOTOR: 'curado', GEMINI_API_KEY: 'x'}).efetivo, 'curado');
    assert.throws(() => criarMotorCurado({modo: 'fluxo', base}), /SYLVINHO_MOTOR_INVALIDO/);
});

test('base versionada: vetores correspondem exatamente aos registros curados', () => {
    assert.ok(base.registros.length >= 44);
    assert.ok(base.vetores, 'knowledge-local/embeddings-curados.json ausente');
    // Se falhar, a FAQ mudou sem reindexar: rode npm run indexar (scripts/indexar-embeddings-curados.mjs).
    assert.equal(base.vetores.hash, hashIndice(base.registros));
    assert.deepEqual(Object.keys(base.vetores.valores).sort(), base.registros.map(r => r.id).sort());
});

test('híbrido: pergunta coberta usa o fato curado certo (trancamento)', async () => {
    const p = provedor();
    const resposta = await motor('hibrido', {transporte: p.transporte})
        .responderConversa('Posso trancar a matrícula? Como funciona?', [], {uid: 'alice'});
    assert.equal(resposta, 'Resposta curada de teste.');
    assert.equal(p.chamadas.geracao, 1);
    assert.equal(p.chamadas.revisao, 1);
});

test('híbrido: sem evidência devolve null; curado responde com a orientação da Secretaria', async () => {
    const pergunta = 'Como peço revisão de nota?';
    const p1 = provedor();
    assert.equal(await motor('hibrido', {transporte: p1.transporte}).responderConversa(pergunta, [], {uid: 'a'}), null);
    assert.equal(p1.chamadas.geracao, 0);
    const p2 = provedor();
    const texto = await motor('curado', {transporte: p2.transporte}).responderConversa(pergunta, [], {uid: 'a'});
    assert.match(texto, /Secretaria confirma/);
});

test('híbrido: modelo sem fato aplicável (ids vazio) volta ao fluxo; curado orienta a Secretaria', async () => {
    // Caso real de 16/11: "dois cursos" trazia 5 fatos de outros assuntos e o modelo respondeu ids: [].
    const geracao = () => gerado({resposta: 'A Secretaria Acadêmica confirma isso.', ids: []});
    const pergunta = 'Posso trancar a matrícula? Como funciona?';
    const p1 = provedor({geracao});
    assert.equal(await motor('hibrido', {transporte: p1.transporte}).responderVisitante(pergunta), null);
    assert.equal(p1.chamadas.geracao, 1);
    assert.equal(p1.chamadas.revisao, 0);
    const p2 = provedor({geracao});
    assert.match(await motor('curado', {transporte: p2.transporte}).responderConversa(pergunta, [], {uid: 'a'}), /Secretaria confirma/);
    // ids com valor desconhecido continua sendo resposta inválida: nunca é exibida.
    // Com fato aprovado inequívoco (trancamento), o servidor mostra o texto aprovado.
    const p3 = provedor({geracao: () => gerado({resposta: 'x', ids: ['inexistente']})});
    assert.equal(await motor('hibrido', {transporte: p3.transporte}).responderVisitante(pergunta), fatoTrancamento);
});

const fatoTrancamento = base.registros.find(r => r.id === 'trancamento').resposta;

test('reserva direta: só existe com um fato aprovado inequívoco', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const modelo = base.registros.find(r => r.id === 'trancamento');
    const limite = async () => new Response('{}', {status: 429});
    const gerar = registros => criarGeminiCurado({registros, contatos: base.contatos, lerChave: () => 'x', transporte: limite, modelo: 'gemini-a', modeloReserva: ''});
    // Dois fatos empatados e nenhuma pergunta idêntica: sem reserva.
    const empatados = [{...modelo, id: 'tranc-a', pergunta: 'Trancamento da matrícula A', variacoes: []}, {...modelo, id: 'tranc-b', pergunta: 'Trancamento da matrícula B', variacoes: []}];
    const semReserva = await gerar(empatados).responder({pergunta: 'Como fazer o trancamento da matrícula?'});
    assert.equal(semReserva.tipo, 'falha');
    assert.equal(semReserva.reserva, undefined);
    // Um único fato com confiança alta (pergunta parecida, não idêntica): a falha leva o fato aprovado como reserva.
    const comReserva = await gerar([modelo]).responder({pergunta: 'O trancamento, como funciona?'});
    assert.equal(comReserva.tipo, 'falha');
    assert.equal(comReserva.codigo, 'HTTP_429');
    assert.deepEqual(comReserva.reserva, {texto: modelo.resposta, tipo: 'curado_direto', modo: 'bm25', ids: ['trancamento']});
});

test('pergunta idêntica a uma aprovada responde com o texto aprovado, sem chamar o Gemini', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const modelo = base.registros.find(r => r.id === 'trancamento');
    let chamadas = 0;
    const transporte = async () => { chamadas++; return new Response('{}', {status: 500}); };
    const gerar = () => criarGeminiCurado({registros: base.registros, contatos: base.contatos, vetores: base.vetores,
        embeddingConsulta: async () => { chamadas++; throw Error('NAO_CHAMAR'); }, lerChave: () => 'x', transporte, modelo: 'gemini-a', modeloReserva: ''});
    const r = await gerar().responder({pergunta: modelo.pergunta});
    assert.equal(r.tipo, 'curado_direto');
    assert.equal(r.texto, modelo.resposta);
    assert.deepEqual(r.ids, ['trancamento']);
    assert.equal(chamadas, 0, 'nem geração, nem revisão, nem embedding');
    // Com escopo (idade), o Gemini adapta a resposta: a pergunta exata não pula a geração.
    const comEscopo = await gerar().responder({pergunta: modelo.pergunta, escopo: {idade: 16}});
    assert.notEqual(comEscopo.tipo, 'curado_direto');
    assert.ok(chamadas > 0);
});

test('modelo sobrecarregado (5xx) fica em pausa curta e a pergunta seguinte vai direto ao próximo', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const modelo = base.registros.find(r => r.id === 'trancamento');
    const usados = [];
    const transporte = async url => {
        const nome = String(url).match(/models\/([^:]+):/)[1];
        usados.push(nome);
        if (nome === 'gemini-a') return new Response('{}', {status: 503});
        return new Response('{}', {status: 429});
    };
    const motorPausa = criarGeminiCurado({registros: [modelo], contatos: base.contatos, lerChave: () => 'x', transporte, modelo: 'gemini-a', modeloReserva: 'gemini-b'});
    await motorPausa.responder({pergunta: 'O trancamento, como funciona?'});
    assert.deepEqual(usados, ['gemini-a', 'gemini-b']);
    usados.length = 0;
    const segunda = await motorPausa.responder({pergunta: 'O trancamento, como funciona?'});
    assert.deepEqual(usados, [], 'os dois modelos estão em pausa: falha rápida, sem esperar o provedor');
    assert.equal(segunda.tipo, 'falha');
    assert.ok(segunda.reserva, 'a reserva continua disponível');
});

test('híbrido: busca vetorial indisponível sem resultado lexical também volta ao fluxo', async () => {
    const transporte = async url => url.includes('Embed') ? new Response('{}', {status: 503}) : assert.fail('NAO_GERAR');
    assert.equal(await motor('hibrido', {transporte}).responderVisitante('Como peço revisão de nota?'), null);
});

test('híbrido: informação pendente não cai no fluxo antigo (não inventa preço)', async () => {
    const p = provedor();
    const texto = await motor('hibrido', {transporte: p.transporte})
        .responderConversa('Quanto custa a camiseta do uniforme?', [], {uid: 'a'});
    assert.match(texto, /Secretaria confirma/);
    assert.equal(p.chamadas.geracao, 0);
});

test('limite em todos os modelos: com fato inequívoco mostra o texto aprovado; sem ele, híbrido usa o fluxo e curado vira erro recuperável', async () => {
    const eventos = [];
    const limite = provedor({geracao: () => new Response('{}', {status: 429})});
    assert.equal(await motor('hibrido', {transporte: limite.transporte, registrar: (e, d) => eventos.push({e, ...d})})
        .responderConversa('A matrícula, posso trancar?', [], {uid: 'a'}), fatoTrancamento);
    assert.ok(eventos.some(x => x.e === 'MOTOR_RESPOSTA_DIRETA' && x.motivo === 'HTTP_429'));
    const sobrecarga = provedor({geracao: () => new Response('{}', {status: 503})});
    assert.equal(await motor('hibrido', {transporte: sobrecarga.transporte}).responderVisitante('A matrícula, posso trancar?'), fatoTrancamento);
    // Sem reserva (dois fatos empatados), volta o comportamento anterior.
    const modelo = base.registros.find(r => r.id === 'trancamento');
    const empatados = {...base, registros: [{...modelo, id: 'tranc-a', pergunta: 'Trancamento da matrícula A', variacoes: []}, {...modelo, id: 'tranc-b', pergunta: 'Trancamento da matrícula B', variacoes: []}], vetores: null};
    const eventos2 = [];
    const limite2 = provedor({geracao: () => new Response('{}', {status: 429})});
    assert.equal(await motor('hibrido', {base: empatados, transporte: limite2.transporte, registrar: (e, d) => eventos2.push({e, ...d})})
        .responderConversa('Como fazer o trancamento da matrícula?', [], {uid: 'a'}), null);
    assert.ok(eventos2.some(x => x.e === 'MOTOR_FLUXO_RESERVA' && x.motivo === 'HTTP_429'));
    const limiteCurado = provedor({geracao: () => new Response('{}', {status: 429})});
    await assert.rejects(motor('curado', {base: empatados, transporte: limiteCurado.transporte})
        .responderConversa('Como fazer o trancamento da matrícula?', [], {uid: 'a'}),
    e => e instanceof ErroRespostaTemporaria && e.motivo === 'LIMITE_USO' && e.esperaSegundos === 30);
});

test('Regimento com moderação: uma menção sustentada pelo fato passa; excesso ou sem apoio é barrado', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    // Fato sintético que cita o Regimento: a base real pode deixar de citá-lo sem invalidar a regra.
    const registros = base.registros.map(r => r.id === 'tecnico-concomitante'
        ? {...r, resposta: r.resposta + ' Sobre outro ponto, o Regimento não traz uma regra.'} : r);
    const baseRegimento = {...base, registros, vetores: {...base.vetores, hash: hashIndice(registros)}};
    const casos = [
        {comRegimento: true, resposta: 'Pode fazer junto com o ensino médio. Sobre dois cursos técnicos, o Regimento não traz uma regra e a Secretaria confirma.', esperado: 'gemini_curado'},
        {comRegimento: true, resposta: 'O Regimento permite a forma concomitante. O Regimento não traz regra para dois cursos.', esperado: 'LINGUAGEM'},
        {comRegimento: false, resposta: 'Segundo o Regimento, o trancamento depende da Direção.', esperado: 'LINGUAGEM', pergunta: 'Posso trancar a matrícula? Como funciona?'},
    ];
    for (const caso of casos) {
        const transporte = async (url, init) => {
            const corpo = JSON.parse(init.body);
            if (url.includes('Embed')) return new Response(JSON.stringify({embeddings: corpo.requests.map(() => ({values: vetor()}))}), {status: 200});
            const pedido = JSON.parse(corpo.contents[0].parts[0].text);
            if ('resposta' in pedido) return gerado({sustentada: true});
            const fato = pedido.fatos.find(f => /\bregimento\b/i.test(f.texto) === caso.comRegimento);
            assert.ok(fato, 'a busca precisa trazer um fato ' + (caso.comRegimento ? 'com' : 'sem') + ' Regimento');
            return gerado({resposta: caso.resposta, ids: [fato.id]});
        };
        const m = criarGeminiCurado({...baseRegimento, lerChave: () => 'chave-sintetica', transporte, modelo: 'gemini-a', modeloReserva: ''});
        const r = await m.responder({pergunta: caso.pergunta || 'Posso fazer o curso técnico junto com o ensino médio, ou dois cursos técnicos ao mesmo tempo?'});
        assert.equal(r.tipo === 'falha' ? r.codigo : r.tipo, caso.esperado, caso.resposta);
    }
});

test('lista de modelos: pula os que estão no limite, na geração e na revisão', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const usados = [];
    let revisoes = 0;
    const transporte = async (url, init) => {
        const corpo = JSON.parse(init.body);
        if (url.includes('Embed')) return new Response(JSON.stringify({embeddings: corpo.requests.map(() => ({values: vetor()}))}), {status: 200});
        const modelo = url.split('/models/')[1].split(':')[0];
        const pedido = JSON.parse(corpo.contents[0].parts[0].text);
        usados.push(modelo + ('resposta' in pedido ? ':revisao' : ':geracao'));
        if (modelo === 'gemini-a' || modelo === 'gemini-b') return new Response('{}', {status: 429});
        if ('resposta' in pedido) {
            // A revisão do modelo que gerou também bate no limite; a próxima da lista revisa.
            if (modelo === 'gemini-c' && revisoes++ === 0) return new Response('{}', {status: 429});
            return gerado({sustentada: true});
        }
        return gerado({resposta: 'Resposta curada de teste.', ids: [pedido.fatos[0].id]});
    };
    const motorLista = criarGeminiCurado({...base, lerChave: () => 'chave-sintetica', transporte,
        modelo: 'gemini-a', modeloReserva: ' gemini-b, gemini-c ,gemini-d'});
    assert.deepEqual(motorLista.configuracao.modelos, ['gemini-a', 'gemini-b', 'gemini-c', 'gemini-d']);
    const r = await motorLista.responder({pergunta: 'Posso trancar a matrícula? Como funciona?'});
    assert.equal(r.tipo, 'gemini_curado');
    assert.equal(r.modelo, 'gemini-c');
    // a e b entram em espera após o 429 e não são chamados de novo na revisão.
    assert.deepEqual(usados, ['gemini-a:geracao', 'gemini-b:geracao', 'gemini-c:geracao', 'gemini-c:revisao', 'gemini-d:revisao']);
    assert.throws(() => criarGeminiCurado({...base, lerChave: () => 'x', modelo: 'gemini-a', modeloReserva: 'gemini-b,outro'}), /MODELO_INVALIDO/);
});

test('tempo excedido no provedor não cai no fluxo (somaria dois tempos de espera)', async () => {
    const {criarGeminiCurado} = await import('../render-poc/motor-curado/gemini-curado.mjs');
    const lento = provedor({geracao: () => {throw new Error('PROVEDOR_TIMEOUT');}});
    const r = await criarGeminiCurado({...base, lerChave: () => 'x', transporte: lento.transporte, modelo: 'gemini-a', modeloReserva: ''})
        .responder({pergunta: 'Posso trancar a matrícula? Como funciona?'});
    assert.equal(r.codigo, 'PROVEDOR_TIMEOUT');
    assert.match(r.texto, /demorou/);
    // Com fato inequívoco, o servidor mostra o texto aprovado em vez de pedir nova tentativa (sem somar o fluxo).
    const lentoAdaptador = provedor({geracao: () => {throw new Error('PROVEDOR_TIMEOUT');}});
    assert.equal(await motor('hibrido', {transporte: lentoAdaptador.transporte}).responderVisitante('Posso trancar a matrícula? Como funciona?'), fatoTrancamento);
    assert.equal(lentoAdaptador.chamadas.revisao, 0);
});

test('resposta não validada nunca é exibida: vira o fato aprovado inequívoco, sem fluxo reserva', async () => {
    const invalida = provedor({geracao: p => gerado({resposta: 'Custa R$ 999.', ids: [p.fatos[0].id]})});
    const texto = await motor('hibrido', {transporte: invalida.transporte})
        .responderConversa('Posso trancar a matrícula?', [], {uid: 'a'});
    assert.equal(texto, fatoTrancamento);
    assert.doesNotMatch(texto, /999/);
});

test('cache por conta: repete sem nova chamada para a mesma conta, nunca entre contas', async () => {
    const p = provedor();
    const m = motor('hibrido', {transporte: p.transporte});
    const pergunta = 'Posso trancar a matrícula? Como funciona?';
    await m.responderConversa(pergunta, [], {uid: 'alice'});
    await m.responderConversa(pergunta, [], {uid: 'alice'});
    assert.equal(p.chamadas.geracao, 1);
    await m.responderConversa(pergunta, [], {uid: 'bob'});
    assert.equal(p.chamadas.geracao, 2);
});

test('visitantes simultâneos não se bloqueiam na fila', async () => {
    const p = provedor({atraso: 30});
    const m = motor('hibrido', {transporte: p.transporte});
    const respostas = await Promise.all([
        m.responderVisitante('Posso trancar a matrícula? Como funciona?'),
        m.responderVisitante('De presença, preciso de quantos %?'),
    ]);
    assert.deepEqual(respostas, ['Resposta curada de teste.', 'Resposta curada de teste.']);
});

test('visitante: esclarecimento avisa que o chat não guarda contexto; saudação não', async () => {
    const m = motor('hibrido', provedor());
    const esclarecimento = await m.responderVisitante('Como faço a matrícula');
    assert.match(esclarecimento, /^Você quer fazer a matrícula inicial ou renovar.*Reenvie a pergunta completa/);
    const saudacao = await m.responderVisitante('Oi');
    assert.doesNotMatch(saudacao, /Reenvie/);
});

test('diagnóstico não registra a pergunta nem a resposta', async () => {
    const eventos = [];
    const pergunta = 'Posso trancar a matrícula? Sou a Maria Silva.';
    await motor('hibrido', {...provedor(), registrar: (c, d) => eventos.push([c, d])})
        .responderVisitante(pergunta).catch(() => {});
    const texto = JSON.stringify(eventos);
    assert.ok(eventos.some(([c]) => c === 'MOTOR_RESPOSTA'));
    assert.doesNotMatch(texto, /Maria|trancar|Resposta curada/);
});

test('falha ao carregar o motor: híbrido usa o fluxo, curado responde indisponível', async () => {
    const quebrada = {...base, registros: [{id: 'ID INVALIDO'}]};
    assert.equal(await motor('hibrido', {base: quebrada}).responderVisitante('Posso trancar?'), null);
    await assert.rejects(motor('curado', {base: quebrada}).responderVisitante('Posso trancar?'),
        e => e instanceof ErroRespostaTemporaria && e.motivo === 'INDISPONIVEL');
});

// Rota visitante com o gancho opcional.
async function visitante(deps, pergunta = 'Posso trancar a matrícula?') {
    const endpoint = criarEndpointVisitante(() => deps, () => 'https://sylvinho.web.app');
    const res = {code: null, body: null, headers: {}, headersSent: false,
        set(n, v) {this.headers[n] = v; return this;}, vary() {return this;},
        status(c) {this.code = c; return this;}, json(b) {this.body = b; this.headersSent = true; return this;}};
    await endpoint({method: 'POST', body: {pergunta}, get: n => n.toLowerCase() === 'origin' ? 'https://sylvinho.web.app' : undefined}, res);
    return res;
}
const antigo = () => {
    const calls = {antigo: 0};
    return {calls, recuperarConhecimento: async () => {calls.antigo++; return [];},
        gerarResposta: async () => 'Resposta do fluxo documental'};
};

test('rota visitante: usa o motor curado e só chama o fluxo antigo quando recebe null', async () => {
    const a = antigo();
    let r = await visitante({...a, responderVisitante: async () => 'Resposta curada'});
    assert.equal(r.code, 200);
    assert.equal(r.body.resposta, 'Resposta curada');
    assert.equal(a.calls.antigo, 0);
    r = await visitante({...a, responderVisitante: async () => null});
    assert.equal(r.body.resposta, 'Resposta do fluxo documental');
    assert.equal(a.calls.antigo, 1);
    r = await visitante(antigo());
    assert.equal(r.body.resposta, 'Resposta do fluxo documental');
});

test('rota visitante: pergunta sem palavra-chave tenta o motor; sem fato, mantém o esclarecimento sem fluxo', async () => {
    // Frase sem termo escolar reconhecido pela classificação local (continua "ambígua").
    const pergunta = 'Dá para fazer as duas coisas juntas?';
    let a = antigo();
    let r = await visitante({...a, responderVisitante: async () => 'Sim, na forma concomitante.'}, pergunta);
    assert.equal(r.body.resposta, 'Sim, na forma concomitante.');
    a = antigo();
    r = await visitante({...a, responderVisitante: async () => null}, pergunta);
    assert.match(r.body.resposta, /Sobre qual procedimento/);
    assert.equal(a.calls.antigo, 0);
    // Modo fluxo (sem gancho): comportamento anterior.
    a = antigo();
    r = await visitante(a, pergunta);
    assert.match(r.body.resposta, /Sobre qual procedimento/);
    assert.equal(a.calls.antigo, 0);
    // Fora de escopo e saudação continuam locais, sem consultar o motor.
    let consultas = 0;
    for (const p of ['Qual a capital da França?', 'Oi']) {
        r = await visitante({...antigo(), responderVisitante: async () => {consultas++; return 'x';}}, p);
        assert.notEqual(r.body.resposta, 'x');
    }
    assert.equal(consultas, 0);
});

test('rota visitante: erro recuperável vira 429/503 com Retry-After, como na rota da conta', async () => {
    let r = await visitante({...antigo(), responderVisitante: async () => {throw new ErroRespostaTemporaria('LIMITE_USO', 30);}});
    assert.equal(r.code, 429);
    assert.equal(r.headers['Retry-After'], '30');
    assert.equal(r.body.codigo, 'LIMITE_USO');
    r = await visitante({...antigo(), responderVisitante: async () => {throw new ErroRespostaTemporaria('TEMPO_EXCEDIDO', 2);}});
    assert.equal(r.code, 503);
    r = await visitante({...antigo(), responderVisitante: async () => {throw new Error('interno');}});
    assert.equal(r.code, 500);
});

// Servidor documental completo com Firebase e provedor simulados.
const {criarDependenciasDocumentais, lerConfiguracaoDocumental} = require('../render-poc/documental.cjs');
const {criarServidor} = require('../render-poc/server.cjs');
const envDocumental = {
    RENDER: 'true', NODE_ENV: 'production', SYLVINHO_POC_MODE: 'documental',
    GCLOUD_PROJECT: 'tcc-ia-d8891', FIRESTORE_DATABASE_ID: '(default)', SYLVINHO_DOCUMENTAL_ENABLED: 'true',
    GOOGLE_APPLICATION_CREDENTIALS: '/etc/secrets/sylvinho-firebase-admin.json',
    SYLVINHO_SERVICE_ACCOUNT_EMAIL: 'sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com',
    ASSISTENTE_CORS_ORIGINS: 'https://sylvinho.web.app',
};
function depsDocumentais(env) {
    return criarDependenciasDocumentais(lerConfiguracaoDocumental(env), {
        lerAmbiente: () => env,
        lerArquivo: () => JSON.stringify({type: 'service_account', project_id: env.GCLOUD_PROJECT,
            client_email: env.SYLVINHO_SERVICE_ACCOUNT_EMAIL, private_key: '-----BEGIN PRIVATE KEY----- SOMENTE MOCK',
            token_uri: 'https://oauth2.googleapis.com/token'}),
        carregar(nome) {
            if (nome === 'firebase-admin/app') return {getApps: () => [], cert: () => ({}), initializeApp: () => ({})};
            if (nome === 'firebase-admin/auth') return {getAuth: () => ({async verifyIdToken() {throw Error('invalido');}})};
            if (nome === 'firebase-admin/firestore') return {getFirestore: () => ({}), FieldValue: {serverTimestamp: () => 1}};
            assert.fail('modulo inesperado');
        },
    });
}

test('produção: SYLVINHO_MOTOR ausente ou fluxo mantém exatamente as dependências anteriores', t => {
    t.mock.method(console, 'info', () => {});
    const chaves = env => Object.keys(depsDocumentais(env)).sort();
    const antes = chaves(envDocumental);
    assert.deepEqual(chaves({...envDocumental, SYLVINHO_MOTOR: 'fluxo', GEMINI_API_KEY: 'x'}), antes);
    assert.deepEqual(chaves({...envDocumental, SYLVINHO_MOTOR: 'hibrido'}), antes, 'sem chave volta ao fluxo');
    assert.ok(!antes.includes('responderConversa') && !antes.includes('responderVisitante'));
    assert.throws(() => lerConfiguracaoDocumental({...envDocumental, SYLVINHO_MOTOR: 'outro'}), /SYLVINHO_MOTOR_INVALIDO/);
});

test('produção híbrida: HTTP visitante -> motor curado -> Gemini simulado; health identifica motor', async t => {
    const env = {...envDocumental, SYLVINHO_MOTOR: 'hibrido', GEMINI_API_KEY: 'chave-sintetica'};
    const logs = [];
    t.mock.method(console, 'info', (...itens) => logs.push(itens.join(' ')));
    const realFetch = globalThis.fetch;
    const p = provedor();
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        urls.push(String(url));
        assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\//);
        assert.equal(init.headers['x-goog-api-key'], 'chave-sintetica');
        return p.transporte(url, init);
    });
    const antes = {...process.env};
    t.after(() => {for (const k of ['SYLVINHO_MOTOR', 'GEMINI_API_KEY', 'RENDER_GIT_COMMIT']) if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k];});
    Object.assign(process.env, {SYLVINHO_MOTOR: 'hibrido', GEMINI_API_KEY: 'chave-sintetica', RENDER_GIT_COMMIT: 'abcdef1234567890'});
    const deps = depsDocumentais(env);
    assert.equal(typeof deps.responderConversa, 'function');
    const server = criarServidor({config: lerConfiguracaoDocumental(env), obterDependencias: () => deps});
    server.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    t.after(() => new Promise(r => {server.close(r); server.closeAllConnections();}));
    const base = 'http://127.0.0.1:' + server.address().port;
    const saude = await (await realFetch(base + '/health')).json();
    assert.deepEqual(saude, {status: 'ok', service: 'sylvinho-backend', motor: 'hibrido', revisao: 'abcdef1'});
    assert.doesNotMatch(JSON.stringify(saude), /chave-sintetica/);
    const r = await realFetch(base + '/perguntarVisitante', {method: 'POST',
        headers: {'Content-Type': 'application/json', Origin: 'https://sylvinho.web.app'},
        body: JSON.stringify({pergunta: 'Posso trancar a matrícula? Como funciona?'})});
    assert.equal(r.status, 200);
    // Produção liga mostrarFontes: a resposta aprovada vem seguida do bloco de fontes oficiais.
    const [textoResposta, blocoFontes] = (await r.json()).resposta.split('\n\n[[FONTES]]');
    assert.equal(textoResposta, 'Resposta curada de teste.');
    assert.ok(JSON.parse(blocoFontes).every(fonte => /^https:\/\//.test(fonte.url)));
    assert.equal(p.chamadas.geracao, 1);
    assert.equal(p.chamadas.revisao, 1);
    assert.ok(logs.some(l => l.includes('MOTOR_RESPOSTA')));
    assert.doesNotMatch(logs.join('\n'), /trancar|chave-sintetica|Resposta curada/);
});

test('chat logado: saudação e perguntas sobre o assistente respondem sem busca nem Gemini', async () => {
    const {IDENTIDADE_ESCOPO} = await import('../functions/lib/assistente/escopo.js');
    const p = provedor();
    const m = motor('hibrido', {transporte: p.transporte});
    assert.equal(await m.responderConversa('Quem é você?', [], {uid: 'a'}), IDENTIDADE_ESCOPO);
    assert.equal(p.chamadas.geracao, 0);
    assert.equal(p.chamadas.revisao, 0);
});

test('chat logado: pergunta completa responde direto mesmo com histórico; acompanhamento continua no Gemini', async () => {
    const p = provedor();
    const m = motor('hibrido', {transporte: p.transporte});
    const historico = [{remetente: 'user', texto: 'Como funciona o Vestibulinho?'}, {remetente: 'bot', texto: 'O Vestibulinho é o processo seletivo.'}];
    const documentos = base.registros.find(r => r.id === 'matricula-documentos');
    assert.equal(await m.responderConversa('Quais documentos preciso para me matricular?', historico, {uid: 'a'}), documentos.resposta);
    assert.equal(p.chamadas.geracao, 0);
    // "Tenho 16 anos" no histórico muda o escopo do acompanhamento: o Gemini adapta a resposta.
    const comIdade = [{remetente: 'user', texto: 'Tenho 16 anos e quero fazer matrícula'}, {remetente: 'bot', texto: 'Certo.'}];
    await m.responderConversa('precisa de responsável?', comIdade, {uid: 'b'});
    assert.ok(p.chamadas.geracao > 0);
});

test('fontes: com mostrarFontes, resposta da base curada leva as fontes oficiais; sem a opção, o texto não muda', async () => {
    const {MARCADOR_FONTES} = require('../render-poc/motor-curado.cjs');
    const modelo = base.registros.find(r => r.id === 'frequencia');
    const comFontes = await motor('hibrido', {...provedor(), mostrarFontes: true}).responderVisitante(modelo.pergunta);
    const [texto, bloco] = comFontes.split(MARCADOR_FONTES);
    assert.equal(texto, modelo.resposta);
    const fontes = JSON.parse(bloco);
    assert.ok(fontes.length >= 1 && fontes.length <= 4);
    assert.ok(fontes.every(f => f.titulo && /^https:\/\//.test(f.url)));
    assert.ok(fontes.some(f => /75%/.test(f.trecho || '')));
    assert.equal(await motor('hibrido', provedor()).responderVisitante(modelo.pergunta), modelo.resposta);
    // Respostas que não vêm da base curada (social, esclarecimento) não levam fontes.
    const social = await motor('hibrido', {...provedor(), mostrarFontes: true}).responderVisitante('Quem é você?');
    assert.ok(!social.includes(MARCADOR_FONTES));
});
