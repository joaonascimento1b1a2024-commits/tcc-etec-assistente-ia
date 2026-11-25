'use strict';

// DEMONSTRAÇÃO ACADÊMICA (só no emulador local): o chat responde a partir de documentos fixos e revisados
// (demo-academica/fixtures.json), para apresentar o fluxo sem depender da base real.
const { lerModoDemonstracao } = require('./producao.cjs');
const manifesto = require('../demo-academica/fixtures.json');
const { selecionarDocumentosRelevantes } = require('../functions/lib/rag/recuperacao.js');
// Documentos congelados (Object.freeze): nada em tempo de execução consegue alterá-los.
const fixtures = Object.freeze(manifesto.documentos.map(item =>
    Object.freeze({ id: item.id, dados: Object.freeze({ ...item.dados }) })));

// IDs são definidos pelo código revisado, nunca pela pergunta ou por uma URL.
function criarLeitorDemonstracao(firestore) {
    return async pergunta => {
        const documentos = await Promise.all(fixtures.map(async fixture => {
            const snapshot = await firestore.collection('conhecimento').doc(fixture.id).get();
            if (!snapshot.exists) return null;
            const dados = snapshot.data();
            // Conteúdo, fonte e metadados devem corresponder à fixture aprovada.
            // Campos extras do banco nunca são repassados ao contexto.
            if (!dados || Object.entries(fixture.dados).some(([key, value]) => dados[key] !== value))
                return null;
            return { id: fixture.id, ...fixture.dados };
        }));
        // Mesma seleção de trechos relevantes do fluxo de produção.
        return selecionarDocumentosRelevantes(documentos.filter(Boolean), pergunta);
    };
}

module.exports = { fixtures, lerModoDemonstracao, criarLeitorDemonstracao };
