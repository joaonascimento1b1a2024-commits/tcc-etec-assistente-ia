export interface MensagemEmail {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export interface ConteudoAviso {
  titulo: string;
  descricao: string;
  categoria: string;
}

const categorias: Record<string, string> = {
  geral: "Geral", matricula: "Matrícula", provas: "Provas",
  feriado: "Feriado", evento: "Evento",
};

const escapar = (texto: string): string => texto.replace(/[&<>"']/g,
  (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[caractere] as string));

/**
 * Monta versões HTML e texto sem interpretar o conteúdo publicado.
 * @param {ConteudoAviso} aviso Conteúdo original da publicação.
 * @param {string} email Endereço obtido do Authentication.
 * @param {string} remetente Remetente autorizado no Resend.
 * @param {string} siteUrl Endereço público da aplicação.
 * @return {MensagemEmail} Mensagem individual.
 */
export function montarEmailAviso(
  aviso: ConteudoAviso, email: string, remetente: string, siteUrl: string,
): MensagemEmail {
  const site = new URL(siteUrl);
  if (site.protocol !== "https:" || !remetente.trim() ||
      /[\r\n]/.test(remetente)) {
    throw new Error("AVISOS_EMAIL_CONFIG_INVALIDA");
  }
  const mural = new URL("/Logado/Avisos/avisos.html", site).href;
  // A Home direciona as configurações conforme o cargo da conta.
  const configuracoes = new URL("/Logado/Home/home.html", site).href;
  const categoria = categorias[aviso.categoria] || "Geral";
  const rodape = "Você recebeu este e-mail porque ativou as notificações " +
    "de avisos. Para desativar, entre no site e acesse Configurações > " +
    "Notificações > Desativadas.";
  return {
    from: remetente.trim(),
    to: [email],
    subject: `[Sylvinho] Novo aviso: ${aviso.titulo.replace(/[\r\n]+/g, " ")}`,
    text: `${aviso.titulo}\nCategoria: ${categoria}\n\n${aviso.descricao}` +
      `\n\nVer avisos: ${mural}\n\n${rodape}\n${configuracoes}`,
    html: "<!doctype html><html lang=\"pt-BR\"><body>" +
      "<h1>Novo aviso no Sylvinho</h1>" +
      `<h2>${escapar(aviso.titulo)}</h2><p>Categoria: ${categoria}</p>` +
      `<p>${escapar(aviso.descricao).replace(/\r?\n/g, "<br>")}</p>` +
      `<p><a href="${escapar(mural)}">Ver avisos no site</a></p>` +
      `<hr><p>${rodape}</p><a href="${escapar(configuracoes)}">` +
      "Acessar minha conta</a></body></html>",
  };
}

/**
 * Cliente HTTP lazy: chave somente no servidor e falhas sem dados pessoais.
 * @param {Function} chave Lê o secret apenas durante o envio.
 * @param {Function} requisitar Fetch real ou simulado nos testes.
 * @param {Function} aguardar Espaçamento entre chamadas ao provedor.
 * @return {Function} Envio idempotente com timeout.
 */
export function criarEnvioResend(
  chave: () => string,
  requisitar: typeof fetch = fetch,
  aguardar = () => new Promise<void>((resolve) => setTimeout(resolve, 600)),
): (mensagem: MensagemEmail, id: string) => Promise<string> {
  return async (mensagem, id) => {
    // Emuladores nunca enviam e-mails reais, mesmo com credenciais locais.
    if (process.env.FUNCTIONS_EMULATOR === "true" ||
        process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error("AVISOS_EMAIL_EMULADOR");
    }
    const token = chave().trim();
    if (!token) throw new Error("RESEND_API_KEY_AUSENTE");
    await aguardar();
    let resposta;
    try {
      resposta = await requisitar("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `aviso/${id}`,
        },
        body: JSON.stringify(mensagem),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error("RESEND_INDISPONIVEL");
    }
    if (!resposta.ok) throw new Error(`RESEND_HTTP_${resposta.status}`);
    try {
      const dados = await resposta.json() as {id?: unknown};
      if (typeof dados.id === "string" && dados.id) return dados.id;
    } catch {
      // Não registra respostas do provedor, endereços ou credenciais.
    }
    throw new Error("RESEND_RESPOSTA_INVALIDA");
  };
}
