import {prepararEvidencias} from "../fundamentacao/gateway";
import {copiarDadosEstritos, textoSuspeito} from "../fundamentacao/contrato";
import type {
  RespostaDocumental, TrechoDocumental,
} from "../resposta-documental";
import {FONTES_ORIGINAIS} from "../../rag/recuperacao";
import {validarGeracao} from "./contrato";
import type {PedidoGeracao, ProvedorGeracao} from "./contrato";
import {criarClienteOpenAI} from "./openai";
import {criarClienteGemini} from "./gemini";
import {
  criarClienteOpenRouter, ErroOpenRouter, modeloOpenRouterValido,
} from "./openrouter";
import type {CodigoOpenRouter} from "./openrouter";

export type AmbienteIA = Readonly<Record<string, string | undefined>>;
export type EventoIA = "GERADA" | "FALLBACK" | "SEGURANCA";
export type MotivoFallback = CodigoOpenRouter | "UID_NAO_AUTORIZADO" |
  "IA_DESATIVADA" | "PROVEDOR_INVALIDO" | "APROVACAO_PENDENTE" |
  "MODALIDADE_PENDENTE" | "RETENCAO_BLOQUEADA" | "DADOS_BLOQUEADOS" |
  "EVIDENCIAS_INSUFICIENTES" | "CONFIGURACAO_INVALIDA" |
  "FONTES_INVALIDAS" | "OCUPADO" | "LIMITE_LOCAL" | "ENTRADA_INSEGURA" |
  "PROPOSTA_INVALIDA" | "REVISAO_REPROVADA" | "SAIDA_INSEGURA" |
  "SAIDA_EXCESSIVA" | "GERACAO_TIMEOUT" | "GERACAO_INDISPONIVEL";
export interface OpcoesGerador {
  lerAmbiente?: () => AmbienteIA;
  criarCliente?: (modelo: string, lerChave: () => string) => ProvedorGeracao;
  criarClienteGemini?:
    (modelo: string, lerChave: () => string) => ProvedorGeracao;
  criarClienteOpenRouter?:
    (modelo: string, lerChave: () => string) => ProvedorGeracao;
  registrarEvento?: (codigo: EventoIA, motivo?: MotivoFallback) => void;
  agora?: () => number;
}

/**
 * Allowlist privada, exata e fail-closed. Ausente/invalida nao libera ninguem.
 * @param {AmbienteIA} env Configuracao exclusivamente do servidor.
 * @param {unknown} uid Identidade obtida do token Firebase verificado.
 * @return {boolean} UID expressamente autorizado a novas geracoes.
 */
export function usuarioIAAutorizado(env: AmbienteIA, uid: unknown): boolean {
  const lista = env.SYLVINHO_IA_UID_ALLOWLIST;
  const valido = (s: unknown): s is string => typeof s === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/u.test(s);
  if (!valido(uid) || typeof lista !== "string" || !lista ||
    lista.length > 3000) return false;
  const uids = lista.split(",").map((s) => s.trim());
  return uids.length <= 20 && uids.every(valido) &&
    new Set(uids).size === uids.length && uids.includes(uid);
}

/**
 * Politica de retencao nao comprova elegibilidade nem ausencia de dados
 * pessoais.
 * @param {AmbienteIA} env Configuracao do servidor; nunca do corpo HTTP.
 * @return {string} Modalidade reconhecida ou bloqueio fail-closed.
 */
export function politicaRetencaoIA(env: AmbienteIA):
  "zdr" | "demonstracao_bloqueada_dados" | "bloqueada" {
  const provedor = env.SYLVINHO_IA_PROVIDER;
  if (provedor === "openai" || provedor === "openrouter") {
    return env.SYLVINHO_IA_ZDR_APROVADO === "true" ? "zdr" : "bloqueada";
  }
  if (provedor !== "gemini") return "bloqueada";
  const modo = env.SYLVINHO_IA_GEMINI_MODALIDADE ?? "zdr";
  if (modo === "zdr") {
    return env.SYLVINHO_IA_ZDR_APROVADO === "true" ? "zdr" : "bloqueada";
  }
  if (modo === "demonstracao_publica" &&
    env.SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA === "true") {
    return "demonstracao_bloqueada_dados";
  }
  return "bloqueada";
}

/**
 * Escolha opt-in; preserva verificacao Auth, RAG, persistencia e HTTP.
 * Flags do operador NAO configuram ZDR ou aprovacao institucional.
 * @param {OpcoesGerador} opcoes Fabricas substituiveis nos testes.
 * @return {Function} Mesmo contrato de string do gerador documental publicado.
 */
export function criarGeradorConfiguravel(opcoes: OpcoesGerador = {}) {
  const lerAmbiente = opcoes.lerAmbiente ?? (() => process.env);
  const criarCliente = opcoes.criarCliente ?? criarClienteOpenAI;
  const agora = opcoes.agora ?? Date.now;
  let ocupado = false;
  let inicioJanela = agora();
  let chamadasNaJanela = 0;
  const evento = (codigo: EventoIA, motivo?: MotivoFallback): void => {
    try {
      // Somente codigos; nunca conteudo, usuario, erro bruto ou token.
      opcoes.registrarEvento?.(codigo, motivo);
    } catch {
      // Telemetria nao impede fallback nem vaza detalhes.
    }
  };
  return async (
    pergunta: unknown, chunks: unknown, contexto?: {readonly uid: string},
  ): Promise<string> => {
    let baseline: RespostaDocumental | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    let adquiriu = false;
    const fallback = (
      motivo: MotivoFallback = "GERACAO_INDISPONIVEL",
    ): string => {
      evento("FALLBACK", motivo);
      if (!baseline) throw new Error("GERACAO_ENTRADA_INVALIDA");
      return baseline.resposta;
    };
    try {
      const preparada = prepararEvidencias(pergunta, chunks);
      if (!preparada.ok) throw new Error("GERACAO_ENTRADA_INVALIDA");
      baseline = preparada.baseline;
      const env = lerAmbiente();
      if (!usuarioIAAutorizado(env, contexto?.uid)) {
        return fallback("UID_NAO_AUTORIZADO");
      }
      const aprovacoes = ["SYLVINHO_IA_INSTITUCIONAL_APROVADA",
        "SYLVINHO_IA_PRIVACIDADE_APROVADA", "SYLVINHO_IA_MENORES_APROVADA"];
      const provedor = env.SYLVINHO_IA_PROVIDER;
      if (env.SYLVINHO_IA_ENABLED !== "true") {
        return fallback("IA_DESATIVADA");
      }
      if (!["openai", "gemini", "openrouter"].includes(provedor || "")) {
        return fallback("PROVEDOR_INVALIDO");
      }
      if (provedor === "gemini" &&
        env.SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA !== "true") {
        return fallback("MODALIDADE_PENDENTE");
      }
      if (aprovacoes.some((nome) => env[nome] !== "true") ||
        (provedor === "openrouter" &&
          env.SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA !== "true")) {
        return fallback("APROVACAO_PENDENTE");
      }
      const retencao = politicaRetencaoIA(env);
      if (retencao === "bloqueada") return fallback("RETENCAO_BLOQUEADA");
      if (retencao === "demonstracao_bloqueada_dados") {
        // Texto livre e geracao podem conter dados pessoais nao detectados.
        // Nao ha mecanismo comprovado de revisao de TODOS os envios externos.
        // Flag de retencao, allowlist e regex NAO autorizam essa transmissao.
        evento("SEGURANCA");
        return fallback("DADOS_BLOQUEADOS");
      }
      if (preparada.motivoContexto === "minimizacao_bloqueada") {
        return fallback("DADOS_BLOQUEADOS");
      }
      if (baseline.status !== "trechos_encontrados" ||
        !baseline.citacoes.length || baseline.citacoes.some((c) =>
        c.fonte.natureza !== "documental")) {
        return fallback("EVIDENCIAS_INSUFICIENTES");
      }
      const modelo = (provedor === "openrouter" ? env.OPENROUTER_MODEL :
        provedor === "gemini" ?
          env.GEMINI_MODEL : env.OPENAI_MODEL) || "";
      const timeout = Number(env.SYLVINHO_IA_TIMEOUT_MS ?? 20000);
      const limite = Number(env.SYLVINHO_IA_MAX_POR_MINUTO ?? 5);
      const modeloValido = provedor === "openrouter" ?
        modeloOpenRouterValido(modelo) :
        /^[a-zA-Z0-9._:-]{1,100}$/u.test(modelo);
      if (!modeloValido ||
        !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30000 ||
        !Number.isSafeInteger(limite) || limite < 1 || limite > 20) {
        return fallback("CONFIGURACAO_INVALIDA");
      }
      const cs = copiarDadosEstritos(chunks, 24000) as TrechoDocumental[];
      if (cs.some((c) => c.ativo !== true ||
        !FONTES_ORIGINAIS.includes(c.documentoId || "")) ||
        new Set(cs.map((c) => c.id)).size !== cs.length) {
        return fallback("FONTES_INVALIDAS");
      }
      const evidencias = baseline.citacoes.map((c, i) => {
        const contexto = cs.findIndex((d) => d.id === c.fonte.chunkId &&
          d.documentoId === c.fonte.documentoId);
        if (contexto < 0 || !cs[contexto].conteudo?.includes(c.texto)) {
          throw new Error("VINCULO_INVALIDO");
        }
        return Object.freeze({id: `E${i + 1}`, texto: c.texto, contexto});
      });
      const pedido: PedidoGeracao = Object.freeze({
        pergunta: pergunta as string,
        evidencias: Object.freeze(evidencias),
        contextos: Object.freeze(cs.map((c) => c.conteudo || "")),
      });
      if (agora() - inicioJanela >= 60000) {
        inicioJanela = agora(); chamadasNaJanela = 0;
      }
      if (ocupado) return fallback("OCUPADO");
      if (chamadasNaJanela >= limite) return fallback("LIMITE_LOCAL");
      ocupado = true; adquiriu = true; chamadasNaJanela++;
      const cliente = provedor === "openrouter" ?
        (opcoes.criarClienteOpenRouter ?? criarClienteOpenRouter)(
          modelo, () => env.OPENROUTER_API_KEY || "") :
        provedor === "gemini" ?
          (opcoes.criarClienteGemini ?? criarClienteGemini)(
            modelo, () => env.GEMINI_API_KEY || "") :
          criarCliente(modelo, () => env.OPENAI_API_KEY || "");
      const operacao = async (): Promise<string> => {
        const entrada = [pedido.pergunta, ...pedido.contextos].join("\n\n");
        const entradaSegura = await cliente.moderar(
          entrada, controller.signal,
        );
        controller.signal.throwIfAborted();
        if (!entradaSegura) {
          evento("SEGURANCA"); return fallback("ENTRADA_INSEGURA");
        }
        const proposta = validarGeracao(
          await cliente.propor(pedido, controller.signal), evidencias,
        );
        controller.signal.throwIfAborted();
        if (!proposta) return fallback("PROPOSTA_INVALIDA");
        if (!await cliente.verificar(pedido, proposta, controller.signal)) {
          return fallback("REVISAO_REPROVADA");
        }
        controller.signal.throwIfAborted();
        const texto = proposta.afirmacoes.map((a) => a.texto).join("\n\n");
        if (textoSuspeito(texto)) return fallback("SAIDA_INSEGURA");
        // Baseline integral preservado, incluindo condicoes e fontes.
        const aviso = "Resposta gerada por IA; confira as fontes oficiais.";
        const final = aviso + "\n\n" +
          texto + "\n\n" + baseline!.resposta;
        if (final.length > 2400) return fallback("SAIDA_EXCESSIVA");
        if (!await cliente.moderar(final, controller.signal)) {
          evento("SEGURANCA"); return fallback("SAIDA_INSEGURA");
        }
        controller.signal.throwIfAborted();
        evento("GERADA");
        return final;
      };
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(new DOMException("Prazo total", "TimeoutError"));
          reject(new Error("GERACAO_TIMEOUT"));
        }, timeout);
      });
      return await Promise.race([operacao(), deadline]);
    } catch (erro) {
      return fallback(controller.signal.aborted ? "GERACAO_TIMEOUT" :
        erro instanceof ErroOpenRouter ? erro.codigo :
          "GERACAO_INDISPONIVEL");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (adquiriu) ocupado = false;
    }
  };
}
