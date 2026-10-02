# Fase 7.3 - Handler autenticado isolado

## Escopo

- Modulo: functions/src/assistente/handler.ts.
- Testes: tests/assistente-handler.test.mjs.
- Nao importado/exportado por functions/src/index.ts.
- Sem onRequest, inicializacao Firebase, SDK Gemini ou acesso a secrets.
- Sem mudanca no RAG V1, frontend, Rules, configuracoes ou schema.
- Toda leitura/escrita desta validacao usa mocks em memoria. Nenhum Firebase real.

## Contrato

POST, Authorization: Bearer <Firebase ID Token>, body {pergunta, conversationId}.
Retorno de sucesso: {resposta}. UID vem exclusivamente de verifyIdToken.
usuarioId extra e ignorado: nao e lido nem usado para construir a referencia.
Somente users/{uid}/conversas/{conversationId} pode receber o bot.
Limite servidor: 1000 caracteres apos trim; ID alfanumerico de20 caracteres.
Limite de100 mensagens relido antes da geracao e dentro da transacao.
405/metodo,401/autenticacao,400/entrada,404/conversa ausente,
409/limite,500/falha de geracao/leitura/persistencia.
OPTIONS tambem retorna405 neste handler; CORS pertence ao futuro wrapper HTTP.

## Dependencias e fluxo

Dependencias obrigatorias: auth.verifyIdToken, firestore.collection/runTransaction,
serverTimestamp e gerarResposta(promptSistema, pergunta).
agora e opcional, com Date.now como padrao, para timestamp numerico do bot.
Imports de Express e Firestore sao somente tipos: nao inicializam SDKs.
Gerador e interface injetada, sem fallback para Gemini nem variavel de ambiente.

Autenticacao -> validacao -> leitura da conversa autenticada -> recuperacao V1
-> prompt original -> gerador injetado -> transacao -> retorno HTTP.
A geracao ocorre fora da transacao. Retry interno do callback nao chama o gerador.
Texto vazio/nao-string do gerador e rejeitado com500 antes da persistencia;
esse guard e uma adaptacao defensiva explicita em relacao ao JS original.

A transacao reler a conversa, rejeita exclusao/limite e acrescenta exclusivamente
{texto: resposta, remetente: "bot", enviadoEm: numero}.
Atualiza apenas mensagens e atualizadoEm. Nao grava user, nao gera titulo,
nao altera titulo/tituloOrigem/criadoEm e nao cria uma conversa inexistente.
Falta de array mensagens usa[] como no handler original, sem nova validacao de schema.

## Concorrencia e idempotencia: limitacoes intencionais

1. Duas requisicoes iguais geram dois bots. Nao ha requestId/messageId/deduplicacao.
2. Transacao preserva mensagens atuais, mas nao garante pares adjacentes user/bot.
   Duas abas podem terminar fora de ordem; os bots aparecem na ordem de commit.
3. Body pode conter pergunta diferente da ultima mensagem persistida. O contrato
   nao identifica qual mensagem gerou a resposta. Nao se inventou correlacao.
4. Se conversa chega a100 durante geracao, retorna409 sem bot, mesmo tendo gerado.
   Se duas respostas disputam a ultima vaga, somente uma cabe.
5. Conversa excluida antes da transacao retorna404, sem recriar documento.
   Excluir e recriar sob o mesmo ID nao e distinguido por este contrato.
6. Troca de sessao no cliente nao cancela requisicao autenticada anterior.
   Ela continua no UID original; nao existe acesso ao UID da nova sessao.
   O cliente futuro precisara ignorar retorno obsoleto, sem supor cancelamento.
7. Falha do gerador ou do commit mantem user salvo. Timeout/perda de resposta HTTP
   apos commit pode esconder sucesso do cliente; retry pode duplicar bot.
   Nao ha garantia exactly-once nem atomicidade entre geracao, commit e HTTP.
8. Mensagens/conteudo anteriores sao confiados ao contrato ja existente. Este
   handler nao comprova autoria individual de cada item nem valida Rules.

Os testes de concorrencia simulam transacoes serializadas e retry em memoria;
nao sao validacao do SDK/emulador nem prova de todas as corridas distribuidas.
Proposta futura, nao implementada: discutir identificador de requisicao/mensagem,
politica de retry, correlacao e lifecycle da sessao em etapa autorizada separada.

## Validacao local

Executar npm run build dentro de functions antes dos testes.
Na raiz:
node --test tests/assistente-handler.test.mjs tests/rag-v1-paridade.test.mjs tests/admin-routing.test.mjs tests/avisos-access.test.mjs tests/avisos-admin.test.mjs

Lint apenas dos modulos:
functions/node_modules/.bin/eslint.cmd src/assistente/handler.ts src/rag/recuperacao.ts
(executado com cwd functions, usando .\\node_modules\\.bin\\eslint.cmd).

Nao executar admin-rules.test.mjs nesta etapa: exige emuladores e escreve apenas
em ambiente demo quando executado. Os46 erros antigos do lint global permanecem.
Testes da paridade usam o JS original somente em leitura, sem importar index.js/.env.
