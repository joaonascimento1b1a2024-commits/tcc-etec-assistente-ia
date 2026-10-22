// Dados totalmente sinteticos. Nunca carregar no Firestore ou no runtime.
// O ID da allowlist exercita o filtro existente; NAO comprova origem documental.
import {FONTES_ORIGINAIS} from '../../functions/lib/rag/recuperacao.js';

export const pergunta = 'Qual papel utiliza o certificado experimental?';
export const texto = 'O certificado experimental utiliza papel violeta de laboratório.';
export const criarChunk = (conteudo = texto, extra = {}) => ({
  id: 'fixture-unidade-01',
  documentoId: FONTES_ORIGINAIS[0],
  titulo: 'UNIDADE SINTÉTICA DE TESTE',
  secao: 'Unidade de laboratório',
  conteudo,
  ativo: true,
  ...extra,
});
export const criarEvidencia = (conteudo = texto, id = 'E1') => ({
  id,
  texto: conteudo,
  fonte: {natureza: 'documental', chunkId: 'fixture-unidade-01',
    documentoId: FONTES_ORIGINAIS[0]},
});
export const proposta = evidencias => ({
  versao: 1,
  afirmacoes: evidencias.map(e => ({texto: e.texto,
    referencias: [{id: e.id, citacao: e.texto}]})),
});
