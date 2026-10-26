import type {Request, Response} from "express";
import type {DocumentoPreparado} from "../rag/recuperacao.js";
import {criarEndpointComCors} from "./http.js";

interface DependenciasVisitante {
  recuperarConhecimento: (pergunta: string) => Promise<DocumentoPreparado[]>;
  gerarResposta: (pergunta: string,
    chunks: readonly DocumentoPreparado[]) => Promise<string>;
}

/**
 * Chat temporario: dependencias sem Auth, usuarios ou gravacao de conversas.
 * Limites por instancia guardam apenas contadores, nunca perguntas ou IPs.
 * @param {Function} obterDependencias Leitura documental e geracao.
 * @param {Function} lerOrigens Origens exatas permitidas pelo servidor.
 * @param {Function} agora Relogio substituivel em testes.
 * @return {Function} Endpoint publico independente do chat autenticado.
 */
export function criarEndpointVisitante(
  obterDependencias: () => DependenciasVisitante,
  lerOrigens: () => string,
  agora: () => number = Date.now,
): (req: Request, res: Response) => Promise<void> {
  let inicio = agora();
  let chamadas = 0;
  let ativas = 0;
  const handler = criarEndpointComCors(async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST").status(405).json({error: "Use POST."});
      return;
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 1 || typeof body.pergunta !== "string" ||
        !body.pergunta.trim() || body.pergunta.length > 700) {
      res.status(400).json({
        error: "Envie uma pergunta de até 700 caracteres."});
      return;
    }
    const instante = agora();
    if (instante - inicio >= 60000) {
      inicio = instante;
      chamadas = 0;
    }
    if (chamadas >= 30 || ativas >= 4) {
      res.set("Retry-After", "60").status(429).json({
        error: "Muitas perguntas no momento. Tente novamente em um minuto.",
      });
      return;
    }
    chamadas++;
    ativas++;
    try {
      const deps = obterDependencias();
      const pergunta = body.pergunta.trim();
      const chunks = await deps.recuperarConhecimento(pergunta);
      const resposta = await deps.gerarResposta(pergunta, chunks);
      if (typeof resposta !== "string" || !resposta.trim()) {
        throw new Error("RESPOSTA_INVALIDA");
      }
      res.status(200).json({resposta});
    } finally {
      ativas--;
    }
  }, lerOrigens);
  return async (req, res) => {
    res.set("Cache-Control", "no-store");
    await handler(req, res);
  };
}
