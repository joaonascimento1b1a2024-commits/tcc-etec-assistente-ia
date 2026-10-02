import type {Request, Response} from "express";
import {perguntarAssistenteHandler} from "./handler.js";
import type {DependenciasAssistente} from "./handler.js";

/**
 * Valida origens exatas; HTTPS ou HTTP somente em loopback.
 * @param {string} configuracao Lista separada por virgulas.
 * @return {string[]} Origens permitidas; vazio bloqueia navegadores.
 */
export function origensPermitidas(configuracao: string): string[] {
  return configuracao.split(",").map((item) => item.trim())
    .filter(Boolean).map((origem) => {
      const url = new URL(origem);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (url.origin !== origem || url.hostname.includes("*") ||
        url.username || url.password ||
        !(url.protocol === "https:" || (url.protocol === "http:" && local))) {
        throw new Error("INVALID_CORS_CONFIGURATION");
      }
      return origem;
    });
}

/**
 * Adapta CORS/OPTIONS antes de construir dependencias do handler.
 * @param {Function} obterDependencias Fabrica lazy dos adapters reais.
 * @param {Function} lerOrigens Configuracao nao secreta.
 * @return {Function} Callback HTTP, sem registrar endpoint.
 */
export function criarEndpointAssistente(
  obterDependencias: () => DependenciasAssistente,
  lerOrigens: () => string,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    res.vary("Origin");
    try {
      const origem = req.get("Origin");
      const permitidas = origensPermitidas(lerOrigens());
      if (origem && !permitidas.includes(origem)) {
        res.status(403).json({error: "Origem não permitida."});
        return;
      }
      if (origem) {
        res.set("Access-Control-Allow-Origin", origem);
      }
      if (req.method === "OPTIONS") {
        const metodo = req.get("Access-Control-Request-Method");
        const cabecalhos = (req.get("Access-Control-Request-Headers") || "")
          .toLowerCase().split(",").map((item) => item.trim()).filter(Boolean);
        if (!origem || metodo !== "POST" ||
          cabecalhos.some((item) =>
            !["authorization", "content-type"].includes(item))) {
          res.status(400).json({error: "Preflight inválido."});
          return;
        }
        res.set("Access-Control-Allow-Methods", "POST");
        res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.status(204).send();
        return;
      }
      await perguntarAssistenteHandler(req, res, obterDependencias());
    } catch {
      if (!res.headersSent) {
        res.status(500).json({
          error: "Erro interno no servidor do assistente.",
        });
      }
    }
  };
}
