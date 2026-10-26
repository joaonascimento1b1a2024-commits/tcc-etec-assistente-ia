// Somente leitura local. Sem rede, geracao ou alteracao de flags.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {autorizarGeralAutomatico, POLITICA_GERAL_AUTOMATICA_PATH} from '../functions/lib/assistente/geracao/politica-geral-automatica.js';
import {usuarioIAAutorizado} from '../functions/lib/assistente/geracao/gateway.js';

export function diagnosticarGemini(env, lerPolitica = () => readFileSync(POLITICA_GERAL_AUTOMATICA_PATH, 'utf8'), agora = Date.now()) {
    const flags = ['SYLVINHO_IA_ENABLED', 'SYLVINHO_IA_GEMINI_GERAL_ENABLED',
        'SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA', 'SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA',
        'SYLVINHO_IA_PRIVACIDADE_APROVADA', 'SYLVINHO_IA_MENORES_APROVADA', 'SYLVINHO_IA_INSTITUCIONAL_APROVADA'];
    const valor = (nome, permitidos) => permitidos.includes(env[nome]) ? env[nome] : env[nome] === undefined ? 'ausente' : 'invalido';
    const uids = (env.SYLVINHO_IA_UID_ALLOWLIST || '').split(',').map(s => s.trim());
    const allowlistValida = usuarioIAAutorizado(env, uids[0]);
    const numero = (nome, padrao, max) => {
        const n = Number(env[nome] ?? padrao);
        return Number.isSafeInteger(n) && n >= 1 && n <= max ? n : 'invalido';
    };
    return {
        verificacao: 'configuracao-local-sem-chamada-ao-provedor',
        commitRender: /^[a-f0-9]{40}$/u.test(env.RENDER_GIT_COMMIT || '') ? env.RENDER_GIT_COMMIT : 'nao-verificado',
        modoBackend: valor('SYLVINHO_POC_MODE', ['documental']),
        flags: Object.fromEntries(flags.map(k => [k, valor(k, ['true', 'false'])])),
        provider: valor('SYLVINHO_IA_PROVIDER', ['gemini', 'openai']),
        modoGeral: valor('SYLVINHO_IA_GEMINI_GERAL_MODO', ['automatico']),
        modalidade: valor('SYLVINHO_IA_GEMINI_MODALIDADE', ['demonstracao_publica', 'zdr']),
        modelo: /^[a-zA-Z0-9._-]{1,100}$/u.test(env.GEMINI_MODEL || '') ? env.GEMINI_MODEL : 'ausente-ou-invalido',
        chavePresente: typeof env.GEMINI_API_KEY === 'string' && !!env.GEMINI_API_KEY.trim(),
        planoDeclarado: valor('GEMINI_API_TIER', ['free', 'paid']),
        allowlistValida,
        usuariosAutorizados: allowlistValida ? uids.length : 0,
        timeoutMs: numero('SYLVINHO_IA_TIMEOUT_MS', 20000, 30000),
        maxPerguntasPorMinutoPorInstancia: numero('SYLVINHO_IA_MAX_POR_MINUTO', 5, 20),
        politicaAutomaticaValida: !!autorizarGeralAutomatico(env, uids[0], lerPolitica, agora),
        acessoModeloCotaBilling: 'nao-verificados',
    };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { console.log(JSON.stringify(diagnosticarGemini(process.env), null, 2)); }
    catch { console.error('DIAGNOSTICO_CONFIGURACAO_FALHOU'); process.exitCode = 1; }
}
