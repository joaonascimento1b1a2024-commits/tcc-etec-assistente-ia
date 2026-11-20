// Avalia o modo híbrido com as perguntas de scripts/perguntas-avaliacao.json.
//
// Uso (na raiz do projeto):
//   node scripts/avaliar-hibrido.mjs sem-gemini   -> local; Gemini simulado como fora do ar (só embeddings reais).
//                                                    Mostra o que o Sylvinho responde mesmo sem o Gemini.
//   node scripts/avaliar-hibrido.mjs local        -> local; Gemini real com a chave local.
//   node scripts/avaliar-hibrido.mjs producao     -> chat de visitante publicado (não grava histórico de ninguém).
//
// Saída: tabela no terminal e .cache/avaliacao-<modo>.json. O modo produção retoma de onde parou.
// Atenção: cada pergunta não exata gasta 1 embedding (limite de 1.000 por dia na chave gratuita)
// e até 2 chamadas de geração. Não rode avaliações em massa no dia da apresentação.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';

const modo = process.argv[2] || 'sem-gemini';
if (!['sem-gemini', 'local', 'producao'].includes(modo)) throw Error('Modo inválido: use sem-gemini, local ou producao');
const perguntas = JSON.parse(readFileSync(new URL('./perguntas-avaliacao.json', import.meta.url), 'utf8'));
mkdirSync('.cache', {recursive: true});
const arquivo = `.cache/avaliacao-${modo}.json`;
const require = createRequire(import.meta.url);

// Produção: POST no endpoint de visitante com a origem oficial do site (o CORS só aceita os domínios oficiais).
async function responderProducao(pergunta) {
  const r = await fetch('https://sylvinho-backend-poc.onrender.com/perguntarVisitante', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: {'content-type': 'application/json', origin: 'https://sylvinho.web.app'},
    body: JSON.stringify({pergunta}),
  });
  const corpo = await r.json().catch(() => ({}));
  return {caminho: r.status === 200 ? 'producao' : 'HTTP_' + r.status + (corpo.codigo ? ':' + corpo.codigo : ''),
    texto: corpo.resposta || corpo.error || ''};
}

// Local: o mesmo caminho do chat de visitante (functions/src/assistente/visitante.ts):
// classificador -> motor curado -> (null = fluxo documental antigo, que não roda fora do Render).
function criarLocal() {
  const {criarMotorCurado} = require('../render-poc/motor-curado.cjs');
  const {classificarEscopo} = require('../functions/lib/assistente/escopo.js');
  const {parse} = createRequire(new URL('../../sylvinho-backend/functions/package.json', import.meta.url))('dotenv');
  const chave = process.env.GEMINI_API_KEY || parse(readFileSync('../sylvinho-backend/functions/.env')).GEMINI_API_KEY;
  // sem-gemini: embeddings reais; geração devolve 503 (sobrecarga), como nos dias de Gemini indisponível.
  const transporte = modo === 'sem-gemini'
    ? async (url, init) => String(url).includes('mbed') ? fetch(url, init) : new Response('{}', {status: 503}) : undefined;
  let ultimo = {};
  const motor = criarMotorCurado({modo: 'hibrido', lerAmbiente: () => ({GEMINI_API_KEY: chave}),
    ...(transporte ? {transporte} : {}), registrar: (codigo, dados) => { if (codigo === 'MOTOR_RESPOSTA') ultimo = dados; }});
  return async pergunta => {
    const escopo = classificarEscopo(pergunta);
    if (escopo.resposta && escopo.categoria !== 'ambigua') return {caminho: 'local:' + escopo.categoria, texto: escopo.resposta};
    ultimo = {};
    try {
      const texto = await motor.responderVisitante(pergunta);
      if (texto === null) return {caminho: escopo.resposta ? 'local:ambigua' : 'FLUXO_ANTIGO', texto: escopo.resposta || ''};
      return {caminho: 'curado:' + (ultimo.tipo || '?'), texto};
    } catch (e) { return {caminho: 'ERRO:' + (e.motivo || e.message), texto: ''}; }
  };
}

const responder = modo === 'producao' ? responderProducao : criarLocal();
const feitos = modo === 'producao' && existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : [];
for (const [categoria, pergunta] of perguntas) {
  if (feitos.some(x => x.pergunta === pergunta && x.caminho === 'producao')) continue;
  const inicio = Date.now();
  let resultado;
  try { resultado = await responder(pergunta); } catch (e) { resultado = {caminho: 'ERRO:' + e.message, texto: ''}; }
  const item = {categoria, pergunta, ...resultado, ms: Date.now() - inicio};
  const i = feitos.findIndex(x => x.pergunta === pergunta);
  if (i >= 0) feitos[i] = item; else feitos.push(item);
  writeFileSync(arquivo, JSON.stringify(feitos, null, 1));
  console.log(item.caminho.padEnd(26), String(item.ms).padStart(6), '|', pergunta, '=>', item.texto.slice(0, 90).replace(/\n/g, ' '));
  if (modo === 'producao') await new Promise(r => setTimeout(r, 2500)); // limite do visitante: 30 por minuto
}
const contagem = {};
for (const x of feitos) contagem[x.caminho] = (contagem[x.caminho] || 0) + 1;
const tempos = feitos.map(x => x.ms).sort((a, b) => a - b);
console.log(contagem);
console.log('mediana', tempos[tempos.length >> 1], 'ms | p90', tempos[Math.floor(tempos.length * 0.9)], 'ms');
