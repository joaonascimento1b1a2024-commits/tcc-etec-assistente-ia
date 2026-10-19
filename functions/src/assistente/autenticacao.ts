import type {Request} from "express";

export interface VerificadorIdToken {
  verifyIdToken(token: string): Promise<{uid: string}>;
}

/** Erro publico sem detalhes internos do SDK. */
export class ErroAutenticacao extends Error {}

/**
 * Valida cabecalhos e delega as claims ao Firebase Admin.
 * @param {Request} req Acesso aos cabecalhos, nunca ao corpo.
 * @param {VerificadorIdToken} auth Verificador injetado.
 * @return {Promise<{uid: string}>} Identidade verificada.
 */
export async function verificarAutenticacao(
  req: Pick<Request, "get">,
  auth: VerificadorIdToken,
): Promise<{uid: string}> {
  const header = req.get("Authorization");
  if (!header) {
    throw new ErroAutenticacao("Autenticação obrigatória.");
  }
  const parts = header.trim().split(/\s+/);
  const [scheme, token] = parts;
  if (parts.length !== 2 || scheme !== "Bearer" || !token) {
    throw new ErroAutenticacao("Formato de autenticação inválido.");
  }
  try {
    return await auth.verifyIdToken(token);
  } catch {
    throw new ErroAutenticacao("Token de autenticação inválido.");
  }
}
