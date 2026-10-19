import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../functions/package.json', import.meta.url));
export const IDS = Object.freeze(['demo-academica-v1-matricula', 'demo-academica-v1-declaracao', 'demo-academica-v1-biblioteca']);
export const PROJECT = 'tcc-ia-d8891';
export const DEMO = 'demo-sylvinho-render-poc';
const DIGEST = 'ac7d31ab93cf458af132fe5c7d3e16259b79bfd727661a001aba26d69857b281';
export function validarManifesto(value) {
    assert.equal(createHash('sha256').update(JSON.stringify(value)).digest('hex'), DIGEST, 'MANIFESTO_NAO_APROVADO');
    assert.deepEqual(value.documentos.map(d => d.id).sort(), [...IDS].sort());
    return value.documentos.map(d => ({ id: d.id, dados: { ...d.dados } }));
}
export function validarOpcoes(options) {
    for (const key of ['apply', 'emulator', 'checkExisting'])
        if (options[key] !== undefined && typeof options[key] !== 'boolean') throw Error('OPCAO_INVALIDA');
    if (options.project !== (options.emulator ? DEMO : PROJECT) || options.database !== '(default)')
        throw Error('PROJETO_OU_BANCO_INVALIDO');
    if (options.apply && options.confirm !== 'CRIAR_3_FIXTURES:' + options.project + ':(default)')
        throw Error('CONFIRMACAO_EXPLICITA_OBRIGATORIA');
    return options;
}
export async function importar(options, { criarCliente, manifesto = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8')) } = {}) {
    validarOpcoes(options);
    const documents = validarManifesto(manifesto);
    const result = { mode: options.apply ? 'criacao' : 'simulacao', project: options.project, database: options.database,
        ids: [...IDS], remotoVerificado: false, gravados: 0 };
    // Padrão totalmente offline: nem carrega SDK nem resolve credenciais.
    if (!options.apply && !options.checkExisting) return result;
    if (typeof criarCliente !== 'function') throw Error('CLIENTE_EXPLICITO_OBRIGATORIO');
    const db = await criarCliente(options);
    try {
        if (db.projectId !== options.project || db.databaseId !== options.database) throw Error('DESTINO_CLIENTE_INVALIDO');
        const refs = documents.map(d => db.collection('conhecimento').doc(d.id));
        const snapshots = await db.getAll(...refs);
        if (snapshots.length !== 3 || snapshots.some(s => s.exists)) throw Error('COLISAO_IMPORTACAO_INTERROMPIDA');
        result.remotoVerificado = true;
        if (!options.apply) return result;
        // create usa precondição exists=false; commit é atômico inclusive em colisão concorrente.
        const batch = db.batch();
        documents.forEach((d, i) => batch.create(refs[i], d.dados));
        await batch.commit();
        return { ...result, gravados: documents.length };
    } finally { await db.terminate?.(); }
}
export function parseArgs(args) {
    const options = { apply: false, emulator: false, checkExisting: false };
    const values = { '--project': 'project', '--database': 'database', '--confirm': 'confirm', '--credentials-file': 'credentialFile' };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--apply') options.apply = true;
        else if (arg === '--emulator') options.emulator = true;
        else if (arg === '--check-existing') options.checkExisting = true;
        else if (Object.hasOwn(values, arg) && args[i + 1] && !args[i + 1].startsWith('--') && options[values[arg]] === undefined)
            options[values[arg]] = args[++i];
        else throw Error('ARGUMENTO_INVALIDO');
    }
    return validarOpcoes({ database: '(default)', ...options });
}
export async function criarClienteExplicito(options, env = process.env) {
    validarOpcoes(options);
    let settings;
    if (options.emulator) {
        if (env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180' || options.credentialFile)
            throw Error('EMULADOR_LOCAL_EXPLICITO_OBRIGATORIO');
        settings = { host: '127.0.0.1:8180', ssl: false };
    } else {
        if (Object.keys(env).some(k => /EMULATOR/i.test(k) || ['FIRESTORE_HOST', 'GOOGLE_API_ENDPOINT', 'GOOGLE_CLOUD_UNIVERSE_DOMAIN', 'FIREBASE_CONFIG'].includes(k)) || !options.credentialFile)
            throw Error('CREDENCIAL_EXTERNA_EXPLICITA_OBRIGATORIA');
        const file = realpathSync(options.credentialFile), inside = relative(realpathSync(root), file);
        if (inside !== '..' && !inside.startsWith('..' + sep) && !isAbsolute(inside)) throw Error('CREDENCIAL_NO_REPOSITORIO_PROIBIDA');
        const key = JSON.parse(readFileSync(file, 'utf8'));
        if (key.type !== 'service_account' || key.project_id !== PROJECT ||
            !/^[a-z][a-z0-9-]*@tcc-ia-d8891\.iam\.gserviceaccount\.com$/.test(key.client_email) ||
            !key.private_key?.startsWith('-----BEGIN PRIVATE KEY-----') || key.token_uri !== 'https://oauth2.googleapis.com/token')
            throw Error('CREDENCIAL_INVALIDA');
        settings = { credentials: { client_email: key.client_email, private_key: key.private_key } };
    }
    const { Firestore } = require('@google-cloud/firestore');
    return new Firestore({ projectId: options.project, databaseId: options.database, ...settings });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const result = await importar(parseArgs(process.argv.slice(2)), { criarCliente: criarClienteExplicito });
        console.log(JSON.stringify(result, null, 2));
    } catch { console.error('IMPORTACAO_ABORTADA: confira argumentos, destino, manifesto, colisões e permissões; nenhum retry automático.'); process.exitCode = 1; }
}
