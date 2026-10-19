// Copia apenas a seleção explícita para cache local. Nunca adiciona arquivos ao Git.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, copyFileSync, existsSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { detectarSegredos } from './verificar-segredos.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'render-poc/commit-health.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, windowsHide: true });
const paths = [...manifest.commitFiles, ...manifest.existingPrerequisites];
assert.equal(new Set(paths).size, paths.length, 'Seleção deve conter caminhos únicos');
const hashes = {};
for (const path of paths) {
    const full = resolve(root, path);
    assert.ok(full.startsWith(root.endsWith(sep) ? root : root + sep), 'Caminho fora do projeto');
    assert.ok(!/(^|\/)(knowledge-base|public|node_modules|backup|backups|\.cache)(\/|$)/i.test(path), 'Conteúdo fora do escopo');
    const bytes = readFileSync(full);
    assert.deepEqual(detectarSegredos(bytes.toString('utf8')), [], `Possível segredo: ${path}`);
    hashes[path] = hash(bytes);
}
const baselineFiles = new Map();
for (const path of manifest.existingPrerequisites) {
    const bytes = git(['show', `HEAD:${path}`]);
    // Windows usa CRLF no checkout; o blob que já está no Git normalmente usa LF.
    assert.equal(readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n'),
        bytes.toString('utf8').replaceAll('\r\n', '\n'), `Pré-requisito não corresponde ao HEAD: ${path}`);
    baselineFiles.set(path, bytes);
    hashes[path] = hash(bytes);
}
const pkg = JSON.parse(readFileSync(resolve(root, 'functions/package.json'), 'utf8'));
assert.equal(pkg.scripts.build, 'tsc');
assert.ok(!pkg.scripts.prebuild && !pkg.scripts.postbuild, 'Build contém hooks não revisados');
const locked = JSON.parse(readFileSync(resolve(root, 'functions/package-lock.json'), 'utf8')).packages[''];
for (const group of ['dependencies', 'devDependencies']) assert.deepEqual(pkg[group], locked[group]);
const stage = resolve(root, '.cache', `render-health-selection-${Date.now()}`);
mkdirSync(stage, { recursive: true });
for (const path of paths) {
    const dest = resolve(stage, path);
    assert.ok(dest.startsWith(stage + sep));
    mkdirSync(dirname(dest), { recursive: true });
    if (baselineFiles.has(path)) writeFileSync(dest, baselineFiles.get(path));
    else copyFileSync(resolve(root, path), dest);
}
// Reutiliza dependências instaladas e declaradas no lockfile; não instala nem copia pacotes.
const modules = resolve(root, 'functions/node_modules');
assert.ok(existsSync(modules), 'Dependências locais indisponíveis');
symlinkSync(modules, resolve(stage, 'functions/node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const env = { ...process.env, SYLVINHO_POC_MODE: 'health', NO_UPDATE_NOTIFIER: '1' };
for (const key of Object.keys(env)) if (/GEMINI|CREDENTIAL|FIREBASE_TOKEN|GOOGLE_ACCESS_TOKEN|GOOGLE_REFRESH_TOKEN/.test(key)) delete env[key];
const build = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm --prefix functions run build'], { cwd: stage, env, encoding: 'utf8', windowsHide: true })
    : spawnSync('npm', ['--prefix', 'functions', 'run', 'build'], { cwd: stage, env, encoding: 'utf8' });
if (build.status !== 0) { console.error(build.stdout, build.stderr); throw new Error('BUILD_SELECIONADO_FALHOU'); }
const tests = spawnSync(process.execPath, ['--test', 'render-poc/test/health-only.test.cjs',
    'render-poc/test/adapter.test.cjs', 'render-poc/test/arquitetura.test.cjs',
    'tests/assistente-producao.test.mjs', 'tests/avisos-email.test.mjs'], { cwd: stage, env, encoding: 'utf8', windowsHide: true });
if (tests.status !== 0) { console.error(tests.stdout, tests.stderr); throw new Error('TESTES_SELECIONADOS_FALHARAM'); }
const result = { success: true, stage, baseCommit: git(['rev-parse', 'HEAD']).toString().trim(),
    commitFiles: manifest.commitFiles, existingPrerequisites: manifest.existingPrerequisites,
    sha256: hashes, build: 'aprovado com dependencias locais existentes', tests: 'health/adapter/arquitetura/entrypoint/avisos aprovados',
    dependencyInstallExecuted: false, gitWrites: false,
    limitation: 'npm ci no Linux do Render e estado atual remoto dependem de validacao posterior' };
writeFileSync(resolve(stage, 'selection-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ success: true, commitFiles: manifest.commitFiles.length,
    existingPrerequisites: manifest.existingPrerequisites.length, build: 'OK', tests: 'OK',
    report: resolve(stage, 'selection-result.json'), dependencyInstallExecuted: false, gitWrites: false }, null, 2));
