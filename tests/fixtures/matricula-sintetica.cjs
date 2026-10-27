'use strict';
const { FONTES_ORIGINAIS } = require('../../functions/lib/rag/recuperacao.js');
// Apenas teste de contratos HTTP/Auth/RAG/historico, nunca importar no banco.
// O ID da fonte exercita a allowlist; nao certifica origem documental real.
module.exports = Object.freeze({
    id: 'matricula-sintetica-01', documentoId: FONTES_ORIGINAIS[0],
    titulo: 'Matrícula inicial - UNIDADE SINTÉTICA', secao: 'Laboratório de teste',
    conteudo: 'Os documentos de matrícula experimental utilizam papel violeta de laboratório.',
    categoria: 'teste', tipoConteudo: 'orientacao', termosBusca: 'matricula experimental',
    paginaInicial: 25, paginaFinal: 25, ativo: true,
});
