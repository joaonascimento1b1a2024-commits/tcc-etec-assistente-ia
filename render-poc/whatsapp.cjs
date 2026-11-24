'use strict';

// ============================================================
// Sylvinho no WhatsApp (WhatsApp Cloud API, da Meta)
// ============================================================
// Caminho de uma mensagem:
//   1. A pessoa escreve para o número do Sylvinho no WhatsApp.
//   2. A Meta chama POST /whatsapp/webhook com a mensagem, assinada com o App Secret.
//   3. O servidor confere a assinatura, responde 200 na hora (a Meta exige resposta rápida)
//      e passa a pergunta para o MESMO fluxo do chat de visitante do site:
//      base curada primeiro, busca documental depois, sem histórico e sem gravar nada.
//   4. A resposta volta para a pessoa pela Graph API (/messages).
//
// Privacidade: número de telefone e texto não são gravados nem aparecem nos logs.
// Em memória ficam só o id das mensagens recentes (para não responder duas vezes)
// e um contador por número, guardado como hash (para limitar abusos).
//
// Ligado apenas quando as quatro variáveis abaixo existem no ambiente (painel do Render):
//   WHATSAPP_TOKEN            token de acesso da Graph API (segredo)
//   WHATSAPP_PHONE_NUMBER_ID  id do número no painel da Meta (não é o telefone)
//   WHATSAPP_VERIFY_TOKEN     frase escolhida pelo grupo, repetida no painel da Meta
//   WHATSAPP_APP_SECRET       "Chave secreta do app", usada para conferir a assinatura (segredo)
// Opcional: WHATSAPP_GRAPH_VERSION (padrão abaixo).

const { createHash, createHmac, timingSafeEqual } = require('node:crypto');

const ROTA = '/whatsapp/webhook';
const VERSAO_GRAPH_PADRAO = 'v27.0';
const LIMITE_CORPO = 256 * 1024;      // a Meta envia lotes; 256 KB sobra
const LIMITE_PERGUNTA = 700;          // o mesmo do chat de visitante
const LIMITE_TEXTO_WHATSAPP = 4096;   // máximo de um texto no WhatsApp
const MENSAGENS_POR_MINUTO = 8;       // por número
const IDADE_MAXIMA_MS = 15 * 60000;   // reenvios antigos (servidor dormindo) não são respondidos
const TEMPO_ENVIO_MS = 10000;
const MARCADOR_FONTES = '\n\n[[FONTES]]';

const TEXTOS = Object.freeze({
    soTexto: 'Por enquanto eu só entendo mensagens de texto. Escreva sua dúvida sobre a ETEC, por favor.',
    longa: `Sua mensagem ficou muito longa. Escreva a dúvida em até ${LIMITE_PERGUNTA} caracteres, por favor.`,
    ocupado: 'Estou com muitas perguntas agora. Tente de novo em um minuto, por favor.',
    falha: 'Não consegui responder agora. Tente de novo em alguns minutos ou fale com a Secretaria Acadêmica.',
});

const NOMES = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'];

/**
 * Lê a configuração do ambiente. Sem nenhuma variável: integração desligada (null).
 * Configuração incompleta também desliga, com um aviso no log, para não derrubar o site.
 */
function lerConfiguracaoWhatsApp(env = process.env, avisar = (codigo) => console.warn('SYLVINHO_WHATSAPP', codigo)) {
    if (NOMES.every((nome) => !env[nome])) return null;
    const token = env.WHATSAPP_TOKEN || '';
    const numeroId = env.WHATSAPP_PHONE_NUMBER_ID || '';
    const verifyToken = env.WHATSAPP_VERIFY_TOKEN || '';
    const appSecret = env.WHATSAPP_APP_SECRET || '';
    const versao = env.WHATSAPP_GRAPH_VERSION || VERSAO_GRAPH_PADRAO;
    const valido = /^\S{20,1024}$/.test(token) &&
        /^\d{5,20}$/.test(numeroId) &&
        /^[\x21-\x7e]{16,200}$/.test(verifyToken) &&
        /^[0-9a-f]{32}$/i.test(appSecret) &&
        /^v\d{2}\.0$/.test(versao);
    if (!valido) {
        avisar('WHATSAPP_CONFIG_INVALIDA');
        return null;
    }
    return Object.freeze({ token, numeroId, verifyToken, appSecret, versao });
}

// Comparação em tempo constante: não revela, pelo tempo de resposta, quantos caracteres acertaram.
function iguais(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
}

function assinaturaValida(corpo, cabecalho, appSecret) {
    if (typeof cabecalho !== 'string' || !/^sha256=[0-9a-f]{64}$/i.test(cabecalho)) return false;
    const esperada = 'sha256=' + createHmac('sha256', appSecret).update(corpo).digest('hex');
    return iguais(esperada, cabecalho.toLowerCase());
}

function lerCorpoBruto(req) {
    return new Promise((resolver, rejeitar) => {
        const partes = [];
        let tamanho = 0;
        let encerrado = false;
        req.on('data', (parte) => {
            if (encerrado) return;
            tamanho += parte.length;
            if (tamanho > LIMITE_CORPO) {
                encerrado = true;
                rejeitar(new Error('PAYLOAD_TOO_LARGE'));
            } else partes.push(parte);
        });
        req.on('error', () => { encerrado = true; rejeitar(new Error('INVALID_BODY')); });
        req.on('end', () => { if (!encerrado) { encerrado = true; resolver(Buffer.concat(partes)); } });
    });
}

/**
 * Prepara o texto do Sylvinho para o WhatsApp:
 * - o bloco [[FONTES]] (JSON usado pelo site) vira uma lista de links;
 * - **negrito** de Markdown vira *negrito* do WhatsApp;
 * - corta no limite de 4096 caracteres.
 */
function formatarParaWhatsApp(resposta) {
    let texto = String(resposta);
    let fontes = [];
    const posicao = texto.indexOf(MARCADOR_FONTES);
    if (posicao !== -1) {
        try {
            const lista = JSON.parse(texto.slice(posicao + MARCADOR_FONTES.length));
            if (Array.isArray(lista)) fontes = lista.filter((f) => f && /^https:\/\//.test(f.url || ''));
        } catch { /* bloco inválido: só é removido */ }
        texto = texto.slice(0, posicao);
    }
    texto = texto.replace(/\*\*([^*\n]+)\*\*/g, '*$1*').trim();
    if (fontes.length) {
        texto += '\n\n*Fontes:*\n' + fontes.map((f) => `• ${f.titulo || 'Fonte oficial'}: ${f.url}`).join('\n');
    }
    return texto.length > LIMITE_TEXTO_WHATSAPP ? texto.slice(0, LIMITE_TEXTO_WHATSAPP - 1) + '…' : texto;
}

// Celular brasileiro sem o nono dígito (55 + DDD + 8 dígitos começando com 6 a 9).
// Na API, a Meta às vezes entrega o número assim; o número de teste só aceita o
// destinatário exatamente como foi cadastrado, que normalmente tem o 9.
function comNonoDigito(numero) {
    const partes = /^55(\d{2})([6-9]\d{7})$/.exec(numero);
    return partes ? `55${partes[1]}9${partes[2]}` : null;
}

/**
 * Cria o webhook. Recebe a função que responde perguntas (o fluxo do visitante)
 * e, nos testes, um transporte falso no lugar do fetch.
 */
function criarWebhookWhatsApp({
    config,
    responder,
    transporte = fetch,
    agora = Date.now,
    registrar = (codigo, dados) => console.info('SYLVINHO_WHATSAPP', codigo, ...(dados ? [JSON.stringify(dados)] : [])),
}) {
    if (!config) throw new Error('WHATSAPP_CONFIG_AUSENTE');
    const vistos = new Map();       // id da mensagem → instante
    const contadores = new Map();   // hash do número → { inicio, total }
    const pendentes = new Set();    // processamentos em andamento (usado nos testes)
    const urlMensagens = `https://graph.facebook.com/${config.versao}/${config.numeroId}/messages`;

    const log = (codigo, dados) => { try { registrar(codigo, dados); } catch { /* log não interfere */ } };

    function jaVisto(id) {
        const instante = agora();
        for (const [chave, quando] of vistos) if (instante - quando > IDADE_MAXIMA_MS) vistos.delete(chave);
        if (vistos.has(id)) return true;
        if (vistos.size >= 5000) vistos.delete(vistos.keys().next().value);
        vistos.set(id, instante);
        return false;
    }

    function excedeuLimite(numero) {
        const chave = createHash('sha256').update(numero).digest('hex');
        const instante = agora();
        const atual = contadores.get(chave);
        if (!atual || instante - atual.inicio >= 60000) {
            if (contadores.size >= 5000) contadores.clear();
            contadores.set(chave, { inicio: instante, total: 1 });
            return false;
        }
        atual.total++;
        return atual.total > MENSAGENS_POR_MINUTO;
    }

    async function chamarGraph(corpo) {
        const resposta = await transporte(urlMensagens, {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
            signal: AbortSignal.timeout(TEMPO_ENVIO_MS),
        });
        if (resposta.ok) return { ok: true };
        let codigo;
        try { codigo = (await resposta.json())?.error?.code; } catch { /* sem corpo */ }
        return { ok: false, status: resposta.status, codigo };
    }

    async function enviarTexto(numero, texto) {
        const corpo = (para) => ({
            messaging_product: 'whatsapp', recipient_type: 'individual', to: para,
            type: 'text', text: { preview_url: false, body: texto },
        });
        let resultado = await chamarGraph(corpo(numero));
        // 131030 = destinatário fora da lista do número de teste: tenta com o nono dígito.
        const alternativo = comNonoDigito(numero);
        if (!resultado.ok && resultado.codigo === 131030 && alternativo) resultado = await chamarGraph(corpo(alternativo));
        if (resultado.ok) log('WHATSAPP_RESPOSTA_ENVIADA');
        else log('WHATSAPP_ENVIO_FALHOU', { status: resultado.status, codigo: resultado.codigo });
    }

    // Marca como lida e mostra "digitando…" enquanto o Sylvinho pensa. Falha aqui não importa.
    async function mostrarDigitando(idMensagem) {
        try {
            await chamarGraph({ messaging_product: 'whatsapp', status: 'read', message_id: idMensagem, typing_indicator: { type: 'text' } });
        } catch { /* opcional */ }
    }

    async function atenderMensagem(mensagem) {
        const numero = mensagem.from;
        if (excedeuLimite(numero)) { log('WHATSAPP_LIMITE_NUMERO'); return; }
        if (mensagem.type !== 'text' || typeof mensagem.text?.body !== 'string') {
            await enviarTexto(numero, TEXTOS.soTexto);
            return;
        }
        const pergunta = mensagem.text.body.trim();
        if (!pergunta) return;
        if (pergunta.length > LIMITE_PERGUNTA) {
            await enviarTexto(numero, TEXTOS.longa);
            return;
        }
        await mostrarDigitando(mensagem.id);
        let texto;
        try {
            const resultado = await responder(pergunta);
            if (resultado.tipo === 'resposta') texto = formatarParaWhatsApp(resultado.texto);
            else texto = resultado.tipo === 'ocupado' ? TEXTOS.ocupado : TEXTOS.falha;
            if (resultado.tipo !== 'resposta') log('WHATSAPP_SEM_RESPOSTA', { motivo: resultado.tipo });
        } catch {
            log('WHATSAPP_SEM_RESPOSTA', { motivo: 'erro' });
            texto = TEXTOS.falha;
        }
        await enviarTexto(numero, texto);
    }

    // Separa as mensagens novas do lote. Dos avisos de entrega (statuses), só as falhas
    // vão para o log, com o código da Meta (sem número), para explicar respostas que não chegaram.
    function mensagensDoLote(dados) {
        if (!dados || dados.object !== 'whatsapp_business_account' || !Array.isArray(dados.entry)) return [];
        const lista = [];
        for (const entrada of dados.entry) {
            for (const mudanca of Array.isArray(entrada?.changes) ? entrada.changes : []) {
                const valor = mudanca?.value;
                if (mudanca?.field !== 'messages' || valor?.metadata?.phone_number_id !== config.numeroId) continue;
                for (const s of Array.isArray(valor.statuses) ? valor.statuses : []) {
                    if (s?.status !== 'failed') continue;
                    const codigo = Number(s.errors?.[0]?.code);
                    log('WHATSAPP_ENTREGA_FALHOU', Number.isInteger(codigo) ? { codigo } : undefined);
                }
                for (const m of Array.isArray(valor.messages) ? valor.messages : []) {
                    if (typeof m?.id !== 'string' || !/^\d{8,15}$/.test(m?.from || '')) continue;
                    const enviadaEm = Number(m.timestamp) * 1000;
                    if (!Number.isFinite(enviadaEm) || agora() - enviadaEm > IDADE_MAXIMA_MS) { log('WHATSAPP_MENSAGEM_ANTIGA'); continue; }
                    if (jaVisto(m.id)) continue;
                    lista.push(m);
                }
            }
        }
        return lista;
    }

    async function tratar(req, res) {
        const url = new URL(req.url, 'http://localhost');

        // Verificação feita uma vez pela Meta ao cadastrar o webhook.
        if (req.method === 'GET') {
            const desafio = url.searchParams.get('hub.challenge') || '';
            if (url.searchParams.get('hub.mode') === 'subscribe' &&
                iguais(url.searchParams.get('hub.verify_token') || '', config.verifyToken) &&
                /^[\w-]{1,128}$/.test(desafio)) {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(desafio);
            } else {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Verificação recusada.');
            }
            return;
        }

        if (req.method !== 'POST') {
            res.writeHead(405, { Allow: 'GET, POST' });
            res.end();
            return;
        }

        let corpo;
        try { corpo = await lerCorpoBruto(req); }
        catch (erro) {
            res.writeHead(erro.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400);
            res.end();
            return;
        }
        if (!assinaturaValida(corpo, req.headers['x-hub-signature-256'], config.appSecret)) {
            log('WHATSAPP_ASSINATURA_INVALIDA');
            res.writeHead(401);
            res.end();
            return;
        }
        let dados;
        try { dados = JSON.parse(corpo.toString('utf8')); }
        catch { res.writeHead(400); res.end(); return; }

        // Responde 200 antes de pensar na resposta; assim a Meta não reenvia a mesma mensagem.
        res.writeHead(200);
        res.end();
        for (const mensagem of mensagensDoLote(dados)) {
            const tarefa = atenderMensagem(mensagem)
                .catch(() => log('WHATSAPP_ERRO_INTERNO'))
                .finally(() => pendentes.delete(tarefa));
            pendentes.add(tarefa);
        }
    }

    tratar.aguardarPendentes = () => Promise.all([...pendentes]);
    return tratar;
}

/**
 * Usa o endpoint do chat de visitante como uma função comum, dentro do próprio servidor.
 * Sem cabeçalho Origin, o CORS não se aplica; validação, limites e motor são os mesmos do site.
 */
function responderComoVisitante(endpointVisitante) {
    return async (pergunta) => {
        let status = 0;
        let corpo;
        const res = {
            headersSent: false,
            vary() { return res; },
            set() { return res; },
            status(codigo) { status = codigo; return res; },
            json(dados) { corpo = dados; res.headersSent = true; },
            send() { res.headersSent = true; },
        };
        await endpointVisitante({ method: 'POST', body: { pergunta }, get: () => undefined }, res);
        if (status === 200 && typeof corpo?.resposta === 'string') return { tipo: 'resposta', texto: corpo.resposta };
        return { tipo: status === 429 || status === 503 ? 'ocupado' : 'falha' };
    };
}

module.exports = {
    ROTA, lerConfiguracaoWhatsApp, criarWebhookWhatsApp, responderComoVisitante,
    formatarParaWhatsApp, assinaturaValida, comNonoDigito, TEXTOS,
};
