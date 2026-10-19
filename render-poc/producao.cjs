'use strict';

const PROJECT_ID = 'tcc-ia-d8891';
const DATABASE_ID = '(default)';
const CREDENTIAL_PATH = '/etc/secrets/sylvinho-firebase-admin.json';
// Planned identity only: no account, key or remote permission is created here.
const SERVICE_ACCOUNT_EMAIL = 'sylvinho-render-reader@tcc-ia-d8891.iam.gserviceaccount.com';
const OFFICIAL_ORIGINS = Object.freeze([
    'https://tcc-ia-d8891.web.app', 'https://tcc-ia-d8891.firebaseapp.com',
]);

function validarPlanoProducao(plan) {
    if (!plan || plan.projectId !== PROJECT_ID) throw new Error('PRODUCTION_PROJECT_INVALID');
    if (plan.databaseId !== DATABASE_ID) throw new Error('PRODUCTION_DATABASE_INVALID');
    if (plan.credentialSource !== 'render-secret-file' || plan.credentialPath !== CREDENTIAL_PATH)
        throw new Error('PRODUCTION_EXPLICIT_CREDENTIAL_REQUIRED');
    if (plan.serviceAccountEmail !== SERVICE_ACCOUNT_EMAIL) throw new Error('PRODUCTION_IDENTITY_INVALID');
    if (plan.enabled !== false) throw new Error('PRODUCTION_ACCESS_DISABLED');
    return Object.freeze({
        projectId: PROJECT_ID, databaseId: DATABASE_ID,
        credentialSource: 'render-secret-file', credentialPath: CREDENTIAL_PATH,
        serviceAccountEmail: SERVICE_ACCOUNT_EMAIL, enabled: false,
    });
}

function validarOrigensProducao(origins) {
    const items = typeof origins === 'string' ? origins.split(',').map((value) => value.trim()) : [];
    if (items.length !== OFFICIAL_ORIGINS.length ||
        OFFICIAL_ORIGINS.some((origin) => !items.includes(origin)))
        throw new Error('PRODUCTION_CORS_INVALID');
}

function lerPlanoProducao(env) {
    const present = (name) => env[name] !== undefined;
    if (Object.keys(env).some((name) => /EMULATOR/i.test(name) && present(name)))
        throw new Error('PRODUCTION_EMULATORS_FORBIDDEN');
    if (env.RENDER !== 'true' || env.NODE_ENV !== 'production') throw new Error('PRODUCTION_HOST_INVALID');
    for (const name of ['GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID', 'SYLVINHO_FIREBASE_PROJECT_ID'])
        if (present(name) && env[name] !== PROJECT_ID) throw new Error('PRODUCTION_PROJECT_INVALID');
    const forbidden = [
        'FIREBASE_CONFIG', 'FIREBASE_TOKEN', 'FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON',
        'GOOGLE_CREDENTIALS', 'GOOGLE_APPLICATION_CREDENTIALS_JSON', 'GOOGLE_ACCESS_TOKEN',
        'GOOGLE_REFRESH_TOKEN', 'FIREBASE_PRIVATE_KEY', 'FIRESTORE_HOST', 'FIREBASE_AUTH_HOST',
        'GOOGLE_API_ENDPOINT', 'GOOGLE_CLOUD_UNIVERSE_DOMAIN', 'NODE_OPTIONS',
        'NODE_EXTRA_CA_CERTS', 'GRPC_DEFAULT_SSL_ROOTS_FILE_PATH', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
    ];
    if (forbidden.some(present)) throw new Error('PRODUCTION_UNSAFE_ENVIRONMENT');
    if (present('NODE_TLS_REJECT_UNAUTHORIZED') && env.NODE_TLS_REJECT_UNAUTHORIZED !== '1')
        throw new Error('PRODUCTION_UNSAFE_ENVIRONMENT');
    for (const name of Object.keys(env))
        if (/^SYLVINHO_PRODUCTION.*ENABLED$/.test(name) && present(name) && env[name] !== 'false')
            throw new Error('PRODUCTION_ACCESS_DISABLED');
    validarOrigensProducao(env.ASSISTENTE_CORS_ORIGINS);
    // Metadata only: never inspect the file or let ADC resolve credentials.
    return validarPlanoProducao({
        projectId: env.GCLOUD_PROJECT, databaseId: env.FIRESTORE_DATABASE_ID,
        credentialSource: env.SYLVINHO_CREDENTIAL_SOURCE, credentialPath: env.GOOGLE_APPLICATION_CREDENTIALS,
        serviceAccountEmail: env.SYLVINHO_SERVICE_ACCOUNT_EMAIL, enabled: false,
    });
}

module.exports = {
    lerPlanoProducao, validarPlanoProducao, validarOrigensProducao,
    PROJECT_ID, DATABASE_ID, CREDENTIAL_PATH, SERVICE_ACCOUNT_EMAIL, OFFICIAL_ORIGINS,
};
