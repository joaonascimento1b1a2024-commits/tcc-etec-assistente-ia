'use strict';
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const local = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
function check(host, pathname = '') {
    if (local(host)) return;
    if (process.env.SYLVINHO_ARTIFACT_DOWNLOAD === '1' && host === 'storage.googleapis.com' &&
        /^\/firebase-preview-drop\/emulator\/(cloud-firestore-emulator-v[^/]+\.jar|ui-v[^/]+\.zip)$/.test(pathname)) return;
    throw new Error('NON_LOCAL_NETWORK_BLOCKED');
}
function wrapRequest(module) {
    const original = module.request;
    module.request = function (...args) {
        const first = args[0];
        if (typeof first === 'string' || first instanceof URL) {
            const url = new URL(first);
            check(url.hostname, url.pathname);
        } else {
            const pathname = (first?.path || '').split('?')[0];
            if (/^https?:\/\//.test(pathname)) {
                const url = new URL(pathname);
                check(url.hostname, url.pathname);
            } else check(first?.hostname || first?.host || 'localhost', pathname);
        }
        return original.apply(this, args);
    };
    module.get = function (...args) { const request = module.request(...args); request.end(); return request; };
}
wrapRequest(http);
wrapRequest(https);
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, options) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    check(url.hostname, url.pathname);
    return originalFetch(input, options);
};
// Sockets diretos tambem sao locais. Downloads usam HTTPS e liberam somente o
// hostname de artefatos; caminhos continuam validados no request acima.
for (const module of [net, tls]) {
    for (const name of ['connect', 'createConnection']) {
        if (typeof module[name] !== 'function') continue;
        const original = module[name];
        module[name] = function (...args) {
            const first = args[0];
            const host = typeof first === 'object' ? first.host || first.hostname || 'localhost' :
                typeof args[1] === 'string' ? args[1] : 'localhost';
            if (!(process.env.SYLVINHO_ARTIFACT_DOWNLOAD === '1' && host === 'storage.googleapis.com')) check(host);
            return original.apply(this, args);
        };
    }
}
const socketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const host = typeof first === 'object' ? first.host || first.hostname || 'localhost' :
        typeof args[1] === 'string' ? args[1] : 'localhost';
    if (!(process.env.SYLVINHO_ARTIFACT_DOWNLOAD === '1' && host === 'storage.googleapis.com')) check(host);
    return socketConnect.apply(this, args);
};
