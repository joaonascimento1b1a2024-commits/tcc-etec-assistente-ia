import {createHash} from "node:crypto";
import {copiarDadosEstritos} from "../fundamentacao/contrato";
import type {AmbienteIA} from "./gateway";
import {usuarioIAAutorizado} from "./gateway";

export const POLITICA_GERAL_AUTOMATICA_PATH =
  "/etc/secrets/sylvinho-gemini-geral-automatico.json";
const sha = (s: string): string =>
  createHash("sha256").update(s).digest("hex");
const referencias = ["termosRef", "elegibilidadeRef", "privacidadeRef",
  "instituicaoRef", "contaProjetoPlanoRef", "orientacaoParticipantesRef",
  "controlesRef"];

/**
 * Autoriza uma modalidade/periodo, nunca uma lista de perguntas ou respostas.
 * Referencias atestam decisao externa; nao consultam o billing.
 * @param {AmbienteIA} env Configuracao privada, independente do corpo HTTP.
 * @param {string} uid Identidade Firebase ja verificada pelo handler.
 * @param {Function} lerRegistro Registro real de revisao da modalidade.
 * @param {number} agora Relogio injetavel.
 * @param {string} inicial Digest para revogacao durante a operacao.
 * @return {string|null} Digest vigente ou bloqueio, sem ler chave de API.
 */
export function autorizarGeralAutomatico(env: AmbienteIA, uid: string,
  lerRegistro: () => string, agora: number, inicial?: string): string | null {
  try {
    if (env.SYLVINHO_IA_GEMINI_GERAL_MODO !== "automatico" ||
      env.SYLVINHO_IA_PROVIDER !== "gemini" ||
      env.SYLVINHO_IA_GEMINI_MODALIDADE !== "demonstracao_publica" ||
      !usuarioIAAutorizado(env, uid) ||
      ["SYLVINHO_IA_ENABLED", "SYLVINHO_IA_GEMINI_GERAL_ENABLED",
        "SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA",
        "SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA",
        "SYLVINHO_IA_PRIVACIDADE_APROVADA", "SYLVINHO_IA_MENORES_APROVADA",
        "SYLVINHO_IA_INSTITUCIONAL_APROVADA"].some((k) => env[k] !== "true")) {
      return null;
    }
    const raw = lerRegistro();
    if (typeof raw !== "string" || Buffer.byteLength(raw) > 12000) return null;
    const digest = sha(raw);
    if (digest !== env.SYLVINHO_IA_GEMINI_GERAL_AUTOMATICO_SHA256 ||
      (inicial !== undefined && digest !== inicial)) return null;
    const r = copiarDadosEstritos(JSON.parse(raw), 12000) as
      Record<string, unknown>;
    const campos = ["versao", "escopo", "modelo", "plano", "allowlistSha256",
      "somenteAdultos", "dadosNaoPessoais", "semHistorico", "semDocumentos",
      "tratamentoDados", "emitidoEm", "expiraEm", "revogado", ...referencias];
    if (!r || Array.isArray(r) || Object.keys(r).length !== campos.length ||
      !campos.every((k) => Object.prototype.hasOwnProperty.call(r, k)) ||
      r.versao !== 1 || r.escopo !== "gemini_geral_automatico" ||
      r.modelo !== env.GEMINI_MODEL || typeof r.modelo !== "string" ||
      !/^[A-Za-z0-9._-]{1,100}$/u.test(r.modelo) ||
      !["free", "paid"].includes(r.plano as string) ||
      r.plano !== env.GEMINI_API_TIER || r.revogado !== false ||
      r.somenteAdultos !== true || r.dadosNaoPessoais !== true ||
      r.semHistorico !== true || r.semDocumentos !== true ||
      r.tratamentoDados !== (r.plano === "free" ? "melhoria_revisao_humana" :
        "sem_treinamento_monitoramento") ||
      !referencias.every((k) => typeof r[k] === "string" &&
        /^[A-Za-z0-9_-]{8,100}$/u.test(r[k] as string)) ||
      r.allowlistSha256 !== sha(env.SYLVINHO_IA_UID_ALLOWLIST!
        .split(",").map((u) => u.trim()).sort().join(",")) ||
      typeof r.emitidoEm !== "string" || typeof r.expiraEm !== "string") {
      return null;
    }
    const inicio = Date.parse(r.emitidoEm);
    const fim = Date.parse(r.expiraEm);
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || inicio > agora ||
      fim <= agora || fim <= inicio || fim - inicio > 86400000) return null;
    return digest;
  } catch {
    return null;
  }
}
