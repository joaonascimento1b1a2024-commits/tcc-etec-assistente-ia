import {
  INSTRUCAO_SEGURANCA, INSTRUCAO_PROPOSTA, INSTRUCAO_REVISAO,
  SCHEMA_SEGURANCA,
} from "./instrucoes";
import {SCHEMA_PROPOSTA, SCHEMA_REVISAO} from "./contrato";
import type {ProvedorGeracao} from "./contrato";

export type TransporteGemini =
  (url: string, init: RequestInit) => Promise<Response>;
const CATEGORIAS = ["HATE_SPEECH", "SEXUALLY_EXPLICIT",
  "DANGEROUS_CONTENT", "HARASSMENT"];

/**
 * REST lazy, sem logs, ferramentas, SDK novo ou retries.
 * Filtros e classificacao adicional nao garantem seguranca.
 * @param {string} modelo ID explicito para structured output.
 * @param {Function} lerChave Segredo somente no servidor.
 * @param {Function} transporte Fetch substituivel por mock.
 * @return {ProvedorGeracao} Contrato independente de provedor.
 */
export function criarClienteGemini(
  modelo: string, lerChave: () => string,
  transporte: TransporteGemini = globalThis.fetch,
): ProvedorGeracao {
  const resposta = async (
    sistema: string, dados: unknown, schema: object, signal: AbortSignal,
  ): Promise<unknown> => {
    try {
      signal.throwIfAborted();
      if (!/^[a-zA-Z0-9._-]{1,100}$/u.test(modelo)) throw Error("MODELO");
      const chave = lerChave();
      if (!chave || /\s/u.test(chave)) throw Error("CHAVE");
      const r = await transporte(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        modelo + ":generateContent", {
          method: "POST", redirect: "error", credentials: "omit", signal,
          headers: {"x-goog-api-key": chave,
            "Content-Type": "application/json"},
          body: JSON.stringify({
            systemInstruction: {parts: [{text: sistema}]},
            contents: [{role: "user", parts: [{text: JSON.stringify(dados)}]}],
            tools: [],
            safetySettings: CATEGORIAS.map((c) => ({
              category: "HARM_CATEGORY_" + c,
              threshold: "BLOCK_LOW_AND_ABOVE",
            })),
            generationConfig: {
              candidateCount: 1, maxOutputTokens: 2048,
              responseMimeType: "application/json", responseJsonSchema: schema,
            },
          }),
        });
      if (!r.ok || !r.body) throw Error("HTTP");
      const reader = r.body.getReader();
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
          if (total > 65536) throw Error("TAMANHO");
          partes.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      signal.throwIfAborted();
      const body = JSON.parse(Buffer.concat(partes).toString("utf8"));
      if (body.promptFeedback?.blockReason ||
        !Array.isArray(body.candidates) || body.candidates.length !== 1) {
        throw Error("RECUSA");
      }
      const c = body.candidates[0];
      if (c.finishReason !== "STOP" || c.content?.role !== "model" ||
        !Array.isArray(c.content.parts) || !c.content.parts.length ||
        (c.safetyRatings !== undefined && (!Array.isArray(c.safetyRatings) ||
          c.safetyRatings.some(
            (s: {blocked?: unknown}) => s?.blocked === true)))) {
        throw Error("INCOMPLETA");
      }
      const textos: string[] = [];
      for (const p of c.content.parts) {
        if (!p || typeof p !== "object" || Array.isArray(p) ||
          Object.keys(p).some((k) =>
            !["text", "thought", "thoughtSignature"].includes(k)) ||
          ("text" in p && typeof p.text !== "string") ||
          ("thought" in p && typeof p.thought !== "boolean") ||
          ("thoughtSignature" in p &&
            (typeof p.thoughtSignature !== "string" ||
              !p.thoughtSignature.trim() ||
              p.thoughtSignature.length > 65536)) ||
          (!("text" in p) && !("thoughtSignature" in p))) {
          throw Error("FORMATO");
        }
        // Metadados opacos e pensamentos nunca integram o JSON da resposta.
        // Cada chamada e single-turn: nao reenvia assinatura nem historico.
        if (p.thought !== true && typeof p.text === "string") {
          textos.push(p.text);
        }
      }
      const texto = textos.join("");
      if (texto.length > 6000) throw Error("TAMANHO");
      return JSON.parse(texto);
    } catch {
      throw new Error("GEMINI_INDISPONIVEL");
    }
  };
  return {
    async moderar(texto, signal) {
      const r = await resposta(
        INSTRUCAO_SEGURANCA,
        {texto}, SCHEMA_SEGURANCA, signal);
      return !!r && typeof r === "object" &&
        Object.keys(r).length === 1 &&
        (r as {segura?: unknown}).segura === true;
    },
    propor: (pedido, signal) => resposta(
      INSTRUCAO_PROPOSTA,
      pedido, SCHEMA_PROPOSTA, signal),
    async verificar(pedido, proposta, signal) {
      const r = await resposta(
        INSTRUCAO_REVISAO,
        {pedido, proposta}, SCHEMA_REVISAO, signal);
      return !!r && typeof r === "object" &&
        Object.keys(r).length === 1 &&
        (r as {sustentada?: unknown}).sustentada === true;
    },
  };
}
