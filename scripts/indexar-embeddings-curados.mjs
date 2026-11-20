// Refaz o índice vetorial da base curada (knowledge-local/embeddings-curados.json).
//
// Quando rodar: sempre que knowledge-local/faq-curada.json mudar (pergunta, variação ou resposta).
// O servidor compara o hash da base com o hash gravado no índice; se forem diferentes,
// a busca semântica é desligada e só a busca por palavras (BM25) continua funcionando.
//
// Uso (na raiz do projeto):  node scripts/indexar-embeddings-curados.mjs
// Chave: variável GEMINI_API_KEY ou o arquivo ../sylvinho-backend/functions/.env (nunca é impressa).
//
// A chave gratuita limita pedidos por minuto e por dia (1.000 embeddings/dia; cada entrada conta 1).
// Por isso o envio é em lotes de 5, com pausa, e os vetores já calculados ficam guardados em
// .cache/embeddings-parciais.json: se a cota acabar no meio, basta rodar de novo depois.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {criarEmbeddings} from '../render-poc/motor-curado/embeddings-curados.mjs';
import {criarFiltroContatos, elegivel, hashIndice, textoIndice} from '../render-poc/motor-curado/curadoria-local.mjs';

const lerJson = caminho => JSON.parse(readFileSync(caminho, 'utf8'));
const esperar = ms => new Promise(r => setTimeout(r, ms));

function lerChave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = '../sylvinho-backend/functions/.env';
  if (!existsSync(env)) throw Error('Defina GEMINI_API_KEY ou crie ' + env);
  const {parse} = createRequire(new URL('../../sylvinho-backend/functions/package.json', import.meta.url))('dotenv');
  return parse(readFileSync(env)).GEMINI_API_KEY;
}

const registros = lerJson('knowledge-local/faq-curada.json');
const filtro = criarFiltroContatos(lerJson('knowledge-local/contatos-publicos.json'));

// Trava de segurança: só indexa a base se todas as entradas estiverem aprovadas e vigentes
// no próprio escopo, e se nenhuma resposta tiver dado pessoal ou contato fora da lista permitida.
const hoje = new Date().toISOString().slice(0, 10);
const reprovada = registros.find(r => !elegivel(r, {hoje, ano: r.vigencia?.ano ?? undefined,
  curso: r.aplicaSe?.cursos?.[0], turno: r.aplicaSe?.turnos?.[0]}) || filtro(r.resposta, 'documento'));
if (reprovada) throw Error('Entrada não aprovada ou com dado bloqueado: ' + reprovada.id);

const chave = lerChave();
const api = criarEmbeddings({lerChave: () => chave});

// Vetores parciais ficam ligados ao texto de cada entrada (hash do texto indexado):
// se a entrada mudar, o vetor antigo é ignorado e calculado de novo.
mkdirSync('.cache', {recursive: true});
const arquivoParcial = '.cache/embeddings-parciais.json';
const parcial = existsSync(arquivoParcial) ? lerJson(arquivoParcial) : {};
const hashTexto = r => createHash('sha256').update(textoIndice(r)).digest('hex');
const faltam = registros.filter(r => !parcial[hashTexto(r)]);
console.log(`entradas: ${registros.length}; já calculadas: ${registros.length - faltam.length}; faltam: ${faltam.length}`);

for (let i = 0; i < faltam.length; i += 5) {
  const lote = faltam.slice(i, i + 5);
  let vetores;
  for (let tentativa = 0; ; tentativa++) {
    try {
      vetores = await api.lote(lote.map(textoIndice), 'RETRIEVAL_DOCUMENT');
      break;
    } catch (erro) {
      // 429 = limite da cota. Espera e tenta de novo; depois de 6 tentativas, para (o progresso fica salvo).
      if (erro.message !== 'HTTP_429' || tentativa >= 6) throw Error('Parou em ' + (i) + '/' + faltam.length + ': ' + erro.message + '. Rode de novo mais tarde.');
      await esperar(30000);
    }
  }
  lote.forEach((r, j) => { parcial[hashTexto(r)] = vetores[j]; });
  writeFileSync(arquivoParcial, JSON.stringify(parcial));
  console.log(`lote ok: ${Math.min(i + 5, faltam.length)}/${faltam.length}`);
  await esperar(15000);
}

// Índice final: o hash da base inteira permite ao servidor detectar uma base alterada sem reindexar.
const indice = {modelo: api.modelo, dimensoes: 768, hash: hashIndice(registros),
  valores: Object.fromEntries(registros.map(r => [r.id, parcial[hashTexto(r)]]))};
writeFileSync('knowledge-local/embeddings-curados.json', JSON.stringify(indice));
console.log('índice gravado:', registros.length, 'vetores, hash', indice.hash.slice(0, 12));
