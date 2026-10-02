import {createRequire} from "node:module";

export const MODELO_GEMINI = "gemini-2.5-flash";

interface ClienteGemini {
  models: {
    generateContent(params: {
      model: string;
      contents: {role: "user"; parts: {text: string}[]}[];
    }):
      Promise<{text?: string}>;
  };
}

interface SDKGemini {
  GoogleGenAI: new (options: {apiKey: string}) => ClienteGemini;
}

/**
 * Cria um gerador lazy; nao le secret nem instancia SDK neste momento.
 * @param {Function} lerChave Leitura do secret somente durante geracao.
 * @param {Function} criarCliente Fabrica SDK, substituivel por mock.
 * @return {Function} Gerador compativel com o handler.
 */
export function criarGeradorGemini(
  lerChave: () => string,
  criarCliente: (apiKey: string) => ClienteGemini =
  (apiKey) => {
    // Facade minima evita tipos MCP opcionais nao usados neste gateway.
    const sdk = createRequire(__filename)("@google/genai") as SDKGemini;
    return new sdk.GoogleGenAI({apiKey});
  },
): (prompt: string, pergunta: string) => Promise<string> {
  return async (prompt, pergunta) => {
    try {
      const apiKey = lerChave();
      if (!apiKey || !apiKey.trim()) {
        throw new Error("GEMINI_UNAVAILABLE");
      }
      const resposta = await criarCliente(apiKey).models.generateContent({
        model: MODELO_GEMINI,
        contents: [{
          role: "user",
          parts: [{text: `${prompt}\n\nPergunta do Usuário: ${pergunta}`}],
        }],
      });
      if (typeof resposta.text !== "string" || !resposta.text.trim()) {
        throw new Error("GEMINI_UNAVAILABLE");
      }
      return resposta.text;
    } catch {
      // Nao propaga mensagem/causa do SDK, que pode conter dados sensiveis.
      throw new Error("GEMINI_UNAVAILABLE");
    }
  };
}
