// GATEWAY DE GERAÇÃO do fluxo documental (reserva do modo híbrido).
// Recebe a pergunta e os trechos de documento achados pela busca (RAG) e decide
// se pode chamar uma IA externa. Toda decisão é fail-closed: na dúvida, NÃO
// chama a IA e devolve a resposta documental montada localmente (baseline), que
// só copia trechos oficiais.
// Etapas: travas de configuração e aprovação -> preparação das evidências ->
// moderação da entrada -> proposta da IA -> validação contra as evidências ->
// revisão por um segundo pedido -> moderação da saída -> aviso de que a
// resposta foi gerada por IA.
import {classificarEscopo, FORA_ESCOPO,
  ESCLARECER_ESCOPO, SOCIAL_ESCOPO} from "../escopo";
import {orientarSemEvidencia} from "../encaminhamento";
import {identificarProcedimento} from "../intencao";
import {emitirDiagnostico} from "../diagnostico";
import type {RegistrarDiagnostico} from "../diagnostico";
import {prepararEvidencias} from "../fundamentacao/gateway";
import {copiarDadosEstritos, textoSuspeito} from "../fundamentacao/contrato";
import type {
  RespostaDocumental, TrechoDocumental,
} from "../resposta-documental";
import {FONTES_ORIGINAIS} from "../../rag/recuperacao";
import {validarConversa, RESPOSTA_INDISPONIVEL} from "./conversa";
import {avaliarRevisao} from "./revisao";
import {filtrarContextosIA} from "./contexto";
import {gerarRespostaDocumental} from "../resposta-documental";
import type {FalhaRevisao} from "./revisao";
import {avaliarGeracao} from "./contrato";
import type {
  PedidoGeracao, ProvedorGeracao, MotivoProposta,
} from "./contrato";
import {criarClienteOpenAI} from "./openai";
import {criarClienteGemini} from "./gemini";
import {
  criarClienteOpenRouter, ErroOpenRouter, modeloOpenRouterValido,
} from "./openrouter";
import type {CodigoOpenRouter} from "./openrouter";

// Variáveis de ambiente lidas como texto, só do servidor.
export type AmbienteIA = Readonly<Record<string, string | undefined>>;
// Identidade de conta ou acesso publico definido pela rota, nunca pelo body.
export type ContextoGeracao =
  {readonly uid: string; readonly publico?: never} |
  {readonly publico: "visitante"; readonly uid?: never};
// Eventos de telemetria (só códigos, nunca conteúdo) e todos os motivos
// possíveis de cair na resposta de reserva.
export type EventoIA = "GERADA" | "FALLBACK" | "SEGURANCA";
export type MotivoFallback = CodigoOpenRouter | MotivoProposta | FalhaRevisao |
  "UID_NAO_AUTORIZADO" |
  "VISITANTE_IA_DESATIVADA" | "VISITANTE_PROVEDOR_INVALIDO" |
  "IA_DESATIVADA" | "PROVEDOR_INVALIDO" | "APROVACAO_PENDENTE" |
  "MODALIDADE_PENDENTE" | "RETENCAO_BLOQUEADA" | "DADOS_BLOQUEADOS" |
  "DADOS_BLOQUEADOS_PERGUNTA" | "DADOS_BLOQUEADOS_CONTEXTO" |
  "EVIDENCIAS_INSUFICIENTES" | "CONFIGURACAO_INVALIDA" |
  "FONTES_INVALIDAS" | "OCUPADO" | "LIMITE_LOCAL" | "ENTRADA_INSEGURA" |
  "PROPOSTA_INVALIDA" | "REVISAO_REPROVADA" | "SAIDA_INSEGURA" |
  "ESCLARECIMENTO_DESNECESSARIO" |
  "SAIDA_EXCESSIVA" | "GERACAO_TIMEOUT" | "GERACAO_INDISPONIVEL";
export interface OpcoesGerador {
  lerAmbiente?: () => AmbienteIA;
  criarCliente?: (modelo: string, lerChave: () => string) => ProvedorGeracao;
  criarClienteGemini?:
    (modelo: string, lerChave: () => string) => ProvedorGeracao;
  criarClienteOpenRouter?:
    (modelo: string, lerChave: () => string) => ProvedorGeracao;
  registrarDiagnostico?: RegistrarDiagnostico;
  registrarEvento?: (codigo: EventoIA, motivo?: MotivoFallback) => void;
  agora?: () => number;
}

// Lista de contas autorizadas a usar a IA no chat com login
// (SYLVINHO_IA_UID_ALLOWLIST).
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

// Retenção de dados no provedor: só libera se o operador declarar retenção zero
// (ZDR) aprovada. Sem isso, nada é enviado.
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

// Cria a função gerarResposta(pergunta, trechos, contexto). Guarda estado por
// instância: uma geração por vez (ocupado) e limite de chamadas por minuto.
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
    pergunta: unknown, chunks: unknown, contexto?: ContextoGeracao,
  ): Promise<string> => {
    // Saudação, fora do assunto ou pedido vago: resposta local, sem IA.
    const escopo = classificarEscopo(pergunta);
    if (escopo.resposta) return escopo.resposta;
    let baseline: RespostaDocumental | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    let adquiriu = false;
    let alternativa: string | undefined;
    // Resposta de reserva: o texto alternativo definido no caminho ou a
    // resposta documental local. Registra o motivo.
    const fallback = (
      motivo: MotivoFallback = "GERACAO_INDISPONIVEL",
    ): string => {
      evento("FALLBACK", motivo);
      if (!baseline) throw new Error("GERACAO_ENTRADA_INVALIDA");
      return alternativa ?? baseline.resposta;
    };
    try {
      // Monta a resposta documental local (baseline) e verifica dados pessoais
      // na pergunta e nos trechos.
      const preparada = prepararEvidencias(pergunta, chunks);
      if (!preparada.ok) throw new Error("GERACAO_ENTRADA_INVALIDA");
      baseline = preparada.baseline;
      const env = lerAmbiente();
      // Visitante só usa IA se a liberação pública estiver ligada e o provedor
      // for o OpenRouter; conta logada precisa estar na lista de autorizados.
      if (contexto?.publico === "visitante" && contexto.uid === undefined) {
        if (env.SYLVINHO_IA_VISITANTE_ENABLED !== "true") {
          return fallback("VISITANTE_IA_DESATIVADA");
        }
        // A liberacao publica nao migra nem ativa os provedores legados.
        if (env.SYLVINHO_IA_PROVIDER !== "openrouter") {
          return fallback("VISITANTE_PROVEDOR_INVALIDO");
        }
      } else if (!usuarioIAAutorizado(env, contexto?.uid)) {
        return fallback("UID_NAO_AUTORIZADO");
      }
      // Travas de governança: IA ligada, provedor conhecido e aprovações
      // institucional, de privacidade e de uso por menores marcadas como true.
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
      // OpenRouter usa o modo conversacional (respostas mais naturais); os
      // outros, o modo de afirmações com citação.
      const conversacional = provedor === "openrouter";
      const contextoBloqueado = preparada.origemBloqueio === "contexto";
      if (preparada.origemBloqueio === "pergunta") {
        if (conversacional) {
          alternativa = "Para ajudar, reformule sua pergunta sobre o " +
            "procedimento, sem nomes, numeros de documentos ou outros " +
            "dados pessoais.";
        }
        return fallback("DADOS_BLOQUEADOS_PERGUNTA");
      }
      if (contextoBloqueado && !conversacional) {
        return fallback("DADOS_BLOQUEADOS_CONTEXTO");
      }
      if (!conversacional && (baseline.status !== "trechos_encontrados" ||
        !baseline.citacoes.length || baseline.citacoes.some((c) =>
        c.fonte.natureza !== "documental"))) {
        return fallback("EVIDENCIAS_INSUFICIENTES");
      }
      // Modelo, tempo máximo e limite por minuto também são validados; valor
      // estranho bloqueia.
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
      // Copia os trechos com limite de tamanho e confere que todos vêm de
      // documentos oficiais ativos e sem IDs repetidos.
      let cs = copiarDadosEstritos(chunks, 24000) as TrechoDocumental[];
      if (cs.some((c) => c.ativo !== true ||
        !FONTES_ORIGINAIS.includes(c.documentoId || "")) ||
        new Set(cs.map((c) => c.id)).size !== cs.length) {
        return fallback("FONTES_INVALIDAS");
      }
      let fontesParciais = false;
      if (conversacional) {
        // Filtro extra de privacidade dos trechos (contexto.ts); trechos
        // descartados mudam o aviso da resposta.
        const filtro = filtrarContextosIA(cs);
        emitirDiagnostico(opcoes.registrarDiagnostico, {
          etapa: "CONTEXTO_FILTRADO", avaliados: cs.length,
          permitidos: filtro.permitidos.length,
          sinalizados: filtro.sinalizados,
          descartados: filtro.descartados, motivos: filtro.motivos,
        });
        cs = filtro.permitidos;
        fontesParciais = filtro.descartados > 0;
        // Recria citacoes/fontes exclusivamente dos documentos permitidos.
        baseline = gerarRespostaDocumental(pergunta as string, cs);
        if (fontesParciais) {
          evento("SEGURANCA", "DADOS_BLOQUEADOS_CONTEXTO");
          alternativa = "Nao consegui confirmar essa informacao nos " +
            "documentos disponiveis. Consulte a secretaria academica " +
            "para confirmar.";
        }
      }
      const bloquearContexto = fontesParciais && cs.length === 0;
      const temEvidencias = baseline.status === "trechos_encontrados" &&
        baseline.citacoes.length > 0 && baseline.citacoes.every((c) =>
        c.fonte.natureza === "documental");
      const usarEvidencias = temEvidencias;
      const citacoes = usarEvidencias ? baseline.citacoes : [];
      // Cada evidência (E1, E2...) precisa ser um pedaço literal de um trecho
      // enviado; senão, o vínculo é inválido.
      const evidencias = citacoes.map((c, i) => {
        const contexto = cs.findIndex((d) => d.id === c.fonte.chunkId &&
          d.documentoId === c.fonte.documentoId);
        if (contexto < 0 || !cs[contexto].conteudo?.includes(c.texto)) {
          throw new Error("VINCULO_INVALIDO");
        }
        return Object.freeze({id: `E${i + 1}`, texto: c.texto, contexto});
      });
      const situacao: PedidoGeracao["situacao"] = bloquearContexto ?
        "contexto_indisponivel" : fontesParciais ? "fontes_parciais" :
          !usarEvidencias ? "sem_evidencias" : undefined;
      const procedimento = identificarProcedimento(pergunta);
      // Pedido congelado enviado ao provedor: pergunta, procedimento
      // reconhecido, evidências e contextos.
      const pedido: PedidoGeracao = Object.freeze({
        pergunta: pergunta as string,
        ...(procedimento ? {procedimento} : {}),
        evidencias: Object.freeze(evidencias),
        contextos: Object.freeze(usarEvidencias ? cs.map((c) =>
          conversacional ? [c.titulo, c.secao, c.conteudo].filter(Boolean)
            .join("\n") : c.conteudo || "") : []),
        ...(situacao ? {situacao} : {}),
      });
      if (conversacional) alternativa ??= RESPOSTA_INDISPONIVEL;
      // Janela de 1 minuto para o limite local de chamadas.
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
      const resumo = {
        contextos: pedido.contextos.length,
        evidencias: pedido.evidencias.length,
        uso: usarEvidencias ? "DOCUMENTAL" as const : bloquearContexto ?
          "CONTEXTO_BLOQUEADO" as const : "SEM_EVIDENCIAS" as const,
      };
      const registrar = opcoes.registrarDiagnostico;
      emitirDiagnostico(registrar, {etapa: "CONTEXTO_PREPARADO", ...resumo});
      // Operação principal, que corre contra o prazo total (deadline).
      const operacao = async (): Promise<string> => {
        const entrada = [pedido.pergunta, ...pedido.contextos].join("\n\n");
        // Moderação da entrada: texto inseguro não segue.
        const entradaSegura = await cliente.moderar(
          entrada, controller.signal,
        );
        controller.signal.throwIfAborted();
        if (!entradaSegura) {
          evento("SEGURANCA"); return fallback("ENTRADA_INSEGURA");
        }
        if (conversacional && cliente.conversar &&
          (cliente.revisarConversa || cliente.verificarConversa)) {
          const recebida = await cliente.conversar(pedido, controller.signal);
          controller.signal.throwIfAborted();
          emitirDiagnostico(registrar, {etapa: "PROPOSTA_RECEBIDA", ...resumo});
          // Valida o JSON devolvido pela IA: formato, tipo e citações que
          // existem nas evidências.
          const validacao = validarConversa(recebida, evidencias);
          if (!validacao.resposta) return fallback(validacao.motivo);
          let resposta = validacao.resposta;
          if (cliente.revisarConversa) {
            const revisao = avaliarRevisao(await cliente.revisarConversa(
              pedido, resposta, controller.signal,
            ), resposta, evidencias);
            controller.signal.throwIfAborted();
            emitirDiagnostico(registrar, {
              etapa: !revisao.resposta ? "REVISAO_REPROVADA" :
                revisao.decisao === "corrigir" ? "REVISAO_CORRIGIDA" :
                  "REVISAO_APROVADA",
              ...resumo, tipo: revisao.resposta?.tipo ?? resposta.tipo,
              motivoRevisao: revisao.motivo,
            });
            if (!revisao.resposta) return fallback(revisao.codigo);
            resposta = revisao.resposta;
          } else {
            const aprovada = await cliente.verificarConversa!(
              pedido, resposta, controller.signal,
            );
            controller.signal.throwIfAborted();
            emitirDiagnostico(registrar, {etapa: aprovada ?
              "REVISAO_APROVADA" : "REVISAO_REPROVADA",
            ...resumo, tipo: resposta.tipo});
            if (!aprovada) return fallback("REVISAO_REPROVADA");
          }
          // Mensagens livres nao podem transportar conhecimento geral,
          // mesmo se rotuladas como conversa/esclarecimento/sem_base.
          // Tipos não documentais nunca levam texto livre da IA: viram
          // respostas fixas do sistema.
          if (resposta.tipo !== "documental") {
            if (resposta.tipo === "esclarecimento" && procedimento) {
              // O assunto ja esta explicito na pergunta ou foi resolvido
              // pelo contexto autenticado. Nao reinicia o mesmo pedido.
              alternativa = orientarSemEvidencia(pergunta as string);
              return fallback("ESCLARECIMENTO_DESNECESSARIO");
            }
            return resposta.tipo === "fora_escopo" ? FORA_ESCOPO :
              resposta.tipo === "esclarecimento" ? ESCLARECER_ESCOPO :
                resposta.tipo === "conversa" ? SOCIAL_ESCOPO :
                  orientarSemEvidencia(pergunta as string);
          }
          // Resposta final: aviso de IA + texto aprovado + resposta documental
          // com as fontes.
          const corpo = resposta.afirmacoes.map((a) => a.texto).join("\n\n") +
            "\n\n" + baseline!.resposta;
          const aviso = resposta.tipo === "documental" ?
            fontesParciais ? "Resposta gerada por IA; parte das fontes " +
              "não pôde ser utilizada. Confira as fontes oficiais." :
              "Resposta gerada por IA; confira as fontes oficiais." :
            "Resposta gerada por IA.";
          const final = aviso + "\n\n" + corpo;
          if (final.length > 2400) return fallback("SAIDA_EXCESSIVA");
          if (!await cliente.moderar(final, controller.signal)) {
            evento("SEGURANCA"); return fallback("SAIDA_INSEGURA");
          }
          controller.signal.throwIfAborted();
          evento("GERADA");
          return final;
        }
        // Modo de afirmações (OpenAI/Gemini): proposta -> validação ->
        // verificação por um segundo pedido.
        if (!usarEvidencias) return fallback("EVIDENCIAS_INSUFICIENTES");
        const recebida = await cliente.propor(pedido, controller.signal);
        controller.signal.throwIfAborted();
        emitirDiagnostico(registrar, {etapa: "PROPOSTA_RECEBIDA", ...resumo});
        const avaliacao = avaliarGeracao(recebida, evidencias);
        if (!avaliacao.proposta) return fallback(avaliacao.motivo);
        const proposta = avaliacao.proposta;
        const aprovada = await cliente.verificar(
          pedido, proposta, controller.signal,
        );
        controller.signal.throwIfAborted();
        emitirDiagnostico(registrar, {etapa: aprovada ?
          "REVISAO_APROVADA" : "REVISAO_REPROVADA",
        ...resumo, tipo: "documental"});
        if (!aprovada) return fallback("REVISAO_REPROVADA");
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
      // Prazo total: ao estourar, cancela os pedidos em andamento
      // (AbortController) e usa a reserva.
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
    // Libera a vaga de geração mesmo em caso de erro.
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (adquiriu) ocupado = false;
    }
  };
}
