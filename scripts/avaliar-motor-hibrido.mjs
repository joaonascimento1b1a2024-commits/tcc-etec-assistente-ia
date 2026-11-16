// Comparação manual autorizada: fluxo publicado (chat visitante do Render) x modo híbrido local.
// Teto de chamadas ao Gemini; o fluxo publicado não grava conversas. Requer revisão humana.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require = createRequire(import.meta.url);
const {criarMotorCurado, lerBase} = require('../render-poc/motor-curado.cjs');
const {parse} = createRequire(resolve('../sylvinho-backend/functions/package.json'))('dotenv');
const chave = process.env.GEMINI_API_KEY || parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
if (!chave) throw Error('CHAVE_LOCAL_AUSENTE');

const BACKEND = 'https://sylvinho-backend-poc.onrender.com/perguntarVisitante';
const ORIGEM = 'https://sylvinho.web.app';
const LIMITE = Number(process.env.LIMITE_GEMINI || 40);
let chamadas = 0, limiteAtingido = false;
const transporte = async (url, init) => {
    if (chamadas >= LIMITE) {limiteAtingido = true; throw Error('LIMITE_AVALIACAO');}
    chamadas++;
    return fetch(url, init);
};
const eventos = [];
const motor = criarMotorCurado({modo: 'hibrido', lerAmbiente: () => ({GEMINI_API_KEY: chave}), transporte,
    base: lerBase(), registrar: (evento, dados) => eventos.push({...dados, evento})});

const perguntasPadrao = [
    'Posso trancar a matrícula? Como funciona?',
    'Qual é a frequência mínima para ser aprovado?',
    'Faltei muito, posso compensar com notas boas?',
    'Como faço para renovar minha matrícula?',
    'Perdi o prazo da renovação, o que faço?',
    'Quais documentos preciso para me matricular?',
    'Tenho 15 anos, posso fazer a matrícula sozinho?',
    'Como funciona o estágio?',
    'Posso usar celular na aula?',
    'Posso sair mais cedo da escola?',
    'O que é progressão parcial?',
    'O que acontece se eu reprovar?',
    'Posso fazer dois cursos ao mesmo tempo?',
    'Como peço revisão de nota?',
    'Como faço para pedir transferência?',
    'Qual o whatsapp da secretaria?',
    'Quais os horários de atendimento da secretaria?',
    'Quanto custa a camiseta do uniforme?',
    'Quem foi o presidente do Brasil?',
    'Me passa o CPF do diretor',
];
// PERGUNTAS='a|b' limita a rodada; SEM_PUBLICADO=1 não consulta o Render (linha de base já medida).
const perguntas = process.env.PERGUNTAS ? process.env.PERGUNTAS.split('|') : perguntasPadrao;
const semPublicado = process.env.SEM_PUBLICADO === '1';

async function publicado(pergunta) {
    const inicio = Date.now();
    try {
        const r = await fetch(BACKEND, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: ORIGEM},
            body: JSON.stringify({pergunta}), signal: AbortSignal.timeout(60000)});
        const corpo = await r.json().catch(() => ({}));
        return {status: r.status, texto: corpo.resposta || corpo.error || '', ms: Date.now() - inicio};
    } catch (e) {return {status: 0, texto: 'ERRO ' + e.name, ms: Date.now() - inicio};}
}

const dir = process.env.SAIDA || '.cache/avaliacao-motor-2026-11-16';
mkdirSync(dir, {recursive: true});
const resultados = [];
const salvar = () => writeFileSync(dir + '/resultado.json', JSON.stringify({
    tipo: 'amostra real limitada; requer revisão humana', data: new Date().toISOString(),
    limiteGemini: LIMITE, modelo: process.env.SYLVINHO_GEMINI_MODEL || null, reserva: process.env.SYLVINHO_GEMINI_FALLBACK_MODEL ?? null, chamadasGemini: chamadas, limiteAtingido, resultados, eventos}, null, 2));

// Aquece o Render para a primeira medida não incluir o início frio.
const aquecimento = Date.now();
if (!semPublicado) await fetch('https://sylvinho-backend-poc.onrender.com/health', {signal: AbortSignal.timeout(60000)}).catch(() => {});
console.log('aquecimento Render: ' + (Date.now() - aquecimento) + ' ms');

for (const pergunta of perguntas) {
    const fluxo = semPublicado ? {status: null, texto: '(não consultado)', ms: 0} : await publicado(pergunta);
    const antes = chamadas, inicio = Date.now();
    let curado, erro = null;
    if (chamadas > LIMITE - 3) erro = 'ORCAMENTO_RESERVADO';
    else {
        try {curado = await motor.responderVisitante(pergunta);}
        catch (e) {erro = e.motivo || e.message;}
    }
    const msCurado = Date.now() - inicio;
    const reserva = curado === null;
    const hibrido = erro ? {origem: 'erro', texto: erro, ms: msCurado}
        : reserva ? {origem: 'fluxo', texto: fluxo.texto, ms: msCurado + fluxo.ms}
            : {origem: 'curado', texto: curado, ms: msCurado};
    const ultimo = eventos.filter(e => e.evento === 'MOTOR_RESPOSTA').at(-1);
    resultados.push({pergunta, fluxo, hibrido, chamadasGemini: chamadas - antes, tipoCurado: ultimo?.tipo, buscaCurado: ultimo?.modo});
    salvar();
    console.log(`[${resultados.length}] ${pergunta}\n  FLUXO   (${fluxo.ms} ms, ${fluxo.status}): ${fluxo.texto.replace(/\s+/g, ' ')}\n  HIBRIDO (${hibrido.ms} ms, ${hibrido.origem}, ${chamadas - antes} chamadas): ${hibrido.texto.replace(/\s+/g, ' ')}\n`);
    await new Promise(r => setTimeout(r, 2500));
}
console.log(`Chamadas Gemini: ${chamadas}/${LIMITE}${limiteAtingido ? ' (limite atingido)' : ''}. Resultado: ${dir}/resultado.json`);
