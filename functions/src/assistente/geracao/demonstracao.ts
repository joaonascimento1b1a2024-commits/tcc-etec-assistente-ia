import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {copiarDadosEstritos} from "../fundamentacao/contrato";
import {validarGeracao} from "./contrato";
import type {PedidoGeracao, ProvedorGeracao} from "./contrato";
import {criarClienteGemini} from "./gemini";
import {usuarioIAAutorizado} from "./gateway";
import type {AmbienteIA, EventoIA} from "./gateway";

const TEXTO =
  "O certificado experimental utiliza papel violeta de laboratório.";
const AVISO = "Demonstração sintética; não é informação escolar oficial.";
const FONTE = "Fonte: Exemplo sintético — E1. Citação literal: " + TEXTO;
const PERGUNTAS: Readonly<Record<string, string>> = Object.freeze({
  "papel-experimental-v1": "Qual papel utiliza o certificado experimental?",
  "cor-experimental-v1": "Qual é a cor do papel do certificado experimental?",
});
const PALAVRAS = new Set(("o a de do da para e é utilizado utiliza " +
  "certificado experimental papel violeta laboratório").split(" "));
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
export const CATALOGO_DEMO_SHA256 = sha(JSON.stringify({
  perguntas: PERGUNTAS, evidencia: TEXTO,
}));
export const APROVACAO_DEMO_PATH =
  "/etc/secrets/sylvinho-gemini-demo-aprovacao.json";

export interface DemonstracaoAssistente {
  listarPerguntas(uid: string): readonly {
    perguntaId: string; pergunta: string;
  }[];
  resolverPergunta(id: unknown, uid: string): string | undefined;
  gerarResposta(id: string, uid: string): Promise<string>;
}
interface OpcoesDemo {
  lerAmbiente?: () => AmbienteIA;
  lerComprovacao?: () => string;
  criarCliente?: (modelo: string, lerChave: () => string) => ProvedorGeracao;
  agora?: () => number;
  registrarEvento?: (evento: EventoIA) => void;
}

/**
 * Catalogo fechado; nao recebe pergunta livre, corpus, historico ou HTTP.
 * Dossie e hash registram revisao externa; nao provam automaticamente termos.
 * @param {OpcoesDemo} opcoes Dependencias do servidor, substituiveis offline.
 * @return {DemonstracaoAssistente} Extensao opt-in do endpoint autenticado.
 */
export function criarDemonstracaoGemini(
  opcoes: OpcoesDemo = {},
): DemonstracaoAssistente {
  const ambiente = opcoes.lerAmbiente ?? (() => process.env);
  const agora = opcoes.agora ?? Date.now;
  const lerComprovacao = opcoes.lerComprovacao ??
    (() => readFileSync(APROVACAO_DEMO_PATH, "utf8"));
  let ocupado = false;
  let inicio = agora();
  let quantidade = 0;
  const evento = (e: EventoIA): void => {
    try {
      opcoes.registrarEvento?.(e);
    } catch {
      // Sem logs de dados/erros.
    }
  };
  const autorizar = (uid: string): AmbienteIA | undefined => {
    try {
      const env = ambiente();
      const flags = ["SYLVINHO_IA_ENABLED",
        "SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA",
        "SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA",
        "SYLVINHO_IA_INSTITUCIONAL_APROVADA",
        "SYLVINHO_IA_PRIVACIDADE_APROVADA", "SYLVINHO_IA_MENORES_APROVADA"];
      if (flags.some((f) => env[f] !== "true") ||
        env.SYLVINHO_IA_PROVIDER !== "gemini" ||
        env.SYLVINHO_IA_GEMINI_MODALIDADE !== "demonstracao_publica" ||
        !usuarioIAAutorizado(env, uid)) return undefined;
      const hash = env.SYLVINHO_IA_GEMINI_DEMO_APROVACAO_SHA256;
      if (!hash || !/^[a-f0-9]{64}$/u.test(hash)) return undefined;
      const raw = lerComprovacao();
      if (typeof raw !== "string" || Buffer.byteLength(raw) > 8000 ||
        sha(raw) !== hash) return undefined;
      const d = copiarDadosEstritos(JSON.parse(raw), 8000) as
        Record<string, unknown>;
      const campos = ["versao", "escopo", "catalogoSha256", "allowlistSha256",
        "termosRef", "privacidadeRef", "instituicaoRef", "somenteAdultos",
        "retencaoAceita", "emitidoEm", "expiraEm"];
      if (!d || typeof d !== "object" || Array.isArray(d) ||
        Object.keys(d).length !== campos.length ||
        !campos.every((k) => Object.prototype.hasOwnProperty.call(d, k)) ||
        d.versao !== 1 || d.escopo !== "gemini_demo_sintetica_adultos" ||
        d.catalogoSha256 !== CATALOGO_DEMO_SHA256 ||
        d.allowlistSha256 !== sha(env.SYLVINHO_IA_UID_ALLOWLIST!.split(",")
          .map((s) => s.trim()).sort().join(",")) ||
        d.somenteAdultos !== true || d.retencaoAceita !== true ||
        [d.termosRef, d.privacidadeRef, d.instituicaoRef].some((r) =>
          typeof r !== "string" || !/^[A-Za-z0-9_-]{8,100}$/u.test(r)) ||
        typeof d.emitidoEm !== "string" || typeof d.expiraEm !== "string") {
        return undefined;
      }
      const emitido = Date.parse(d.emitidoEm);
      const expira = Date.parse(d.expiraEm);
      const now = agora();
      if (!Number.isFinite(emitido) || !Number.isFinite(expira) ||
        emitido > now || expira <= now || expira <= emitido ||
        expira - emitido > 86400000) return undefined;
      return env;
    } catch {
      return undefined;
    }
  };
  const resolver = (id: unknown): string | undefined =>
    typeof id === "string" &&
    Object.prototype.hasOwnProperty.call(PERGUNTAS, id) ?
      PERGUNTAS[id] : undefined;
  return {
    listarPerguntas(uid) {
      if (!autorizar(uid)) return [];
      return Object.keys(PERGUNTAS).map((perguntaId) => ({
        perguntaId, pergunta: AVISO + "\n" + PERGUNTAS[perguntaId],
      }));
    },
    resolverPergunta(id, uid) {
      const pergunta = resolver(id);
      return pergunta && autorizar(uid) ? AVISO + "\n" + pergunta : undefined;
    },
    async gerarResposta(id, uid) {
      const pergunta = resolver(id);
      const env = autorizar(uid);
      if (!pergunta || !env) throw Error("DEMO_NAO_AUTORIZADA");
      const fallback = (): string => {
        evento("FALLBACK");
        return AVISO + "\n\n" + TEXTO + "\n\n" + FONTE;
      };
      const timeout = Number(env.SYLVINHO_IA_TIMEOUT_MS ?? 20000);
      const limite = Number(env.SYLVINHO_IA_MAX_POR_MINUTO ?? 5);
      const modelo = env.GEMINI_MODEL || "";
      if (!/^[A-Za-z0-9._-]{1,100}$/u.test(modelo) ||
        !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30000 ||
        !Number.isSafeInteger(limite) || limite < 1 || limite > 20) {
        return fallback();
      }
      if (agora() - inicio >= 60000) {
        inicio = agora(); quantidade = 0;
      }
      if (ocupado || quantidade >= limite) return fallback();
      ocupado = true; quantidade++;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const pedido: PedidoGeracao = {
        pergunta, contextos: [TEXTO],
        evidencias: [{id: "E1", texto: TEXTO, contexto: 0}],
      };
      try {
        const cliente = (opcoes.criarCliente ?? criarClienteGemini)(
          modelo, () => env.GEMINI_API_KEY || "");
        const executar = async (): Promise<string> => {
          if (!await cliente.moderar(pergunta + "\n\n" + TEXTO,
            controller.signal)) return fallback();
          controller.signal.throwIfAborted();
          const p = validarGeracao(await cliente.propor(pedido,
            controller.signal), pedido.evidencias);
          controller.signal.throwIfAborted();
          // Vocabulario fixo antes dos reenvios. Regex de PII nao e garantia.
          if (!p || p.afirmacoes.some((a) =>
            !/^[\p{L}\s.,;!?-]+$/u.test(a.texto) ||
            !a.texto.toLowerCase().match(/\p{L}+/gu)?.every((w) =>
              PALAVRAS.has(w)))) return fallback();
          if (!await cliente.verificar(pedido, p, controller.signal)) {
            return fallback();
          }
          controller.signal.throwIfAborted();
          const texto = p.afirmacoes.map((a) => a.texto).join("\n\n");
          if (!await cliente.moderar(texto, controller.signal)) {
            return fallback();
          }
          controller.signal.throwIfAborted();
          const final = AVISO + "\nResposta gerada por IA.\n\n" + texto +
            "\n\n" + FONTE;
          if (final.length > 2400) return fallback();
          evento("GERADA");
          return final;
        };
        const prazo = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort(); reject(Error("TIMEOUT"));
          }, timeout);
        });
        return await Promise.race([executar(), prazo]);
      } catch {
        return fallback();
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        ocupado = false;
      }
    },
  };
}
