import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {corpus, perguntas} from '../tests/fixtures/rag-benchmark.mjs';
import * as atual from '../functions/lib/rag/recuperacao.js';
import {gerarRespostaDocumental} from '../functions/lib/assistente/resposta-documental.js';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const fonteAntes = readFileSync(new URL('../tests/fixtures/rag-antes-etapa2.ts', import.meta.url), 'utf8');
const exportsAntes = {};
vm.runInNewContext(ts.transpileModule(fonteAntes, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017,
}}).outputText, {exports: exportsAntes});

export function avaliar(seletor) {
  const linhas = perguntas.map(({pergunta, esperados}) => {
    const docs = seletor(corpus, pergunta);
    const relevantes = docs.filter(d => esperados.includes(d.id)).length;
    return {pergunta, esperados, obtidos: docs.map(d => d.id), relevantes,
      semEvidencia: gerarRespostaDocumental(pergunta, docs).status !== 'trechos_encontrados'};
  });
  const respondiveis = linhas.filter(l => l.esperados.length);
  const recuperados = linhas.reduce((s, l) => s + l.obtidos.length, 0);
  const relevantes = linhas.reduce((s, l) => s + l.relevantes, 0);
  const pct = (a, b) => b ? Number((100 * a / b).toFixed(2)) : null;
  return {metricas: {
    perguntas: linhas.length,
    precisaoFontes: pct(relevantes, recuperados),
    coberturaRespondiveis: pct(respondiveis.filter(l => l.relevantes).length, respondiveis.length),
    relevanciaPrimeiro: pct(respondiveis.filter(l => l.esperados.includes(l.obtidos[0])).length, respondiveis.length),
    abstencaoCorreta: pct(linhas.filter(l => !l.esperados.length && !l.obtidos.length).length, linhas.length - respondiveis.length),
    semEvidenciaDocumental: pct(linhas.filter(l => l.semEvidencia).length, linhas.length),
  }, linhas};
}
export const antes = () => avaliar(exportsAntes.selecionarDocumentosOriginais);
export const depois = () => avaliar(atual.selecionarDocumentosOriginais);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({dados: 'sinteticos', nota: 'Compositor atual fixo nos dois braços; comparação da recuperação, não da geração por IA.', antes: antes(), depois: depois()}, null, 2));
}
