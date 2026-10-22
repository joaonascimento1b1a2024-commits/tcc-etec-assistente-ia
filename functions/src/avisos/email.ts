/** Documento consumido pela extensão oficial firebase/firestore-send-email. */
export interface MensagemEmail {
  to: string[];
  message: {subject: string; text: string; html: string};
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
 * @param {string} siteUrl Endereço público da aplicação.
 * @return {MensagemEmail} Mensagem individual; remetente definido na extensão.
 */
export function montarEmailAviso(
  aviso: ConteudoAviso, email: string, siteUrl: string,
): MensagemEmail {
  const site = new URL(siteUrl);
  if (site.protocol !== "https:") {
    throw new Error("AVISOS_EMAIL_CONFIG_INVALIDA");
  }
  const mural = new URL("/Logado/Avisos/avisos.html", site).href;
  const categoria = categorias[aviso.categoria] || "Geral";
  const rodape = "Você recebeu este comunicado porque possui uma conta " +
    "no Sylvinho. Os novos avisos são enviados a alunos e administradores.";
  return {
    to: [email],
    message: {
      subject: "[Sylvinho] Novo aviso: " +
        aviso.titulo.replace(/[\r\n]+/g, " "),
      text: `${aviso.titulo}\nCategoria: ${categoria}\n\n${aviso.descricao}` +
        `\n\nVer avisos: ${mural}\n\n${rodape}`,
      html: "<!doctype html><html lang=\"pt-BR\"><body>" +
        "<h1>Novo aviso no Sylvinho</h1>" +
        `<h2>${escapar(aviso.titulo)}</h2><p>Categoria: ${categoria}</p>` +
        `<p>${escapar(aviso.descricao).replace(/\r?\n/g, "<br>")}</p>` +
        `<p><a href="${escapar(mural)}">Ver avisos no site</a></p>` +
        `<hr><p>${rodape}</p></body></html>`,
    },
  };
}
