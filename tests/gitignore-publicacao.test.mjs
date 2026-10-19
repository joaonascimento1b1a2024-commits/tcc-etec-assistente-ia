import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Git ignora credenciais, env reais, backups e artefatos; exemplos continuam elegíveis', () => {
    const ignored = ['sylvinho-firebase-admin.json', 'render-poc/sylvinho-firebase-admin.json',
        'nested/deep/sylvinho-firebase-admin.json', '.env', 'functions/.env.tcc-ia-d8891', 'render-poc/.env.production',
        'private.pem', 'nested/key.p12', 'id_ed25519', 'backup/file.txt', 'Backups/file.txt',
        'backup-recuperado/file.json', 'archive.zip', 'old.bak', '.cache/stage/file.js',
        'functions/node_modules/package/index.js', 'functions/lib/index.js'];
    const visible = ['.env.example', 'functions/.env.example', 'render-poc/.env.example',
        'render-poc/iam-documental-role.json', 'firebase.admin.test.json'];
    for (const [paths, expected] of [[ignored, 0], [visible, 1]])
        for (const path of paths) {
            const result = spawnSync('git', ['--no-optional-locks', 'check-ignore', '--no-index', '--quiet', path], {
                cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', windowsHide: true,
            });
            assert.equal(result.status, expected, path);
        }
});
