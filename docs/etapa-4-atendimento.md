# Etapa 4 — experiência de atendimento

Implementação local em 29/10/2026. Sem commit, push, deploy, chamada real de IA,
serviço pago ou mudança de regras/dados remotos. Nenhum arquivo em public foi
alterado. As mudanças anteriores do workspace foram preservadas.

## Padrão implementado

As instruções compartilhadas de geração atendem alunos, responsáveis, professores
e visitantes sem presumir vínculo, idade ou titularidade de uma solicitação.
Perguntas simples continuam com resposta curta. Para procedimentos documentados,
o prompt orienta resposta direta, passos, condições importantes, referência e
próxima ação sustentada, sem forçar cinco títulos ou repetir informações.

A estrutura é acomodada no contrato existente: até três afirmações documentais,
cada uma com referências literais, e limites de tamanho preservados. Não foram
criados campos de resposta, componentes de UI ou um fluxo paralelo de geração.

As próximas ações só podem ser descritas quando sustentadas no procedimento
aplicável. Rotinas internas não devem virar exigências do aluno. Os prompts de
revisão verificam também contatos inventados e alegações de que o chat enviou,
registrou, agendou ou aprovou uma solicitação. Trata-se de instrução de revisão
por modelo, não de garantia determinística contra toda alucinação.

## Encaminhamento e sugestões

O novo helper local `encaminhamento.ts` torna o fallback por ausência de evidência
mais útil. Seleciona mensagens constantes, sem repetir nomes ou texto livre do
usuário e sem apresentar a composição como geração de IA:

- Dúvida de prazo/data: explica que não há confirmação e sugere a pergunta a
  levar à Secretaria Acadêmica, informando qual é o procedimento.
- Contato/horário: informa que não foi confirmado e orienta verificar os canais
  oficiais divulgados pela escola. Não exibe email, telefone ou URL presumidos.
- Demais lacunas: orienta confirmar o procedimento com a Secretaria Acadêmica.

Não foi acrescentado canal específico, pois não houve confirmação de contatos.
Não se inventa endereço para tornar o encaminhamento aparentemente completo.

No modo gerativo, a instrução permite no máximo uma pergunta complementar quando
há uma lacuna concreta e o schema permite mensagem livre. Não pede sugestões em
saudações, dúvidas simples ou respostas que já solicitem esclarecimento. No modo
documental, sugestões sem evidência não entram no campo de afirmações.

As respostas documentais com citações continuam no formato reconhecido pelo
frontend. Não foram adicionadas seções ou ações inventadas aos trechos literais.
Insuficiência por entrada inválida, conflito e os avisos de modelos mantêm seus
contratos. Os pedidos curtos de esclarecimento também não ganham novos rodapés.

## Exemplos

**Sem evidência de prazo — saída determinística testada:**

Pergunta: “Qual o prazo para diploma?”

> Não encontrei um prazo ou uma data confirmados nos documentos consultados.
> Confirme com a Secretaria Acadêmica: "Qual é o prazo para o procedimento
> que preciso solicitar?" Informe qual é o procedimento, sem enviar dados
> pessoais aqui.

**Sem telefone confirmado — saída determinística testada:**

> Não encontrei esse contato ou horário confirmado nos documentos consultados.
> Verifique os canais oficiais divulgados pela escola para falar com a
> Secretaria Acadêmica.

**Procedimento — saída com provedor simulado, não regra real da ETEC:**

> Solicite a declaração escolar na secretaria experimental.

O teste acompanha esse texto com aviso de IA, citação literal e fonte sintética.
O exemplo valida transporte/composição, não comprova qualidade do modelo real.
No modo documental permanece a citação integral identificada como trecho, sem
atribuição a Gemini. Prazos, exigências e confirmações não foram acrescentados.

## Avaliação de feedback

Feedback “Esta resposta ajudou? Sim/Não” é viável, mas não foi implementado.
As regras atuais aceitam apenas campos específicos de conversa e mensagem;
não há armazenamento autorizado para votos. Um botão sem persistência seria
enganoso; usar mensagens do chat como votos afetaria histórico e contexto.

Proposta para uma alteração futura: um voto booleano por resposta existente,
referência da resposta e horário, sob a conta proprietária, sem texto livre,
conteúdo da conversa, nome, email ou IP. Permitir substituir o voto em vez de
duplicá-lo; validar propriedade e existência do bot no servidor. Definir retenção
e exclusão com a conversa antes de implementar. Visitantes exigem decisão própria,
pois não têm histórico persistido nem identidade autenticada neste fluxo.
Nenhuma coleta, regra, coleção ou botão de feedback foi criado nesta etapa.

## Arquivos desta etapa

- `functions/src/assistente/geracao/atendimento.ts`: padrão compartilhado.
- `functions/src/assistente/geracao/conversa.ts`: público inclusivo e revisão.
- `functions/src/assistente/geracao/instrucoes.ts`: revisão de ações sustentadas.
- `functions/src/assistente/encaminhamento.ts`: novo fallback orientativo local.
- `functions/src/assistente/resposta-documental.ts`: integração no caso sem evidência.
- `tests/experiencia-atendimento.test.mjs`: 12 novos testes.
- `tests/qualidade-atendimento.test.mjs`: reconhecimento de “Secretaria” sem
  depender de maiúscula/minúscula.
- `tests/chat-visitante.test.mjs`: aceita os links relativos equivalentes
  `Chat/chat.html` e `./Chat/chat.html`; a página real não foi alterada.
- Este relatório.

## Validação

Build TypeScript, ESLint e git diff --check aprovados. 412 testes selecionados
passaram: experiencia-atendimento, qualidade-atendimento, rag-etapa2,
contexto-conversacional, pergunta-livre-fluxo, gemini-geracao,
openrouter-conversa, openrouter-revisao, resposta-ia-view, assistente-handler,
assistente-client, conversation-store, envio-pendente, session-navigation e
chat-visitante. Suíte completa do repositório não foi executada.

Os testes conferem os quatro públicos, ausência de contatos/números inventados,
não repetição de dados pessoais no fallback, esclarecimento curto, preservação
de fontes e parser, conflito documental e instruções efetivamente transmitidas
à geração/revisão por transporte simulado. As políticas de ativação permanecem
intactas. Nenhum teste fez chamada real ao provedor.

## Pendências e limites

- Avaliar geração real com autorização e configuração publicada verificadas.
- Confirmar canais oficiais antes de oferecer contato direto.
- Aprovar desenho de permissões/retenção antes de implementar feedback.
- Validar os passos em documentos reais com a secretaria. O corpus dos testes
  não certifica regras ou vigência institucional.
- A estrutura gerativa é instrução, não garantia de que o modelo sempre siga
  todas as seções; validação e fallback continuam necessários.
- Fontes, fontes tipográficas, cores, responsividade e navegação foram preservadas
  por ausência de alterações no frontend; não foi feita nova auditoria visual.
