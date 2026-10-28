import {motivoTextoBloqueado} from "../fundamentacao/contrato";
import type {MotivoTextoBloqueado} from "../fundamentacao/contrato";
import type {TrechoDocumental} from "../resposta-documental";

/**
 * Filtra copias ja validadas. Nunca corta frases ou mascara dados no texto.
 * Se uma fonte contiver risco, retira todos os seus chunks selecionados:
 * nao preserva uma regra enquanto esconde uma condicao do mesmo documento.
 * @param {TrechoDocumental[]} chunks Chunks com origem/estrutura validadas.
 * @return {object} Fontes restantes e apenas categorias/contagens para log.
 */
export function filtrarContextosIA(chunks: readonly TrechoDocumental[]) {
  const fontesBloqueadas = new Set<string>();
  const motivos = new Set<MotivoTextoBloqueado>();
  let sinalizados = 0;
  for (const chunk of chunks) {
    let sinalizado = false;
    // Campos que podem integrar o pedido ou o baseline da moderacao final.
    const campos = [chunk.titulo, chunk.secao, chunk.conteudo,
      chunk.categoria, chunk.tipoConteudo, chunk.id, chunk.documentoId];
    // Detecta tambem um rotulo/valor separados entre titulo e conteudo.
    for (const valor of [...campos, campos.join("\n")]) {
      const motivo = motivoTextoBloqueado(valor || "", "documento");
      if (motivo) {
        sinalizado = true;
        fontesBloqueadas.add(chunk.documentoId!);
        motivos.add(motivo);
      }
    }
    if (sinalizado) sinalizados++;
  }
  const permitidos = chunks.filter((c) =>
    !fontesBloqueadas.has(c.documentoId!));
  return {permitidos, sinalizados,
    descartados: chunks.length - permitidos.length,
    motivos: Object.freeze([...motivos].sort())};
}
