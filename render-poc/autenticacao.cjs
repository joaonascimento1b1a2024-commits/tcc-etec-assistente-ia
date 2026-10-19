'use strict';

const { verificarAutenticacao, ErroAutenticacao } = require('../functions/lib/assistente/autenticacao.js');
const { criarEndpointComCors } = require('../functions/lib/assistente/http.js');

function criarDiagnosticoAutenticado(obterDependencias, lerOrigens,
    responder = async () => ({ status: 'ok', autenticado: true }), validarRequisicao = () => true) {
    return criarEndpointComCors(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (req.method !== 'POST') {
            return res.set('Allow', 'POST').status(405).json({ error: 'Metodo nao permitido.' });
        }
        try {
            await verificarAutenticacao(req, {
                verifyIdToken: (token) => obterDependencias().auth.verifyIdToken(token),
            });
            if (!validarRequisicao(req)) {
                return res.status(400).json({ error: 'Requisicao de diagnostico invalida.' });
            }
            return res.status(200).json(await responder(obterDependencias, req));
        } catch (error) {
            if (error instanceof ErroAutenticacao) return res.status(401).json({ error: error.message });
            throw error;
        }
    }, lerOrigens);
}

module.exports = { criarDiagnosticoAutenticado };
