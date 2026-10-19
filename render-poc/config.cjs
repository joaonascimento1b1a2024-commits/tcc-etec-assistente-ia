'use strict';

const { origensPermitidas } = require('../functions/lib/assistente/http.js');
const { lerPlanoProducao, validarPlanoProducao, validarOrigensProducao } = require('./producao.cjs');
const { lerConfiguracaoDocumental, validarConfiguracaoDocumental } = require('./documental.cjs');
const DEMO_PROJECT = 'demo-sylvinho-render-poc';
const localHost = (value) => typeof value === 'string' &&
    /^(127\.0\.0\.1|localhost):[1-9][0-9]{0,4}$/.test(value) &&
    Number(value.split(':')[1]) <= 65535;

function validarConfiguracao(config) {
    if (!config || !['health', 'emulator', 'auth-diagnostic', 'firestore-diagnostic', 'rag-diagnostic',
        'production-locked', 'documental', 'documental-emulator'].includes(config.mode))
        throw new Error('POC_MODE_INVALID');
    if (typeof config.origins !== 'string') throw new Error('INVALID_CORS_CONFIGURATION');
    origensPermitidas(config.origins);
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT_INVALID');
    const host = ['health', 'production-locked', 'documental'].includes(config.mode) ? '0.0.0.0' : '127.0.0.1';
    if (config.host !== host) throw new Error('HOST_INVALID');
    const production = config.mode === 'production-locked' ? validarPlanoProducao(config.production) : undefined;
    if (production) validarOrigensProducao(config.origins);
    if (config.mode === 'documental') return validarConfiguracaoDocumental(config);
    return Object.freeze({ mode: config.mode, origins: config.origins, port: config.port, host,
        ...(production ? { production } : {}) });
}

function lerConfiguracao(env = process.env) {
    const mode = env.SYLVINHO_POC_MODE || 'health';
    if (!['health', 'emulator', 'auth-diagnostic', 'firestore-diagnostic', 'rag-diagnostic',
        'production-locked', 'documental', 'documental-emulator'].includes(mode))
        throw new Error('POC_MODE_INVALID');
    if (env.RENDER !== undefined && !['true', 'false'].includes(env.RENDER)) throw new Error('RENDER_CONFIGURATION_INVALID');
    if (mode === 'documental') return validarConfiguracao(lerConfiguracaoDocumental(env));
    if (mode === 'production-locked') return validarConfiguracao({
        mode, origins: env.ASSISTENTE_CORS_ORIGINS, port: env.PORT === undefined ? 10000 : Number(env.PORT),
        host: '0.0.0.0', production: lerPlanoProducao(env),
    });
    const render = env.RENDER === 'true' ||
        ['RENDER_SERVICE_ID', 'RENDER_INSTANCE_ID', 'RENDER_EXTERNAL_HOSTNAME'].some((name) => Boolean(env[name]));
    const emulatorConfigured = Object.keys(env).some((name) =>
        (name.endsWith('_EMULATOR_HOST') || name === 'FIREBASE_EMULATOR_HUB') && env[name] !== undefined);
    if (mode !== 'health' && (render ||
        env.GCLOUD_PROJECT !== DEMO_PROJECT ||
        (env.GOOGLE_CLOUD_PROJECT !== undefined && env.GOOGLE_CLOUD_PROJECT !== DEMO_PROJECT) ||
        !localHost(env.FIREBASE_AUTH_EMULATOR_HOST) ||
        (['emulator', 'documental-emulator', 'firestore-diagnostic', 'rag-diagnostic'].includes(mode) &&
            !localHost(env.FIRESTORE_EMULATOR_HOST)) ||
        (env.FIRESTORE_EMULATOR_HOST !== undefined && !localHost(env.FIRESTORE_EMULATOR_HOST))))
        throw new Error('LOCAL_EMULATORS_REQUIRED');
    if (render && emulatorConfigured) throw new Error('EMULATORS_FORBIDDEN_ON_RENDER');
    return validarConfiguracao({
        mode,
        origins: env.ASSISTENTE_CORS_ORIGINS || '',
        port: env.PORT === undefined ? 10000 : Number(env.PORT),
        host: mode === 'health' ? '0.0.0.0' : '127.0.0.1',
    });
}

module.exports = { lerConfiguracao, validarConfiguracao, DEMO_PROJECT };
