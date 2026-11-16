  # Levantamento da base do Sylvinho

  Snapshot local auditado: 290 trechos únicos, 286 extraídos do Regimento Comum (39 páginas) e quatro sínteses de contato institucional. SHA-256 da base: `99225eef1834bd13b968c32ceb0ff4ac1762b3f94ff7c6d2df5aeab967041074`. Fonte técnica: `.cache/chat-rag/base.json`. Nenhuma chamada ao Gemini, importação de conhecimento ou mudança de runtime foi necessária para este levantamento. Sem commit ou deploy.

  ## Critério de cobertura

  “Coberto” significa conteúdo localizado no corpus; não garante vigência, interpretação completa ou recuperação correta pelo chat. As páginas abaixo são físicas do PDF. Este é um inventário documental, não parecer jurídico nem confirmação de procedimentos atuais. Fontes de contato foram registradas em 14/10/2026; não foram reconfirmadas externamente nesta auditoria. O nome 87/2022 identifica o snapshot, não comprova que ele seja a última norma.

  O inventário JSON anexo associa todos os 290 IDs ao conteúdo, artigo, páginas e etiquetas temáticas. As categorias podem se sobrepor: não somar contagens como se fossem documentos distintos. Chunks de administração e pessoal permanecem visíveis no inventário, sem serem contados como respostas úteis a alunos.

  ## Cobertura por categoria

  | Categoria | Trechos relacionados (sobrepostos) | O que existe | Limite principal |
  |---|---:|---|---|
  | Secretaria | 18 | Contatos publicados da Secretaria/Diretoria Acadêmica, endereço e horário geral da escola; atribuições da área acadêmica, guarda de registros e orientação educacional. Horário geral não é horário da secretaria. | Não há escala local de atendimento, prazo de retorno, agendamento ou procedimento operacional. O art. 35 remete prazos, modelos e procedimentos ao Sistema ETEC, que não integra estes 290 trechos. |
  | Matrícula | 33 | Ingresso, classificação/reclassificação, condições de acesso, representação do candidato, documentos definidos no processo seletivo, confirmação inicial, renovação, matrícula condicional e abandono. Referências: arts. 55–67, pp. 19–23. | Não contém edital local vigente, lista completa de documentos, sistema/telas, endereço de formulário nem cronograma atual. Os prazos expressos no regimento não devem ser pedidos novamente como se ausentes. |
  | Documentos | 21 | Competência para expedir, assinar e preservar documentos; diploma e certificados de conclusão; declaração de componentes cursados com aproveitamento. Arts. 20, 35–36, 93–94 e 125. | Não há modelos operacionais, prazos de emissão, catálogo local de declarações, taxas confirmadas ou acompanhamento de pedidos. Declaração do art. 94 não equivale automaticamente a todo tipo de declaração solicitada. |
  | Calendário | 25 | Aprovação e uso do calendário; matrícula/renovação, reuniões, comunicação das avaliações e definição geral de dias letivos. Há remissões ao calendário, não um calendário vigente indexado. | O PDF de calendário preservado em outra pasta/snapshot não integra estes 290 trechos. Não há datas concretas do ano/semestre em análise. |
  | Avaliação e frequência | 68 | Menções MB/B/R/I, avaliação contínua, recuperação, apuração de frequência, promoção/retenção, progressão parcial, reclassificação e reconsideração. Inclui frequência mínima e condições/exceções; não são lacunas de conteúdo. | Sem notas/faltas pessoais, planos docentes, datas locais, telas de consulta e procedimentos completos do Sistema ETEC. Resultado individual depende de registros autenticados e decisão competente, não do RAG. |
  | Transferência e cancelamento | 27 | Expedição e recebimento de transferência, existência de vaga, histórico, avaliação de competências, estudos complementares; trancamento e retorno condicionado; hipóteses de cancelamento/abandono e transferência disciplinar. Arts. 58–59, 64, 67, 71–73 e 117. | Não comprova vaga atual, formulário local, prazo de processamento, decisão individual ou compatibilidade concreta entre cursos. Desistência, trancamento, abandono e transferência não são sinônimos. |
  | Estágio e TCC | 18 | Conceito de estágio, obrigatório/não obrigatório, vínculo com PPC/matriz, dispensa condicionada, supervisão e registro da carga horária. TCC não aparece expressamente no corpus atual. | Não há PPCs/matrizes locais, manual de estágio ou TCC, modelos, orientadores, cronograma ou critérios concretos de banca. Exceção citada para Enfermagem não prova que a unidade oferece esse curso. |
  | Benefícios | 13 | Apoio e orientação educacional, recuperação da aprendizagem, direitos gerais de atendimento e possibilidade de instituições auxiliares/APM. Não comprova a existência de auxílio financeiro, transporte, alimentação ou programas específicos na unidade. | Não há regulamentos, editais, valores, inscrições ou critérios de benefícios específicos. Todas as perguntas deste lote são hipóteses de demanda, não afirmações de que o benefício existe. |
  | Regras gerais | 181 | Organização institucional, conselhos, direitos/deveres, participação, convivência, proibições, penalidades, ampla defesa, comunicação aos responsáveis, instituições auxiliares e disposições gerais. Grande parte do corpus é administrativa, não FAQ operacional. | O regimento remete a anexos e normas de convivência da unidade. Não estão indexados os regulamentos locais de ambientes, procedimentos de acesso ou normas complementares atualizadas. |
  | Cursos | 28 | Modalidades e formas de oferta permitidas, estrutura curricular geral, referência ao PPC e às matrizes, ingresso e educação a distância. Não contém catálogo local de cursos oferecidos no período. | Modalidade permitida à rede não prova oferta na ETEC de Matão. PPCs, matrizes, vagas, turnos, planos locais e editais de oferta não estão nesta base. |

  ## Lacunas de conteúdo versus problemas da busca

  - Os arts. 35–36 remetem procedimentos ao Sistema ETEC de Procedimentos Acadêmicos, ausente neste corpus: o regimento sozinho não é o manual operacional da secretaria.
  - A base contém frequência mínima, menções, condições de promoção, quem solicita transferência, representação na matrícula e hipóteses de trancamento. Não foram repetidas como perguntas pendentes genéricas.
  - Datas de um calendário preservado em outra pasta não contam como indexadas nos 290 trechos. Nenhum edital, PPC local ou manual de TCC foi encontrado dentro do corpus auditado. Não foi feita busca de nova informação externa.
  - Não foram encontrados TCC/trabalho de conclusão nem programas específicos de bolsa, alimentação ou transporte no texto. Menções a assistência/APM não comprovam benefícios concretos.
  - A fragmentação pode separar uma condição da regra e um artigo aparece repetido nos vários chunks. Antes de responder uma norma, reunir artigo, parágrafos, exceções e páginas relacionadas. Isso é correção de recuperação, não resposta nova.
  - A busca atual bloqueia explicitamente certas consultas de cursos e horário da secretaria; isso deverá ser revisto quando houver registros aprovados dessas informações. O ranking BM25 usa corpo/título/seção e não indexa por si só o campo de variações de uma futura FAQ.
  - O gerador aplica um filtro de dados pessoais também aos trechos, que pode excluir telefone/e-mail mesmo quando estão em fonte pública. Ter o contato armazenado não garante que ele apareça na resposta. Isso deve ser tratado separadamente com origem pública confirmada.
  - Estar em teste sem RAG é um estado do servidor, não ausência de conteúdo. Nenhuma reversão ou reativação foi realizada por este relatório.

  ## Perguntas para coleta — 10 lotes de 20

  Total de 200 perguntas únicas, numeradas dentro de cada categoria. Todas estão **PENDENTES**, sem resposta inventada. A classificação é editorial e relativa ao snapshot; (b) significa que há norma/contato geral relacionado, mas a aplicação à situação/local precisa ser delimitada. (c) indica necessidade de reconfirmação, não prova de revogação ou erro. Não foram forçadas 20 perguntas por subtipo.

  Legenda: **A** = falta informação; **B** = existe conteúdo relacionado, mas aplicação/escopo é ambíguo ou incompleto; **C** = pode estar desatualizado. Na ausência de B/C em uma categoria, não há evidência suficiente para inventar ambiguidades ou versões anteriores.

  ### Secretaria — lote 1 (20 perguntas)

  Base relacionada: Contatos publicados da Secretaria/Diretoria Acadêmica, endereço e horário geral da escola; atribuições da área acadêmica, guarda de registros e orientação educacional. Horário geral não é horário da secretaria.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Qual é o horário de atendimento presencial da secretaria em cada dia da semana?
  2. **[A] [PENDENTE]** Preciso agendar para ser atendido pela secretaria?
  3. **[A] [PENDENTE]** Como faço um agendamento, se ele for necessário?
  4. **[A] [PENDENTE]** Há atendimento da secretaria no intervalo das aulas noturnas?
  5. **[A] [PENDENTE]** Em quanto tempo a secretaria costuma responder uma mensagem?
  6. **[A] [PENDENTE]** Qual assunto devo encaminhar à secretaria e qual devo levar à coordenação do meu curso?
  7. **[A] [PENDENTE]** Como acompanho um pedido que já fiz à secretaria?
  8. **[A] [PENDENTE]** Como consigo o número de protocolo de uma solicitação?
  9. **[A] [PENDENTE]** Quem pode retirar uma solicitação em meu lugar e qual autorização devo entregar?
  10. **[A] [PENDENTE]** Como atualizo meu telefone e endereço no cadastro da escola?
  11. **[A] [PENDENTE]** Qual é o canal da unidade para recuperar acesso ao sistema acadêmico?
  12. **[A] [PENDENTE]** Como peço atendimento acessível ou ajuda para uma necessidade específica?
  13. **[A] [PENDENTE]** Como um responsável agenda uma conversa sobre a vida escolar do aluno?
  14. **[A] [PENDENTE]** Como a secretaria avisa sobre mudança temporária de atendimento ou fechamento?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  15. **[B] [PENDENTE]** O horário geral divulgado pela escola também cobre todos os serviços da secretaria?
  16. **[B] [PENDENTE]** Uma solicitação enviada pelo WhatsApp já vale como protocolo formal ou preciso registrá-la em outro canal?
  17. **[B] [PENDENTE]** Enviar documentos ao e-mail da Diretoria Acadêmica conclui o pedido ou ainda preciso entregar os originais?

  **(c) pode estar desatualizado; confirmação pendente**

  18. **[C] [PENDENTE]** O WhatsApp da secretaria registrado na base continua sendo o contato oficial?
  19. **[C] [PENDENTE]** O e-mail da Diretoria Acadêmica registrado na base continua em uso?
  20. **[C] [PENDENTE]** O endereço e os horários gerais registrados na base foram reconfirmados pela unidade neste período?

  ### Matrícula — lote 1 (20 perguntas)

  Base relacionada: Ingresso, classificação/reclassificação, condições de acesso, representação do candidato, documentos definidos no processo seletivo, confirmação inicial, renovação, matrícula condicional e abandono. Referências: arts. 55–67, pp. 19–23.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Qual é a lista de documentos para a matrícula inicial do meu curso neste processo seletivo?
  2. **[A] [PENDENTE]** Qual é a lista de documentos exigida para renovar minha matrícula neste período?
  3. **[A] [PENDENTE]** Em qual site ou sistema faço a matrícula inicial da unidade?
  4. **[A] [PENDENTE]** Qual é o passo a passo para renovar minha matrícula no sistema usado pela escola?
  5. **[A] [PENDENTE]** Qual formulário devo preencher para a matrícula inicial?
  6. **[A] [PENDENTE]** Onde entrego os documentos da matrícula e em qual formato de arquivo?
  7. **[A] [PENDENTE]** Quais são as datas e os horários da matrícula dos convocados neste processo?
  8. **[A] [PENDENTE]** Como sei em qual chamada fui convocado?
  9. **[A] [PENDENTE]** Como acompanho a confirmação da matrícula depois de enviar os documentos?
  10. **[A] [PENDENTE]** Como corrijo um documento que enviei errado na matrícula?
  11. **[A] [PENDENTE]** Qual é o canal de ajuda se o sistema de matrícula estiver fora do ar?
  12. **[A] [PENDENTE]** Como peço análise de aproveitamento de estudos na unidade e quais anexos devo enviar?
  13. **[A] [PENDENTE]** Como faço o pedido de classificação em vaga remanescente nesta unidade?
  14. **[A] [PENDENTE]** Onde consulto as vagas remanescentes abertas no meu curso?
  15. **[A] [PENDENTE]** Como descubro o resultado da análise de aproveitamento de estudos que solicitei?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  16. **[B] [PENDENTE]** A matrícula que enviei online ainda exige comparecimento presencial na unidade?
  17. **[B] [PENDENTE]** A escola chama de renovação a mesma operação para curso técnico e ensino médio integrado?
  18. **[B] [PENDENTE]** O representante que faz a matrícula pode usar autorização simples ou a unidade exige um modelo específico?

  **(c) pode estar desatualizado; confirmação pendente**

  19. **[C] [PENDENTE]** Qual edital e qual versão das orientações de matrícula estão válidos para este ingresso?
  20. **[C] [PENDENTE]** As exigências de acesso do meu curso foram alteradas desde o regimento usado na base?

  ### Documentos — lote 1 (20 perguntas)

  Base relacionada: Competência para expedir, assinar e preservar documentos; diploma e certificados de conclusão; declaração de componentes cursados com aproveitamento. Arts. 20, 35–36, 93–94 e 125.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Como solicito uma declaração de matrícula atual na unidade?
  2. **[A] [PENDENTE]** Como solicito uma declaração de escolaridade para apresentar no trabalho?
  3. **[A] [PENDENTE]** Como peço meu histórico escolar completo?
  4. **[A] [PENDENTE]** Qual é o prazo local de emissão do histórico escolar?
  5. **[A] [PENDENTE]** Como peço meu diploma depois de concluir o curso?
  6. **[A] [PENDENTE]** Como acompanho a emissão do meu diploma?
  7. **[A] [PENDENTE]** Como solicito segunda via de diploma ou certificado?
  8. **[A] [PENDENTE]** Como corrijo um erro no meu nome em documento já emitido?
  9. **[A] [PENDENTE]** Como solicito documento para comprovar conclusão enquanto o diploma não fica pronto?
  10. **[A] [PENDENTE]** Há cobrança pela emissão de algum documento e, se houver, qual é a regra oficial?
  11. **[A] [PENDENTE]** Como outra pessoa pode retirar meu diploma ou histórico?
  12. **[A] [PENDENTE]** Como solicito um documento escolar assinado digitalmente?
  13. **[A] [PENDENTE]** Como a empresa pode conferir a autenticidade de um documento da escola?
  14. **[A] [PENDENTE]** Como um ex-aluno faz pedidos sem acesso ao sistema acadêmico?
  15. **[A] [PENDENTE]** Como peço tradução ou orientação para apresentar meu documento escolar no exterior?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  16. **[B] [PENDENTE]** A declaração de componentes cursados atende ao comprovante de matrícula exigido pela empresa ou preciso pedir outro documento?
  17. **[B] [PENDENTE]** O documento digital enviado pela unidade substitui a via física para a finalidade que informei?
  18. **[B] [PENDENTE]** A declaração de conclusão cobre apenas o ensino médio, apenas o técnico ou os dois no meu caso?

  **(c) pode estar desatualizado; confirmação pendente**

  19. **[C] [PENDENTE]** Qual canal e qual formulário de pedidos de documentos estão vigentes hoje na unidade?
  20. **[C] [PENDENTE]** Os prazos e procedimentos de emissão adotados pela unidade foram atualizados neste período?

  ### Calendário — lote 1 (20 perguntas)

  Base relacionada: Aprovação e uso do calendário; matrícula/renovação, reuniões, comunicação das avaliações e definição geral de dias letivos. Há remissões ao calendário, não um calendário vigente indexado.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Onde encontro o calendário homologado da unidade para este ano?
  2. **[A] [PENDENTE]** Qual é o primeiro dia de aula do meu curso no próximo período?
  3. **[A] [PENDENTE]** Qual é o último dia de aula do semestre?
  4. **[A] [PENDENTE]** Quais são os dias de férias e recesso dos alunos?
  5. **[A] [PENDENTE]** Em quais feriados e emendas a unidade não terá aula?
  6. **[A] [PENDENTE]** Haverá sábados letivos para minha turma e quais são as datas?
  7. **[A] [PENDENTE]** Quando será a reunião de pais ou responsáveis da minha turma?
  8. **[A] [PENDENTE]** Em que data sai o resultado final do semestre?
  9. **[A] [PENDENTE]** Quando estarão disponíveis as sínteses de avaliação no sistema?
  10. **[A] [PENDENTE]** Quais são as datas do conselho de classe deste período?
  11. **[A] [PENDENTE]** Qual é o período reservado às atividades de recuperação da minha turma?
  12. **[A] [PENDENTE]** Quando acontece a renovação da matrícula neste semestre?
  13. **[A] [PENDENTE]** Qual é o prazo de inscrição para vagas remanescentes deste período?
  14. **[A] [PENDENTE]** Quais eventos da escola alteram o horário normal das aulas?
  15. **[A] [PENDENTE]** Onde a unidade publica mudanças de data ou reposições de aula?
  16. **[A] [PENDENTE]** Como descubro as datas de reposição após uma suspensão de aulas?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  17. **[B] [PENDENTE]** O calendário que recebi vale também para meu curso, turno e modalidade?
  18. **[B] [PENDENTE]** A data marcada como recesso de alunos também suspende o atendimento administrativo?
  19. **[B] [PENDENTE]** Um comunicado da turma substituiu uma data do calendário ou vale só para aquela atividade?

  **(c) pode estar desatualizado; confirmação pendente**

  20. **[C] [PENDENTE]** Qual é a última revisão aprovada do calendário deste ano e quais versões foram substituídas?

  ### Avaliação e frequência — lote 1 (20 perguntas)

  Base relacionada: Menções MB/B/R/I, avaliação contínua, recuperação, apuração de frequência, promoção/retenção, progressão parcial, reclassificação e reconsideração. Inclui frequência mínima e condições/exceções; não são lacunas de conteúdo.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Onde consulto minhas menções e faltas no sistema usado pela unidade?
  2. **[A] [PENDENTE]** Como aviso que uma falta foi lançada por engano?
  3. **[A] [PENDENTE]** Qual formulário a unidade usa para receber atestado médico?
  4. **[A] [PENDENTE]** Por qual canal entrego um atestado e como confirmo que foi recebido?
  5. **[A] [PENDENTE]** Qual é o prazo operacional da unidade para apresentar um atestado?
  6. **[A] [PENDENTE]** Como solicito o acompanhamento pedagógico por motivo de saúde?
  7. **[A] [PENDENTE]** Quem organiza meu plano individual de compensação de ausências e como entro em contato?
  8. **[A] [PENDENTE]** Onde encontro o plano de avaliação de cada disciplina da minha turma?
  9. **[A] [PENDENTE]** Como recebo as atividades e os horários da minha recuperação?
  10. **[A] [PENDENTE]** Como acompanho meu programa de progressão parcial no sistema?
  11. **[A] [PENDENTE]** Qual formulário e canal devo usar para pedir reconsideração de uma avaliação?
  12. **[A] [PENDENTE]** Como acompanho a tramitação e a resposta do meu pedido de reconsideração?
  13. **[A] [PENDENTE]** Quais documentos devo anexar ao recurso contra o resultado final?
  14. **[A] [PENDENTE]** Como consulto o andamento de um pedido de reclassificação?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  15. **[B] [PENDENTE]** A porcentagem de faltas mostrada na tela é de uma disciplina ou do conjunto exigido pelo regimento?
  16. **[B] [PENDENTE]** A atividade de recuperação comunicada pelo professor integra a recuperação contínua ou o programa de progressão parcial?
  17. **[B] [PENDENTE]** O pedido que preciso fazer é reconsideração, recurso ou reclassificação, considerando minha situação e etapa do curso?

  **(c) pode estar desatualizado; confirmação pendente**

  18. **[C] [PENDENTE]** Quais prazos da legislação complementar estão vigentes para reconsideração durante o ano letivo?
  19. **[C] [PENDENTE]** Quais prazos vigentes se aplicam ao recurso contra resultado final na unidade?
  20. **[C] [PENDENTE]** Qual versão dos planos docentes vale para as avaliações do meu módulo neste período?

  ### Transferência e cancelamento — lote 1 (20 perguntas)

  Base relacionada: Expedição e recebimento de transferência, existência de vaga, histórico, avaliação de competências, estudos complementares; trancamento e retorno condicionado; hipóteses de cancelamento/abandono e transferência disciplinar. Arts. 58–59, 64, 67, 71–73 e 117.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Qual formulário uso para pedir transferência de saída da unidade?
  2. **[A] [PENDENTE]** Por qual canal envio o pedido de transferência?
  3. **[A] [PENDENTE]** Qual é o prazo local para emissão dos documentos de transferência?
  4. **[A] [PENDENTE]** Onde consulto se existe vaga para transferência no curso que desejo?
  5. **[A] [PENDENTE]** Como participo da seleção quando há mais candidatos do que vagas de transferência?
  6. **[A] [PENDENTE]** Quais anexos a unidade pede para analisar uma transferência de outra instituição?
  7. **[A] [PENDENTE]** Como acompanho a análise da transferência que solicitei?
  8. **[A] [PENDENTE]** Como peço avaliação de compatibilidade entre meu curso de origem e o de destino?
  9. **[A] [PENDENTE]** Como recebo o plano de estudos complementares após a transferência?
  10. **[A] [PENDENTE]** Qual formulário e canal uso para solicitar trancamento de matrícula?
  11. **[A] [PENDENTE]** Como consulto se o meu pedido de trancamento foi aprovado?
  12. **[A] [PENDENTE]** Como peço o retorno após um trancamento nesta unidade?
  13. **[A] [PENDENTE]** Como formalizo minha desistência voluntária do curso?
  14. **[A] [PENDENTE]** Como solicito análise de um registro de abandono que considero incorreto?
  15. **[A] [PENDENTE]** Como confirmo que meu desligamento foi registrado e que não restou solicitação pendente?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  16. **[B] [PENDENTE]** No meu caso, devo solicitar trancamento, desistência ou transferência para outra escola?
  17. **[B] [PENDENTE]** A mudança que desejo é transferência de escola, troca de curso ou troca de turno?
  18. **[B] [PENDENTE]** O documento emitido na saída encerra minha matrícula ou ainda existe uma etapa administrativa na unidade?

  **(c) pode estar desatualizado; confirmação pendente**

  19. **[C] [PENDENTE]** Quais vagas e editais de transferência estão abertos neste período?
  20. **[C] [PENDENTE]** Qual procedimento complementar vigente regula a desistência voluntária na unidade?

  ### Estágio e TCC — lote 1 (20 perguntas)

  Base relacionada: Conceito de estágio, obrigatório/não obrigatório, vínculo com PPC/matriz, dispensa condicionada, supervisão e registro da carga horária. TCC não aparece expressamente no corpus atual.


  **(a) falta informação**

  1. **[A] [PENDENTE]** O estágio é obrigatório no meu curso e na minha matriz curricular?
  2. **[A] [PENDENTE]** Quantas horas de estágio minha turma precisa cumprir?
  3. **[A] [PENDENTE]** A partir de qual módulo posso iniciar estágio no meu curso?
  4. **[A] [PENDENTE]** Quem é o orientador de estágio da minha turma e como faço contato?
  5. **[A] [PENDENTE]** Quais documentos preciso entregar antes de começar o estágio?
  6. **[A] [PENDENTE]** Qual modelo de termo de compromisso a unidade aceita?
  7. **[A] [PENDENTE]** Como envio relatórios e comprovantes das horas de estágio?
  8. **[A] [PENDENTE]** Qual é o prazo local para analisar ou assinar os documentos de estágio?
  9. **[A] [PENDENTE]** Como apresento comprovantes para pedir dispensa de estágio na unidade?
  10. **[A] [PENDENTE]** Onde a unidade divulga vagas de estágio e aprendizagem?
  11. **[A] [PENDENTE]** Meu curso exige TCC e em qual módulo ele é desenvolvido?
  12. **[A] [PENDENTE]** Qual manual e qual modelo de trabalho devo usar no TCC?
  13. **[A] [PENDENTE]** Como é escolhido ou definido o orientador do meu TCC?
  14. **[A] [PENDENTE]** Quais são as datas de entrega e apresentação do TCC da minha turma?
  15. **[A] [PENDENTE]** Como funciona a avaliação da banca de TCC do meu curso?
  16. **[A] [PENDENTE]** O TCC pode ser feito em grupo e quais são os limites adotados no meu curso?
  17. **[A] [PENDENTE]** Como registro o tema e uma eventual mudança de tema do TCC?
  18. **[A] [PENDENTE]** Como a unidade trata correções ou nova apresentação de TCC não aprovado?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  19. **[B] [PENDENTE]** A atividade proposta pela empresa pode contar como estágio curricular do meu curso ou exige outro vínculo?

  **(c) pode estar desatualizado; confirmação pendente**

  20. **[C] [PENDENTE]** As exigências de dispensa de estágio e as exceções do meu curso foram reconfirmadas pela coordenação?

  ### Benefícios — lote 1 (20 perguntas)

  Base relacionada: Apoio e orientação educacional, recuperação da aprendizagem, direitos gerais de atendimento e possibilidade de instituições auxiliares/APM. Não comprova a existência de auxílio financeiro, transporte, alimentação ou programas específicos na unidade.


  **(a) falta informação**

  1. **[A] [PENDENTE]** A unidade oferece algum auxílio financeiro para alunos?
  2. **[A] [PENDENTE]** Existe algum benefício de transporte para os alunos desta unidade?
  3. **[A] [PENDENTE]** Como descubro se posso solicitar passe escolar ou desconto no transporte?
  4. **[A] [PENDENTE]** A escola emite comprovante específico para pedir benefício de transporte?
  5. **[A] [PENDENTE]** A unidade oferece alimentação ou apoio alimentar aos alunos?
  6. **[A] [PENDENTE]** Existe atendimento para aluno que não consegue comprar material escolar?
  7. **[A] [PENDENTE]** Há empréstimo de equipamentos para quem precisa acompanhar as atividades?
  8. **[A] [PENDENTE]** Existe empréstimo de uniforme ou equipamento de proteção para aulas práticas?
  9. **[A] [PENDENTE]** Há acesso a internet ou espaço de estudo para quem não tem esses recursos em casa?
  10. **[A] [PENDENTE]** Existe algum apoio para alunos em situação de vulnerabilidade social?
  11. **[A] [PENDENTE]** Qual setor orienta sobre benefícios disponíveis para estudantes?
  12. **[A] [PENDENTE]** Há algum programa de bolsa de estudo ou permanência disponível para esta unidade?
  13. **[A] [PENDENTE]** Existem benefícios específicos para estudantes com deficiência?
  14. **[A] [PENDENTE]** A escola orienta sobre programas de apoio oferecidos por outros órgãos?
  15. **[A] [PENDENTE]** Quais documentos são exigidos para avaliar um pedido de auxílio que esteja disponível?
  16. **[A] [PENDENTE]** Há prazo de inscrição nos programas de apoio disponíveis?
  17. **[A] [PENDENTE]** Como o aluno acompanha a análise de um pedido de benefício?
  18. **[A] [PENDENTE]** Se um pedido de benefício for negado, existe canal de revisão?
  19. **[A] [PENDENTE]** Há alguma cobrança da APM relacionada a benefícios e qual é a orientação oficial sobre isso?
  20. **[A] [PENDENTE]** Como o responsável pode pedir orientação sobre apoio para a permanência do aluno?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  Nenhuma pergunta deste subtipo foi incluída neste lote.

  **(c) pode estar desatualizado; confirmação pendente**

  Nenhuma pergunta deste subtipo foi incluída neste lote.

  ### Regras gerais — lote 1 (20 perguntas)

  Base relacionada: Organização institucional, conselhos, direitos/deveres, participação, convivência, proibições, penalidades, ampla defesa, comunicação aos responsáveis, instituições auxiliares e disposições gerais. Grande parte do corpus é administrativa, não FAQ operacional.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Onde encontro as normas de convivência aprovadas para esta unidade?
  2. **[A] [PENDENTE]** Como registro uma reclamação ou ocorrência com protocolo na escola?
  3. **[A] [PENDENTE]** Qual é o canal da unidade para comunicar bullying ou discriminação?
  4. **[A] [PENDENTE]** Como um responsável recebe e responde a uma comunicação disciplinar?
  5. **[A] [PENDENTE]** Qual é o procedimento local para apresentar defesa em uma ocorrência disciplinar?
  6. **[A] [PENDENTE]** Como solicito autorização para sair antes do fim das aulas?
  7. **[A] [PENDENTE]** Qual formulário o responsável deve usar para autorizar a saída de menor?
  8. **[A] [PENDENTE]** Como solicito autorização para gravar uma atividade escolar?
  9. **[A] [PENDENTE]** Como peço autorização para divulgar fotos de um evento da escola?
  10. **[A] [PENDENTE]** Como participo das eleições de representantes na minha unidade?
  11. **[A] [PENDENTE]** Onde consulto as pautas e os registros públicos do Conselho de Escola?
  12. **[A] [PENDENTE]** Como apresento uma proposta ao grêmio estudantil ou à APM?
  13. **[A] [PENDENTE]** Quais são as regras locais para uso dos laboratórios e empréstimo de materiais?
  14. **[A] [PENDENTE]** Qual procedimento devo seguir se perder um objeto dentro da escola?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  15. **[B] [PENDENTE]** A restrição a equipamentos durante a aula se aplica de que forma ao uso pedagógico autorizado pelo professor na minha turma?
  16. **[B] [PENDENTE]** Que vestimenta e equipamento de proteção são exigidos para a atividade prática específica do meu curso?
  17. **[B] [PENDENTE]** Uma atividade fora da escola precisa de qual autorização local, considerando minha idade e o tipo de evento?

  **(c) pode estar desatualizado; confirmação pendente**

  18. **[C] [PENDENTE]** Qual versão das normas de convivência está em vigor na unidade?
  19. **[C] [PENDENTE]** Houve orientação complementar que mudou regras de uso de celular desde o snapshot do regimento?
  20. **[C] [PENDENTE]** Há deliberações ou anexos posteriores que substituam partes do regimento usado na base?

  ### Cursos — lote 1 (20 perguntas)

  Base relacionada: Modalidades e formas de oferta permitidas, estrutura curricular geral, referência ao PPC e às matrizes, ingresso e educação a distância. Não contém catálogo local de cursos oferecidos no período.


  **(a) falta informação**

  1. **[A] [PENDENTE]** Quais cursos a unidade oferece neste semestre?
  2. **[A] [PENDENTE]** Quais cursos terão ingresso no próximo processo seletivo da unidade?
  3. **[A] [PENDENTE]** Quais turnos estão disponíveis para o curso que quero fazer?
  4. **[A] [PENDENTE]** Quantas vagas serão abertas para cada curso da unidade?
  5. **[A] [PENDENTE]** Qual é a duração e a carga horária total do curso que pretendo cursar?
  6. **[A] [PENDENTE]** Onde consulto a matriz curricular do meu curso e da minha turma?
  7. **[A] [PENDENTE]** Quais disciplinas vou estudar no próximo módulo do meu curso?
  8. **[A] [PENDENTE]** Quem coordena meu curso e qual é o canal de atendimento?
  9. **[A] [PENDENTE]** Qual é o horário de aulas da minha turma?
  10. **[A] [PENDENTE]** Qual laboratório e quais recursos estão disponíveis para meu curso?
  11. **[A] [PENDENTE]** Quais pré-requisitos específicos de ingresso valem para o curso desejado?
  12. **[A] [PENDENTE]** Como descubro se haverá formação de nova turma no turno que escolhi?
  13. **[A] [PENDENTE]** Há visita orientada ou apresentação dos cursos para candidatos e responsáveis?
  14. **[A] [PENDENTE]** Como peço orientação para escolher entre os cursos oferecidos pela unidade?

  **(b) existe informação relacionada, mas falta delimitar escopo/aplicação**

  15. **[B] [PENDENTE]** O curso anunciado para a minha inscrição é integrado, concomitante ou subsequente?
  16. **[B] [PENDENTE]** A possibilidade de ensino híbrido no regimento significa que meu curso possui atividades remotas aprovadas?
  17. **[B] [PENDENTE]** O certificado intermediário mencionado na regra geral existe no itinerário do meu curso?

  **(c) pode estar desatualizado; confirmação pendente**

  18. **[C] [PENDENTE]** Qual versão do PPC e da matriz curricular vale para o ano em que ingressei?
  19. **[C] [PENDENTE]** A oferta de cursos, turnos e modalidades divulgada anteriormente continua válida para o próximo ingresso?
  20. **[C] [PENDENTE]** Algum curso da unidade mudou de nome, matriz ou deixou de receber novas turmas?

  ## Formato de entrada das novas respostas

  Um registro por intenção/pergunta, não um documento por variação. Campos obrigatórios:

  | Campo | Formato e regra |
  |---|---|
  | pergunta | Pergunta principal, clara e específica. |
  | variacoes | Lista de maneiras equivalentes de perguntar; não misturar matrícula inicial e renovação. |
  | resposta | Texto factual confirmado, com passos, condições e exceções; null enquanto pendente. |
  | categoria | Um dos dez IDs usados neste levantamento; subcategoria opcional. |
  | aplicaSe | Unidade, cursos, modalidade, turno, perfil e período/turma quando necessários. Desconhecido é null, não “todos”. |
  | vigencia | Início, fim, versão/ano-letivo e data de revisão; null não significa vigência eterna. |
  | quemConfirmou | Setor responsável, pessoa/identificador se apropriado, função, data e referência de confirmação; não inventar nomes. |

  Também necessários para governança: id estável, status, fonte documental/URL ou confirmação escrita, artigo/página quando houver, versão, hash, registro substituído e responsável pela revisão. A confirmação do setor não deve constar só no texto livre; deve ser rastreável. Contato interno/pessoal do confirmador não precisa ir ao modelo. Uma confirmação operacional local não revoga norma superior.

  Exemplo preenchível, **não indexável** enquanto pendente:

  ```json
  {
    "id": "faq-secretaria-declaracao-matricula-001",
    "pergunta": "Como solicito uma declaração de matrícula atual na unidade?",
    "variacoes": [
      "Como pedir comprovante de matrícula?"
    ],
    "resposta": null,
    "categoria": "documentos",
    "aplicaSe": {
      "unidade": "ETEC Sylvio de Mattos Carvalho",
      "cursos": null,
      "modalidades": null,
      "turnos": null,
      "publico": [
        "aluno",
        "responsavel"
      ],
      "periodoLetivo": null
    },
    "vigencia": {
      "inicio": null,
      "fim": null,
      "versao": null,
      "revisarEm": null
    },
    "quemConfirmou": {
      "setor": null,
      "pessoaOuIdentificador": null,
      "funcao": null,
      "confirmadoEm": null,
      "referencia": null
    },
    "fonte": {
      "tipo": null,
      "documentoOuUrl": null,
      "paginaInicial": null,
      "paginaFinal": null,
      "artigo": null,
      "sha256": null
    },
    "status": "pendente",
    "versao": 1,
    "substitui": null
  }
  ```

  ## Como as respostas novas entram na busca (proposta, não executada)

  1. Receber o cadastro como rascunho. Separar falta de dado de não aplicável; perguntar ao setor competente. Não transformar a pergunta pendente em conhecimento factual.
  2. Conferir a fonte, o escopo e quem confirmou; revisar conflitos com regimento, PPC e orientações superiores. Status possíveis: pendente, em_revisao, aprovado, suspenso, expirado, substituido. Nenhum pendente fica ativo.
  3. Somente aprovado + fonte rastreável + resposta não vazia + escopo definido + validade/revisão verificadas pode ser elegível. Se falta data de vigência porque o documento não a declara, exigir revisão explícita e política de atualização; não fabricar data. Expirados e conflitantes ficam fora do índice.
  4. Converter cada resposta aprovada para o contrato de conhecimento: id, documentoId, titulo (pergunta), categoria, tipoConteudo (procedimento/informacao_institucional), secao, conteudo (somente resposta confirmada), páginas quando reais, ativo, versão, fonte e metadados de escopo. Manter ligação ao registro de confirmação.
  5. Adaptar o índice lexical para usar pergunta + variacoes em campos de recuperação separados, e resposta no corpo. O código atual não torna variações pesquisáveis só por adicioná-las a termosBusca. Variações são pistas de busca, nunca evidência enviada ao modelo como se fossem regras.
  6. Filtrar unidade/curso/período e vigência antes de ranquear. Se o usuário não informar um escopo que muda a resposta, pedir esclarecimento. Remover bloqueios fixos de cursos/horário apenas quando houver fonte aprovada para aquele escopo; manter fallback para escopos sem cobertura.
  7. Combinar FAQ confirmada e trechos documentais relevantes; preservar artigos inteiros/condições quando os chunks estiverem fragmentados. Uma FAQ local só complementa a norma; conflito impede resposta automática, não autoriza preferir a data mais recente.
  8. Testar a pergunta principal, variações, troca de curso/ano, fonte vencida, assunto parecido e ausência de evidência. Só depois disponibilizar na cópia local. Importação no Firebase/publicação exigem etapa posterior autorizada; nenhuma foi feita.

  ## Ordem sugerida de coleta

  Primeiro: atendimento, matrícula/renovação, documentos e calendário homologado. Depois: protocolos de avaliação/recursos, transferência/trancamento e PPC/manual de estágio/TCC. Por fim: benefícios confirmados, normas locais e oferta atual de cursos (pode subir de prioridade conforme dúvidas reais). Não presumir que qualquer programa exista.

  ## Entregáveis e limites

  - Este relatório: cobertura e dez listas de 20.
  - [perguntas-pendentes.json](perguntas-pendentes.json): 200 registros preenchíveis, todas as respostas null e status pendente.
  - [inventario-290.json](inventario-290.json): mapa auditável dos 290 trechos, conteúdos, IDs, artigos, páginas e hash.

  Nenhuma regra, resposta nova, confirmação ou vigência foi inventada. A auditoria descreve o conteúdo do snapshot, não mede que o chat acerte todas essas perguntas, não atesta a vigência das normas e não consome cota da IA.
