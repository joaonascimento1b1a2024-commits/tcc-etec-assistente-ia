// INTEIRAMENTE SINTETICO. Nao representa normas da ETEC e nunca vai ao Firestore.
const fonte = 'doc-10d342eed4d6a46a5c6638a29179d80b';
const doc = (id, titulo, conteudo, tipoConteudo = 'procedimento', extra = {}) => ({
  id, documentoId: fonte, titulo, secao: titulo, conteudo, tipoConteudo,
  categoria: 'Secretaria experimental', ativo: true, paginaInicial: 1,
  paginaFinal: 1, ...extra,
});
export const corpus = [
  doc('matricula', 'B1 Inicial - Matrícula inicial', 'A matrícula inicial exige apresentar RG na secretaria experimental.'),
  doc('renovacao', 'B4 Renovação - Rematrícula', 'A rematrícula exige confirmar interesse no formulário experimental.'),
  doc('frequencia', 'Frequência', 'A frequência mínima é de 80%, salvo exceção prevista no regulamento experimental.', 'normativo'),
  doc('declaracao', 'Declarações', 'A declaração escolar é solicitada na secretaria experimental.'),
  doc('calendario', 'Calendário acadêmico', 'O calendário acadêmico experimental será divulgado após aprovação.', 'normativo'),
  doc('atendimento', 'Atendimento da secretaria', 'O horário de atendimento da secretaria experimental é das 10h às 12h.'),
  doc('transferencia', 'Transferência', 'A transferência experimental exige RG e declaração de matrícula.'),
  doc('modelo', 'DOC 04 - Declaração', 'DECLARAÇÃO\nA declaração experimental comprova a participação.', 'modelo'),
  doc('interno', 'Organização interna', 'A secretaria arquiva as pastas depois da matrícula inicial.', 'interno'),
  doc('aviso', 'Aviso experimental', 'A frequência mínima experimental foi discutida pela equipe.', 'aviso'),
  doc('inativo', 'B1 Inicial - Matrícula inicial', 'A matrícula experimental exige passaporte.', 'procedimento', {ativo: false}),
  doc('externo', 'B1 Inicial - Matrícula inicial', 'A matrícula inicial exige passaporte.', 'procedimento', {documentoId: 'nao-autorizado'}),
];
const grupo = (id, perguntas) => perguntas.map(pergunta => ({pergunta, esperados: [id]}));
export const perguntas = [
  ...grupo('matricula', ['Matrícula', 'Como faço minha matrícula?', 'MATRÍCULAS', 'Por favor, como fazer matrícula?', 'Gostaria de saber como fazer matrícula?', 'Poderia me informar como fazer matrícula?']),
  ...grupo('renovacao', ['Rematrícula', 'Como renovar minha matrícula?', 'Renovação de matrícula', 'Re-matrícula', 'Por favor, como fazer rematrícula?', 'Como renovar a minha matrícula?']),
  ...grupo('frequencia', ['Qual a frequência mínima?', 'Frequência mínima para aprovação', 'Qual a presença mínima?', 'Assiduidade mínima', 'Por favor, qual a frequência mínima?']),
  ...grupo('declaracao', ['Como solicitar declaração escolar?', 'Como pedir declaração?', 'Por favor, como solicitar declaração escolar?', 'Gostaria de saber como solicitar declaração escolar?']),
  ...grupo('calendario', ['Calendário acadêmico', 'Calendário escolar', 'Calendário letivo', 'Por favor, calendário acadêmico']),
  ...grupo('atendimento', ['Horário de atendimento da secretaria', 'Horários de atendimento da secretaria', 'Por favor, horário de atendimento da secretaria']),
  ...['E quanto tempo demora?', 'Quais documentos?', 'Qual o prazo para diploma?', 'Matrícula ou rematrícula?', 'Calendário acadêmico de 2035', 'Qual a taxa de matrícula?', 'Qual o telefone da secretaria?', 'Declaração pela internet?'].map(pergunta => ({pergunta, esperados: []})),
];
