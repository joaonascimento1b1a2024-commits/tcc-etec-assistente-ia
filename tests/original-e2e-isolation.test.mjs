import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const require = createRequire(import.meta.url);
const {carregarCorpusOriginal, criarLeitorOriginalLocal, CORPUS_SHA256} = require('../local-e2e/original-corpus.cjs');
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const env = {SYLVINHO_LOCAL_E2E: '1', GCLOUD_PROJECT: 'demo-sylvinho-render-poc',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'};
const disponivel = existsSync(new URL('../.cache/rag-original-auditoria.json', import.meta.url));

test('leitor recusa projeto real antes de ler arquivo ou inicializar SDK', () => {
    assert.throws(() => carregarCorpusOriginal({...env, GCLOUD_PROJECT: 'tcc-ia-d8891'}), /LOCAL_EMULATORS_REQUIRED/);
    assert.throws(() => carregarCorpusOriginal({}), /LOCAL_EMULATORS_REQUIRED/);
});

test('leitor recusa hosts sem isolamento e flag ausente', () => {
    for (const change of [{FIREBASE_AUTH_EMULATOR_HOST: 'example.invalid:9099'},
        {FIRESTORE_EMULATOR_HOST: undefined}, {SYLVINHO_LOCAL_E2E: '0'}]) {
        assert.throws(() => carregarCorpusOriginal({...env, ...change}), /LOCAL_EMULATORS_REQUIRED/);
    }
});

test('snapshot integral validado por SHA256 sem consultar Firestore', {skip: !disponivel}, async () => {
    const docs = carregarCorpusOriginal(env);
    assert.equal(docs.length, 514);
    assert.equal(new Set(docs.map(d => d.documentoId)).size, 3);
    assert.match(CORPUS_SHA256, /^[a-f0-9]{64}$/);
    const leitor = criarLeitorOriginalLocal(env);
    assert.ok((await leitor('Qual a frequência mínima para aprovação?')).some(d => /Artigo 83/.test(d.titulo)));
    assert.deepEqual(await leitor('Qual o procedimento para transporte interplanetário?'), []);
    assert.doesNotMatch(read('local-e2e/original-corpus.cjs'), /firebase-admin|firebase-tools|fetch\(|\.collection\(/);
});

test('flag original exige documental e proibe mistura academica antes de preparar ambiente', () => {
    for (const args of [['--original'], ['--original', '--documental', '--academica']]) {
        assert.throws(() => execFileSync(process.execPath, ['local-e2e/auth-run.mjs', ...args],
            {cwd: new URL('../', import.meta.url), stdio: 'pipe'}), /Command failed/);
    }
});

test('staging original identifica documentos reais sem alterar HTML de publicacao', () => {
    const source = read('local-e2e/prepare-history.mjs');
    assert.match(source, /if \(original\)/);
    assert.match(source, /SYLVINHO_RAG_ORIGINAL_LOCAL=1/);
    assert.match(source, /documentos de referência/);
    assert.match(read('public/Logado/Home/home.html'), /Protótipo de TCC/);
    assert.doesNotMatch(read('public/Logado/Home/home.html'), /dados fictícios/);
    assert.match(read('public/Logado/Home/assistente-config.js'), /endpoint: ''/);
});

test('modo original nao importa documentos e evidencia apenas fontes autorizadas', () => {
    const runner = read('local-e2e/auth-run.mjs');
    assert.match(runner, /if \(!original\) await prepararFixturesDocumentais/);
    assert.match(read('local-e2e/function.cjs'), /original \? \{recuperarConhecimento: leitorOriginal\}/);
    const scenarios = read('local-e2e/original-scenarios.mjs');
    assert.doesNotMatch(scenarios, /:commit|setDoc\(|updateDoc\(|owner|firestore\.googleapis/);
    assert.match(scenarios, /messageId/);
    assert.match(scenarios, /connectionrefused/);
    assert.match(scenarios, /page\.reload/);
});
