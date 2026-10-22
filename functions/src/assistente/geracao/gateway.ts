import {prepararEvidencias} from "../fundamentacao/gateway";
import {copiarDadosEstritos, textoSuspeito} from "../fundamentacao/contrato";
import type {
  RespostaDocumental, TrechoDocumental,
} from "../resposta-documental";
import {FONTES_ORIGINAIS} from "../../rag/recuperacao";
import {validarGeracao} from "./contrato";
import type {PedidoGeracao, ProvedorGeracao} from "./contrato";
import {criarClienteOpenAI} from "./openai";

export type AmbienteIA = Readonly<Record<string, string | undefined>>;
export type EventoIA = "GERADA" | "FALLBACK" | "SEGURANCA";
export interface OpcoesGerador {
  lerAmbiente?: () => AmbienteIA;
  criarCliente?: (modelo: string, lerChave: () => string) => ProvedorGeracao;
  registrarEvento?: (codigo: EventoIA) => void;
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
  const evento = (codigo: EventoIA): void => {
    try {
      // Somente codigos; nunca conteudo, usuario, erro bruto ou token.
      opcoes.registrarEvento?.(codigo);
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
    const fallback = (): string => {
      evento("FALLBACK");
      if (!baseline) throw new Error("GERACAO_ENTRADA_INVALIDA");
      return baseline.resposta;
    };
    try {
      const preparada = prepararEvidencias(pergunta, chunks);
      if (!preparada.ok) throw new Error("GERACAO_ENTRADA_INVALIDA");
      baseline = preparada.baseline;
      const env = lerAmbiente();
      if (!usuarioIAAutorizado(env, contexto?.uid)) return baseline.resposta;
      const aprovacoes = ["SYLVINHO_IA_INSTITUCIONAL_APROVADA",
        "SYLVINHO_IA_PRIVACIDADE_APROVADA", "SYLVINHO_IA_MENORES_APROVADA",
        "SYLVINHO_IA_ZDR_APROVADO"];
      if (env.SYLVINHO_IA_ENABLED !== "true" ||
        env.SYLVINHO_IA_PROVIDER !== "openai" ||
        aprovacoes.some((nome) => env[nome] !== "true")) {
        return baseline.resposta;
      }
      if (baseline.status !== "trechos_encontrados" ||
        !baseline.citacoes.length || baseline.citacoes.some((c) =>
        c.fonte.natureza !== "documental") ||
        preparada.motivoContexto === "minimizacao_bloqueada") {
        return fallback();
      }
      const modelo = env.OPENAI_MODEL || "";
      const timeout = Number(env.SYLVINHO_IA_TIMEOUT_MS ?? 20000);
      const limite = Number(env.SYLVINHO_IA_MAX_POR_MINUTO ?? 5);
      if (!/^[a-zA-Z0-9._:-]{1,100}$/u.test(modelo) ||
        !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30000 ||
        !Number.isSafeInteger(limite) || limite < 1 || limite > 20) {
        return fallback();
      }
      const cs = copiarDadosEstritos(chunks, 24000) as TrechoDocumental[];
      if (cs.some((c) => c.ativo !== true ||
        !FONTES_ORIGINAIS.includes(c.documentoId || "")) ||
        new Set(cs.map((c) => c.id)).size !== cs.length) return fallback();
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
      if (ocupado || chamadasNaJanela >= limite) return fallback();
      ocupado = true; adquiriu = true; chamadasNaJanela++;
      const cliente = criarCliente(modelo, () => env.OPENAI_API_KEY || "");
      const operacao = async (): Promise<string> => {
        const entrada = [pedido.pergunta, ...pedido.contextos].join("\n\n");
        const entradaSegura = await cliente.moderar(
          entrada, controller.signal,
        );
        controller.signal.throwIfAborted();
        if (!entradaSegura) {
          evento("SEGURANCA"); return fallback();
        }
        const proposta = validarGeracao(
          await cliente.propor(pedido, controller.signal), evidencias,
        );
        controller.signal.throwIfAborted();
        if (!proposta || !await cliente.verificar(
          pedido, proposta, controller.signal,
        )) return fallback();
        controller.signal.throwIfAborted();
        const texto = proposta.afirmacoes.map((a) => a.texto).join("\n\n");
        if (textoSuspeito(texto)) return fallback();
        // Baseline integral preservado, incluindo condicoes e fontes.
        const aviso = "Resposta gerada por IA; confira as fontes oficiais.";
        const final = aviso + "\n\n" +
          texto + "\n\n" + baseline!.resposta;
        if (final.length > 2400) return fallback();
        if (!await cliente.moderar(final, controller.signal)) {
          evento("SEGURANCA"); return fallback();
        }
        controller.signal.throwIfAborted();
        evento("GERADA");
        return final;
      };
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(); reject(new Error("GERACAO_TIMEOUT"));
        }, timeout);
      });
      return await Promise.race([operacao(), deadline]);
    } catch {
      return fallback();
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (adquiriu) ocupado = false;
    }
  };
}
