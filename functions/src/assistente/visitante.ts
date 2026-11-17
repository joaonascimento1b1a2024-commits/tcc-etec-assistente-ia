import {classificarEscopo} from "./escopo";
import type {Request, Response} from "express";
import type {DocumentoPreparado} from "../rag/recuperacao.js";
import {criarEndpointComCors} from "./http.js";
import {ErroRespostaTemporaria} from "./handler.js";

interface DependenciasVisitante {
  /** Motor curado opcional; null = sem evidencia, segue o fluxo documental. */
  responderVisitante?: (pergunta: string) => Promise<string | null>;
  recuperarConhecimento: (pergunta: string) => Promise<DocumentoPreparado[]>;
  gerarResposta: (pergunta: string,
    chunks: readonly DocumentoPreparado[],
    contexto: {readonly publico: "visitante"}) => Promise<string>;
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
        error: "Envie uma pergunta de até 700 caracteres.",
      });
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
      const pergunta = body.pergunta.trim();
      const escopo = classificarEscopo(pergunta);
      // Fora de escopo e saudacao seguem locais. A lista de palavras-chave nao
      // cobre todo assunto escolar: o motor curado (busca semantica) tenta as
      // ambiguas; sem fato aprovado, mantem o pedido de esclarecimento.
      if (escopo.resposta && escopo.categoria !== "ambigua") {
        res.status(200).json({resposta: escopo.resposta});
        return;
      }
      const deps = obterDependencias();
      let resposta = deps.responderVisitante ?
        await deps.responderVisitante(pergunta) : null;
      if (resposta === null && escopo.resposta) {
        res.status(200).json({resposta: escopo.resposta});
        return;
      }
      if (resposta === null) {
        const chunks = await deps.recuperarConhecimento(pergunta);
        // A rota atribui o acesso publico depois de validar o corpo estrito.
        resposta = await deps.gerarResposta(
          pergunta, chunks, {publico: "visitante"},
        );
      }
      if (typeof resposta !== "string" || !resposta.trim()) {
        throw new Error("RESPOSTA_INVALIDA");
      }
      res.status(200).json({resposta});
    } catch (error) {
      // Mesmo contrato da rota autenticada para falhas recuperaveis.
      if (!(error instanceof ErroRespostaTemporaria)) throw error;
      res.set("Retry-After", String(error.esperaSegundos));
      res.status(error.motivo === "LIMITE_USO" ? 429 : 503).json({
        error: "Não foi possível concluir a resposta agora.",
        codigo: error.motivo,
        retryAfterSeconds: error.esperaSegundos,
      });
    } finally {
      ativas--;
    }
  }, lerOrigens);
  return async (req, res) => {
    res.set("Cache-Control", "no-store");
    await handler(req, res);
  };
}
