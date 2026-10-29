# Etapa 3 — contexto conversacional limitado

Implementação local em 29/10/2026. Sem mudanças no frontend, Auth, regras,
estrutura do histórico ou documentos remotos. Sem commit, push, deploy ou
chamadas reais a provedores. Alterações anteriores do workspace preservadas.

## Recuperação e isolamento

O handler continua obtendo o UID exclusivamente do token Firebase validado e
lendo `users/{uid}/conversas/{conversationId}`. Antes de usar contexto, confirma
que existe exatamente uma mensagem user com o messageId e a pergunta original.
Resposta bot já persistida é devolvida imediatamente: o replay não interpreta
contexto nem gera novamente. Os caminhos de demonstração continuam separados.

Depois da releitura existente, o novo resolver analisa somente entradas anteriores
à posição da pergunta atual. Mensagens posteriores, inclusive novos assuntos
enviados depois de uma pendência, não são consideradas. Não recebe histórico do
corpo HTTP, não consulta outras conversas e não mantém cache compartilhado.

O Firestore armazena todas as mensagens num array de um único documento. Portanto,
a leitura física ainda traz esse documento inteiro, como antes. Esta etapa limita
o processamento, sem leituras adicionais; carregar somente parte do array exigiria
outra estrutura de armazenamento, que não foi alterada.

## Limites e relevância

- Até seis entradas anteriores, incluindo bots na contagem.
- Até 2.000 caracteres acumulados nessa janela; para ao exceder o limite.
- Até 700 caracteres por mensagem anterior de usuário.
- Não utiliza fatos, instruções ou assuntos extraídos das respostas do bot.
- Usa o assunto reconhecido na mensagem user mais recente; uma mensagem user
  desconhecida/ambígua interrompe a busca, evitando recuperar assunto antigo.
- Pode atravessar uma cadeia curta de complementos reconhecidos, dentro da janela.
- Histórico vazio ou insuficiente produz: “Sobre qual procedimento você quer saber?”

O reconhecimento é lexical e fechado, não uma compreensão semântica geral.
Os assuntos incluem matrícula, renovação, declaração escolar, frequência mínima,
calendário acadêmico e atendimento da secretaria. As formas de perguntas anteriores
aceitas são limitadas. Complementos cobrem prazo, documentos, local de solicitação
e possibilidade de solicitação pela internet. Outros textos completos seguem o
fluxo original; não recebem contexto presumido.

## Privacidade e geração

Nenhum texto anterior é concatenado à pergunta enviada ao gateway. O resolver
produz uma consulta composta apenas por frases e assuntos constantes do código.
Uma mensagem anterior com nomes, identificadores, qualificadores ou subtipos fora
do vocabulário aceito não é usada como contexto; o resolver pede esclarecimento.
Isso é uma restrição de escopo, não uma promessa de anonimização geral.

Exemplo:

1. Usuário: “Como solicito uma declaração escolar?”
2. Usuário: “E quanto tempo demora?”
3. Consulta interna: “Qual o prazo para declaração escolar?”

Busca e geração recebem a mesma consulta contextualizada. Os documentos continuam
sendo a única base para regras e prazos; fatos das respostas anteriores não são
reciclados como evidência. Não encontrar prazo mantém o comportamento existente
de insuficiência/esclarecimento conforme o gerador selecionado.

O gateway continua aplicando allowlist, ativação, políticas de dados, moderação,
aprovações, revisão e fallback. A consulta não ativa nenhum provedor. A pergunta
atual com qualificadores extras não é “limpa” pelo resolver: segue intacta para
os controles existentes, evitando apagar dados apenas para superar uma barreira.

## Histórico, pendências e replay

A pergunta contextualizada não substitui a pergunta salva. O texto original e o
mesmo messageId continuam sendo usados na confirmação transacional. O bot é
acrescentado pelo mecanismo existente, inclusive quando é um esclarecimento
determinístico. Reenvios devolvem esse mesmo bot. Não há remoção de mensagens,
alteração de IDs, títulos, pendências ou protocolo de novo chat.

## Arquivos desta etapa

- `functions/src/assistente/contexto-conversacional.ts`: resolver puro e limites.
- `functions/src/assistente/handler.ts`: integração depois de autenticação/replay
  e antes da busca; persistência continua vinculada à pergunta original.
- `tests/contexto-conversacional.test.mjs`: testes sintéticos unitários e de
  integração em memória, incluindo gateway/provedor simulado.
- Este relatório.

## Validação

Build TypeScript, ESLint e `git diff --check` aprovados. 397 testes passaram nas
suítes: contexto-conversacional, assistente-handler, pergunta-livre-fluxo,
gemini-demo-web, conversation-store, envio-pendente, session-navigation,
gemini-geracao, gemini-politica-retencao, openrouter-conversa, rag-etapa2 e
qualidade-atendimento.

Cobertura inclui complementos, mudança de assunto, renovação versus matrícula,
histórico vazio/longo, limites de tamanho, ambiguidade, dados pessoais/injeções,
ignorância de mensagens futuras e bots, isolamento entre usuários e conversas,
autenticação inválida, corpo HTTP com histórico forjado, pergunta original/IDs,
replay de resposta e esclarecimento, gateway desabilitado e inspeção das quatro
cargas de um provedor simulado. Nos dados sintéticos, um prazo fictício de três
dias foi recuperado; isso não representa prazo real da ETEC.

```powershell
npm --prefix functions run build
npm --prefix functions run lint
node --test tests/contexto-conversacional.test.mjs
```

## Limitações

Não há avaliação publicada ou com IA real. O vocabulário fechado pode pedir
esclarecimento mesmo quando um humano entenderia a continuidade. Uma resposta
bot extensa pode consumir a janela de caracteres e impedir herança do assunto.
Não há reconstrução de contexto além da janela, inferência de subtipos ou memória
entre conversas. Isso mantém o envio externo limitado, mas restringe naturalidade.
Ampliar esse reconhecimento exige exemplos e testes de ambiguidade/privacidade;
não deve ser feito por envio automático do histórico bruto ao modelo.
