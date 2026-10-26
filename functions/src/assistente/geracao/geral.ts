import {autorizarGeralAutomatico, POLITICA_GERAL_AUTOMATICA_PATH} from
  "./politica-geral-automatica";
import {requerEsclarecimento} from "../pergunta-livre/interpretacao";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {copiarDadosEstritos, textoSuspeito} from "../fundamentacao/contrato";
import {normalizarTexto} from "../../rag/recuperacao";
import {usuarioIAAutorizado} from "./gateway";
import type {AmbienteIA} from "./gateway";
import {criarClienteGemini} from "./gemini";
import type {TransporteGemini, DiagnosticoGemini} from "./gemini";
import {PROMPT_MODERACAO, SCHEMA_SEGURANCA,
  montarCorpoGemini} from "./prompts-gemini";
import {PROMPT_GERAL, SCHEMA_GERAL} from "./prompts-geral";

export const GERAL_INDISPONIVEL =
  "Não foi possível gerar uma resposta geral neste momento. " +
  "Não houve repetição automática. Tente mais tarde.";
export const GERAL_MODALIDADE_BLOQUEADA =
  "O modo geral automático ainda não está autorizado neste ambiente.";
export const GERAL_CONTEUDO_BLOQUEADO =
  "Não posso processar esta pergunta no modo geral. " +
  "Não inclua dados pessoais, sensíveis ou confidenciais.";
const sha = (s: string): string =>
  createHash("sha256").update(s).digest("hex");
const exato = (v: unknown, ks: string[]): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === ks.length && ks.every((k) =>
    Object.prototype.hasOwnProperty.call(v, k));

/**
 * Integridade local do transporte; nao e aprovacao individual de perguntas.
 * @param {unknown} valor Corpo proprio, copiado sem getters/toJSON.
 * @return {string} Digest canonico em memoria, nunca registrado.
 */
function hashEnvioRevisado(valor: unknown): string {
  const ordenar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (!v || typeof v !== "object") return v;
    return Object.fromEntries(Object.keys(v).sort().map((k) =>
      [k, ordenar((v as Record<string, unknown>)[k])]));
  };
  return sha(JSON.stringify(ordenar(copiarDadosEstritos(valor, 24000))));
}

/**
 * Roteamento conservador local; nao e prova semantica nem anonimização.
 * @param {string} pergunta Texto atual, sem historico.
 * @return {boolean} Institucional/ambiguo vai ao caminho RAG existente.
 */
export function exigeEvidenciaEscolar(pergunta: string): boolean {
  const termos = "etec|escolas?|colegios?|instituicao|secretaria|" +
    "escolar|" +
    "academica|matricula|rematricula|declaracao|frequencia|" +
    "presenca|aprovacao|" +
    "reprovacao|notas?|media|boletim|regimento|artigos?|documentos?|" +
    "certificados?|atestados?|professores?|alunos?|estudantes?|cursos?|" +
    "inscricao|vestibulinho|calendario|horarios?|prazos?|transferencia|" +
    "trancamento|diretor|direcao|sylvio|sylvinho|faltas?|faltar|" +
    "provas?|recuperacao|aulas?|diplomas?|estagios?|dispensa|" +
    "uniformes?|conselho|segunda via|aproveitamento";
  return requerEsclarecimento(pergunta) ||
    new RegExp("\\b(" + termos + ")\\b", "u")
      .test(normalizarTexto(pergunta));
}
const risco = (s: string): boolean => {
  const termos = "saude|medic[oa]|diagnostico|tratamento|sintomas?|suicidio|" +
    "autolesao|sexo|sexual|armas?|violencia|crime|investimento|juridic[oa]|" +
    "advogad[oa]|senha|endereco|telefone|contato|cpf|rg|paciente";
  return textoSuspeito(s) || new RegExp("\\b(" + termos + ")\\b", "u")
    .test(normalizarTexto(s)) || /https?:\/\/|[<>]/iu.test(s);
};

/**
 * Corpos sem chave; usados para integridade do transporte, nao como catalogo.
 * @param {string} pergunta Texto atual aparado pelo endpoint.
 * @return {object[]} Duas chamadas; a saida nao e reenviada ao provedor.
 */
export function pacotesPerguntaGeral(pergunta: string): object[] {
  return [montarCorpoGemini(PROMPT_MODERACAO, {texto: pergunta},
    SCHEMA_SEGURANCA),
  montarCorpoGemini(PROMPT_GERAL, {pergunta}, SCHEMA_GERAL)];
}

interface OpcoesGeral {
  lerAmbiente?: () => AmbienteIA;
  lerPoliticaAutomatica?: () => string;
  transporte?: TransporteGemini;
  agora?: () => number;
  registrarEvento?:
    (evento: "GERADA" | "BLOQUEADA" | "FALHA" | "LIMITE") => void;
  diagnosticar?: (evento: DiagnosticoGemini & {
    readonly requestId: string; readonly etapa: string;
  }) => void;
}

/**
 * Caminho geral automatico sem RAG, com politica de modalidade especifica.
 * Modo automatico exige revisao da modalidade, nao de cada pergunta.
 * @param {OpcoesGeral} opcoes Dependencias injetaveis.
 * @return {Function} Resposta geral ou null para o caminho documental.
 */
export function criarGeradorGeral(opcoes: OpcoesGeral = {}) {
  const ambiente: () => AmbienteIA = opcoes.lerAmbiente ?? (() => ({}));
  const agora = opcoes.agora ?? Date.now;
  const lerAutomatico = opcoes.lerPoliticaAutomatica ??
    (() => readFileSync(POLITICA_GERAL_AUTOMATICA_PATH, "utf8"));
  let ocupado = false;
  let janela = agora();
  let usadas = 0;
  const evento = (e: Parameters<NonNullable<OpcoesGeral[
    "registrarEvento"]>>[0]) => {
    try {
      opcoes.registrarEvento?.(e);
    } catch {/* Telemetria nao interfere no fluxo. */}
  };
  const gate = (env: AmbienteIA, uid: string): boolean =>
    env.SYLVINHO_IA_PROVIDER === "gemini" &&
    env.SYLVINHO_IA_GEMINI_MODALIDADE === "demonstracao_publica" &&
    usuarioIAAutorizado(env, uid) && ["SYLVINHO_IA_ENABLED",
      "SYLVINHO_IA_GEMINI_GERAL_ENABLED", "SYLVINHO_IA_INSTITUCIONAL_APROVADA",
      "SYLVINHO_IA_PRIVACIDADE_APROVADA", "SYLVINHO_IA_MENORES_APROVADA",
      "SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA",
      "SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA"]
      .every((k) => env[k] === "true");
  const autorizado = (uid: string, modelo: string,
    inicial?: string): string | null => {
    const env = ambiente();
    if (env.GEMINI_MODEL !== modelo) return null;
    return autorizarGeralAutomatico(env, uid, lerAutomatico, agora(), inicial);
  };
  return async (pergunta: string,
    contexto: {readonly uid: string; readonly requestId?: string}
  ): Promise<string | null> => {
    let tomou = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const diagnostico = (etapa: string, detalhe: DiagnosticoGemini) => {
      // Nunca UID, messageId, pergunta, resposta ou erro bruto.
      if (!contexto.requestId ||
        !/^[a-f0-9-]{36}$/u.test(contexto.requestId)) return;
      try {
        opcoes.diagnosticar?.({...detalhe,
          requestId: contexto.requestId, etapa});
      } catch {/* Telemetria nao altera o resultado. */}
    };
    try {
      if (typeof pergunta !== "string" || !pergunta.trim() ||
        pergunta.length > 1000) return null;
      if (exigeEvidenciaEscolar(pergunta)) {
        diagnostico("ROTEAMENTO", {codigo: "ESCOLAR_RAG"}); return null;
      }
      const env = ambiente();
      if (!gate(env, contexto.uid)) {
        diagnostico("ATIVACAO", {codigo: "GATES_OU_USUARIO_BLOQUEADOS"});
        return null;
      }
      // Heuristicas nao anonimizam; escopo e mitigacoes exigem revisao.
      const pessoalDireto =
        /\b(me chamo|eu sou|i am|i live|nasci em|moro em)\b/u;
      if (risco(pergunta) ||
        pessoalDireto.test(normalizarTexto(pergunta))) {
        diagnostico("ENTRADA", {codigo: "CONTEUDO_BLOQUEADO"});
        evento("BLOQUEADA");
        return GERAL_CONTEUDO_BLOQUEADO;
      }
      const modelo = env.GEMINI_MODEL || "";
      const timeout = Number(env.SYLVINHO_IA_TIMEOUT_MS ?? 20000);
      const limite = Number(env.SYLVINHO_IA_MAX_POR_MINUTO ?? 5);
      if (!/^[A-Za-z0-9._-]{1,100}$/u.test(modelo) ||
        !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30000 ||
        !Number.isSafeInteger(limite) || limite < 1 || limite > 20) {
        diagnostico("CONFIGURACAO", {codigo: "MODELO_TIMEOUT_OU_LIMITE"});
        return GERAL_INDISPONIVEL;
      }
      const registro = autorizado(contexto.uid, modelo);
      if (!registro) {
        diagnostico("ATIVACAO", {codigo: "POLITICA_AUTOMATICA_INVALIDA"});
        evento("BLOQUEADA");
        return GERAL_MODALIDADE_BLOQUEADA;
      }
      if (agora() - janela >= 60000) {
        janela = agora(); usadas = 0;
      }
      if (ocupado || usadas >= limite) {
        diagnostico("LIMITE", {
          codigo: ocupado ? "CONCORRENCIA" : "TAXA_LOCAL"});
        evento("LIMITE"); return GERAL_INDISPONIVEL;
      }
      ocupado = true; tomou = true; usadas++;
      const pacotes = pacotesPerguntaGeral(pergunta).map(hashEnvioRevisado);
      let indice = 0;
      let etapa = "MODERACAO";
      const vigente = () =>
        !!autorizado(contexto.uid, modelo, registro);
      const cliente = criarClienteGemini(modelo,
        () => ambiente().GEMINI_API_KEY || "",
        opcoes.transporte ?? globalThis.fetch,
        (corpo) => !controller.signal.aborted && vigente() &&
          hashEnvioRevisado(corpo) === pacotes[indice++],
        (detalhe) => diagnostico(etapa, detalhe));
      const gerar = async (): Promise<string> => {
        if (!await cliente.moderar(pergunta, controller.signal)) {
          controller.signal.throwIfAborted();
          diagnostico("MODERACAO", {codigo: "CONTEUDO_BLOQUEADO"});
          evento("BLOQUEADA"); return GERAL_INDISPONIVEL;
        }
        controller.signal.throwIfAborted();
        etapa = "GERACAO";
        const v = copiarDadosEstritos(
          await cliente.responderGeral(pergunta, controller.signal), 6000);
        controller.signal.throwIfAborted();
        if (!vigente() || !exato(v, ["geral", "segura", "resposta"]) ||
          v.geral !== true || v.segura !== true ||
          typeof v.resposta !== "string" || !v.resposta.trim() ||
          v.resposta.length > 1600 || risco(v.resposta) ||
          exigeEvidenciaEscolar(v.resposta)) {
          diagnostico("VALIDACAO", {codigo: "SAIDA_OU_POLITICA_RECUSADA"});
          evento("BLOQUEADA"); return GERAL_INDISPONIVEL;
        }
        evento("GERADA");
        diagnostico("GERACAO", {codigo: "GERADA"});
        return "Resposta geral gerada por IA. " +
          "Não é orientação oficial da ETEC.\n\n" + v.resposta;
      };
      const prazo = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(); reject(Error("PRAZO"));
        }, timeout);
      });
      return await Promise.race([gerar(), prazo]);
    } catch {
      diagnostico("FINAL", {codigo: controller.signal.aborted ?
        "TIMEOUT" : "FALHA"});
      evento("FALHA"); return GERAL_INDISPONIVEL;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (tomou) ocupado = false;
    }
  };
}
