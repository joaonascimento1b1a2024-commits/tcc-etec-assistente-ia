import {SCHEMA_PROPOSTA, SCHEMA_REVISAO} from "./contrato";
import type {ProvedorGeracao} from "./contrato";
import {
  INSTRUCAO_SEGURANCA, INSTRUCAO_PROPOSTA, INSTRUCAO_REVISAO,
  SCHEMA_SEGURANCA,
} from "./instrucoes";

export type TransporteOpenRouter =
  (url: string, init: RequestInit) => Promise<Response>;
export type CodigoOpenRouter = "OPENROUTER_MODELO_INVALIDO" |
  "OPENROUTER_CHAVE_AUSENTE" | "OPENROUTER_AUTENTICACAO" |
  "OPENROUTER_SEM_CREDITOS" | "OPENROUTER_LIMITE" |
  "OPENROUTER_SEM_ENDPOINT_COMPATIVEL" | "OPENROUTER_HTTP" |
  "OPENROUTER_RECUSA" | "OPENROUTER_INCOMPLETA" |
  "OPENROUTER_JSON_INVALIDO" | "OPENROUTER_FORMATO_INVALIDO" |
  "OPENROUTER_SAIDA_EXCESSIVA" | "OPENROUTER_TIMEOUT" |
  "OPENROUTER_CANCELADO" | "OPENROUTER_INDISPONIVEL";

/** Erro com codigo fechado; nunca guarda corpo, mensagem remota ou causa. */
export class ErroOpenRouter extends Error {
  /**
   * @param {CodigoOpenRouter} codigo Categoria segura para telemetria.
   */
  constructor(readonly codigo: CodigoOpenRouter) {
    super(codigo);
  }
}

/**
 * Somente Gemini explicito; sem routers, URLs ou variantes com plugins.
 * @param {string} modelo Identificador do catalogo, definido pelo operador.
 * @return {boolean} ID permitido para o fluxo migrado.
 */
export function modeloOpenRouterValido(modelo: string): boolean {
  return modelo.length <= 150 &&
    /^google\/gemini-[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(modelo);
}

/**
 * Chat Completions nativo. ZDR obrigatorio em TODAS as quatro etapas.
 * Sem SDK, retries, modelo alternativo, ferramentas ou URL configuravel.
 * @param {string} modelo Gemini explicito do ambiente do servidor.
 * @param {Function} lerChave Leitura lazy do segredo exclusivo do backend.
 * @param {Function} transporte Fetch injetavel para testes sem rede.
 * @return {ProvedorGeracao} Contrato com validacao local adicional no gateway.
 */
export function criarClienteOpenRouter(
  modelo: string, lerChave: () => string,
  transporte: TransporteOpenRouter = globalThis.fetch,
): ProvedorGeracao {
  const resposta = async (
    sistema: string, dados: unknown, schema: object, original: AbortSignal,
  ): Promise<unknown> => {
    // Limite defensivo por chamada; o gateway impoe um prazo TOTAL menor.
    const signal = AbortSignal.any([original, AbortSignal.timeout(30000)]);
    const falha = (codigo: CodigoOpenRouter): never => {
      throw new ErroOpenRouter(codigo);
    };
    const executar = async (): Promise<unknown> => {
      signal.throwIfAborted();
      if (!modeloOpenRouterValido(modelo)) falha("OPENROUTER_MODELO_INVALIDO");
      const chave = lerChave();
      if (!chave || /\s/u.test(chave)) falha("OPENROUTER_CHAVE_AUSENTE");
      const r = await transporte(
        "https://openrouter.ai/api/v1/chat/completions", {
          method: "POST", redirect: "error", credentials: "omit", signal,
          headers: {"Authorization": `Bearer ${chave}`,
            "Content-Type": "application/json"},
          body: JSON.stringify({
            model: modelo, stream: false, max_tokens: 2048,
            messages: [{role: "system", content: sistema},
              {role: "user", content: JSON.stringify(dados)}],
            response_format: {type: "json_schema", json_schema: {
              name: "sylvinho", strict: true, schema,
            }},
            provider: {zdr: true, data_collection: "deny",
              require_parameters: true, allow_fallbacks: false},
          }),
        });
      signal.throwIfAborted();
      const erroHTTP = (status: unknown): never => {
        switch (status) {
        case 401: return falha("OPENROUTER_AUTENTICACAO");
        case 402: return falha("OPENROUTER_SEM_CREDITOS");
        case 403: return falha("OPENROUTER_RECUSA");
        case 408: case 504: return falha("OPENROUTER_TIMEOUT");
        case 429: return falha("OPENROUTER_LIMITE");
        case 404: case 503:
          return falha("OPENROUTER_SEM_ENDPOINT_COMPATIVEL");
        default: return falha("OPENROUTER_HTTP");
        }
      };
      if (!r.ok) {
        void r.body?.cancel().catch(() => undefined);
        erroHTTP(r.status);
      }
      if (!r.body) return falha("OPENROUTER_FORMATO_INVALIDO");
      const reader = r.body.getReader();
      const cancelar = (): void => {
        void reader.cancel().catch(() => undefined);
      };
      signal.addEventListener("abort", cancelar, {once: true});
      const partes: Uint8Array[] = [];
      let total = 0;
      try {
        let terminou = false;
        while (!terminou) {
          signal.throwIfAborted();
          const {done, value} = await reader.read();
          terminou = done;
          if (done) break;
          total += value.length;
          if (total > 65536) falha("OPENROUTER_SAIDA_EXCESSIVA");
          partes.push(value);
        }
      } finally {
        signal.removeEventListener("abort", cancelar);
        cancelar();
      }
      signal.throwIfAborted();
      const parse = (texto: string): unknown => {
        try {
          return JSON.parse(texto);
        } catch {
          return falha("OPENROUTER_JSON_INVALIDO");
        }
      };
      const body = parse(Buffer.concat(partes).toString("utf8")) as {
        error?: {code?: unknown};
        choices?: {finish_reason?: unknown; message?: {
          role?: unknown; content?: unknown; refusal?: unknown;
          tool_calls?: unknown; function_call?: unknown;
        }}[];
      } | null;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return falha("OPENROUTER_FORMATO_INVALIDO");
      }
      // OpenRouter pode devolver erro dentro de um HTTP 200.
      if (body.error) erroHTTP(body.error.code);
      if (!Array.isArray(body.choices) || body.choices.length !== 1) {
        return falha("OPENROUTER_FORMATO_INVALIDO");
      }
      const c = body.choices[0];
      if (c?.message?.refusal || c?.finish_reason === "content_filter") {
        return falha("OPENROUTER_RECUSA");
      }
      if (c?.finish_reason !== "stop") falha("OPENROUTER_INCOMPLETA");
      const m = c?.message;
      if (m?.role !== "assistant" || typeof m.content !== "string" ||
        (m.tool_calls != null && (!Array.isArray(m.tool_calls) ||
          m.tool_calls.length !== 0)) || m.function_call != null) {
        return falha("OPENROUTER_FORMATO_INVALIDO");
      }
      if (m.content.length > 6000) falha("OPENROUTER_SAIDA_EXCESSIVA");
      return parse(m.content);
    };
    let cancelar: () => void = () => undefined;
    try {
      // Garante conclusao local mesmo com um transporte que ignore o signal.
      const cancelamento = new Promise<never>((_, reject) => {
        cancelar = () => reject(new Error("ABORTADO"));
        signal.addEventListener("abort", cancelar, {once: true});
        if (signal.aborted) cancelar();
      });
      return await Promise.race([executar(), cancelamento]);
    } catch (erro) {
      if (signal.aborted) {
        return falha(signal.reason?.name === "TimeoutError" ?
          "OPENROUTER_TIMEOUT" : "OPENROUTER_CANCELADO");
      }
      if (erro instanceof ErroOpenRouter) throw erro;
      return falha("OPENROUTER_INDISPONIVEL");
    } finally {
      signal.removeEventListener("abort", cancelar);
    }
  };
  const afirmativo = (r: unknown, campo: string): boolean =>
    !!r && typeof r === "object" && !Array.isArray(r) &&
    Object.keys(r).length === 1 &&
    (r as Record<string, unknown>)[campo] === true;
  return {
    async moderar(texto, signal) {
      return afirmativo(await resposta(INSTRUCAO_SEGURANCA,
        {texto}, SCHEMA_SEGURANCA, signal), "segura");
    },
    propor: (pedido, signal) => resposta(INSTRUCAO_PROPOSTA,
      pedido, SCHEMA_PROPOSTA, signal),
    async verificar(pedido, proposta, signal) {
      return afirmativo(await resposta(INSTRUCAO_REVISAO,
        {pedido, proposta}, SCHEMA_REVISAO, signal), "sustentada");
    },
  };
}
