import {criarClienteGemini} from '../functions/lib/assistente/geracao/gemini.js';
import {validarGeracao} from '../functions/lib/assistente/geracao/contrato.js';

// Ensaio independente. Nao importar no servidor, frontend ou leitor Firestore.
// Nada representa norma escolar; pergunta e evidencia sao fixas e sinteticas.
const texto = 'O certificado experimental utiliza papel violeta de laboratório.';
const pedido = Object.freeze({
  pergunta: 'Qual papel utiliza o certificado experimental?',
  contextos: Object.freeze([texto]),
  evidencias: Object.freeze([Object.freeze({id:'E1',texto,contexto:0})]),
});
const palavras = new Set(('o a de do da para e é utilizado utiliza certificado ' +
  'experimental papel violeta laboratório').split(' '));

function propostaPublica(proposta) {
  return proposta.afirmacoes.every(a => {
    // Vocabulario fechado: saida livre nunca e reenviada para revisao/moderacao.
    if (!/^[\p{L}\s.,;!?-]+$/u.test(a.texto)) return false;
    return a.texto.toLowerCase().match(/\p{L}+/gu)?.every(p => palavras.has(p));
  });
}

/**
 * Sem transporte explicito: bloqueado. Nao le env, credenciais ou Firestore.
 * Para futuro teste real, o chamador precisara de autorizacao e transporte proprio.
 * Nao publica endpoint nem cria flags/aprovacoes ficticias do gateway.
 */
export async function executarEnsaioSintetico(opcoes = {}) {
  let timer;
  const controller = new AbortController();
  const auditoria = [];
  const fallback = () => ({status:'documental_sintetico',resposta:texto,auditoria});
  try {
    if (Object.keys(opcoes).some(k => !['transporte','modelo','lerChave','timeoutMs'].includes(k)) ||
      typeof opcoes.transporte !== 'function' || typeof opcoes.lerChave !== 'function' ||
      typeof opcoes.modelo !== 'string') return {status:'bloqueado',auditoria};
    const timeout = opcoes.timeoutMs ?? 20000;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30000) return {status:'bloqueado',auditoria};
    const etapas = ['classificar_entrada','propor','revisar','classificar_saida'];
    const cliente = criarClienteGemini(opcoes.modelo,opcoes.lerChave,async(url,init)=>{
      const etapa = etapas[auditoria.length];
      if (!etapa) throw Error('LIMITE');
      const body = JSON.parse(init.body);
      if (body.contents.length !== 1 || body.contents[0].role !== 'user' ||
        body.contents[0].parts.length !== 1 || body.tools.length !== 0) throw Error('CONTRATO');
      // Somente contagens e codigos; sem headers/chave, prompt ou erro bruto.
      auditoria.push({etapa,bytes:Buffer.byteLength(init.body),ferramentas:0});
      return opcoes.transporte(url,init);
    });
    const executar = async () => {
      if (!await cliente.moderar([pedido.pergunta,...pedido.contextos].join('\n\n'),controller.signal)) return fallback();
      controller.signal.throwIfAborted();
      const proposta = validarGeracao(await cliente.propor(pedido,controller.signal),pedido.evidencias);
      controller.signal.throwIfAborted();
      if (!proposta || !propostaPublica(proposta)) return fallback();
      if (!await cliente.verificar(pedido,proposta,controller.signal)) return fallback();
      controller.signal.throwIfAborted();
      const resposta = proposta.afirmacoes.map(a=>a.texto).join('\n\n');
      if (!await cliente.moderar(resposta,controller.signal)) return fallback();
      controller.signal.throwIfAborted();
      return {status:'gerada_sintetica',resposta,referencias:proposta.afirmacoes.map(a=>a.referencias),auditoria};
    };
    return await Promise.race([executar(),new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(Error('TIMEOUT'));},timeout);
    })]);
  } catch {
    return fallback();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
