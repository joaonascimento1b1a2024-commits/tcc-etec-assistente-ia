# IA no chat sem login

Implementado com transporte simulado, sem chamada paga, deploy ou alteracao
de credenciais. A mudanca atende ao pedido explicito de liberar IA publica.

## Por que aparecia UID_NAO_AUTORIZADO

A rota `/perguntarVisitante` consultava `conhecimento` no Firestore, mas chamava
o gateway sem UID. A allowlist bloqueava a geracao e devolvia trechos documentais.
Agora a propria rota atribui `{publico: "visitante"}` internamente. O corpo
continua aceitando apenas `pergunta`; nao aceita identidade, contexto, modelo,
provedor, URL ou chave. Nenhum UID ficticio precisa ser cadastrado.

Com o opt-in publico ativo, a resposta passa pelo mesmo Gemini via OpenRouter:
moderacao, proposta fundamentada, revisao editora e moderacao final. Fontes,
validacao local, protecao de dados, ZDR e fallback continuam ativos. A revisao
pode corrigir ou reprovar uma resposta sem suporte. Nao ha acesso ao Gemini
direto, OpenAI ou demonstracao sintetica por essa liberacao.

## Configurar no Render

1. Disponibilizar a versao atual do codigo pelo processo habitual do projeto.
   Esta tarefa nao faz push nem deploy. No servico do backend, manter Root
   Directory vazia e os comandos:
   - Build: `npm --prefix functions ci --include=dev && npm --prefix render-poc run build`.
   - Start: `node render-poc/server.cjs`.
2. Em **Environment**, adicionar `SYLVINHO_IA_VISITANTE_ENABLED=true`.
   Manter `SYLVINHO_IA_ENABLED=true` e `SYLVINHO_IA_PROVIDER=openrouter`.
3. Preservar `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` que ja funcionam no chat
   autenticado. A chave fica somente no painel do Render, nunca no frontend
   ou no chat. Nao e necessario criar arquivo `.env`: o servico le as variaveis
   do processo e nao carrega dotenv automaticamente.
4. Continuam obrigatorios os atestados existentes, somente quando aprovados
   de fato e incluindo o uso publico: `SYLVINHO_IA_INSTITUCIONAL_APROVADA`,
   `SYLVINHO_IA_PRIVACIDADE_APROVADA`, `SYLVINHO_IA_MENORES_APROVADA`,
   `SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA`, `SYLVINHO_IA_ZDR_APROVADO`.
   O codigo nao altera esses valores nem dispensa endpoints ZDR.
5. Preservar as configuracoes de Firebase Admin e modo `documental` descritas
   em [OPENROUTER-ATIVACAO.md](OPENROUTER-ATIVACAO.md). Manter
   `ASSISTENTE_CORS_ORIGINS=https://tcc-ia-d8891.web.app,https://tcc-ia-d8891.firebaseapp.com`.
   Nao alterar a porta fornecida pelo Render nem ampliar CORS com wildcard.
6. Salvar as variaveis e aplicar a nova versao no Render. Esta mudanca e de
   backend: o frontend atual ja chama `/perguntarVisitante` e apresenta as fontes.
   Nao e preciso ativar login anonimo no Firebase ou incluir visitantes em
   `SYLVINHO_IA_UID_ALLOWLIST`; essa lista continua controlando contas logadas.

## Verificar

- Abrir o chat `/Chat/chat.html` em janela anonima, sem conta conectada.
- Perguntar, por exemplo, "Como faco para renovar minha matricula?".
- Para uma resposta documental gerada com sucesso, conferir nos logs
  `BUSCA_CONCLUIDA`, `CONTEXTO_PREPARADO`, `PROPOSTA_RECEBIDA`,
  `REVISAO_APROVADA` ou `REVISAO_CORRIGIDA` e `SYLVINHO_IA GERADA`.
  A resposta deve mostrar a explicacao e permitir consultar as fontes.
- `VISITANTE_IA_DESATIVADA`: falta a nova flag ou seu valor nao e `true`.
  `VISITANTE_PROVEDOR_INVALIDO`: o provider nao e `openrouter`.
  `UID_NAO_AUTORIZADO` na rota publica sugere codigo antigo ainda em execucao;
  na rota autenticada continua indicando UID fora da allowlist.
- Falta de credito, limite, timeout e revisao reprovada continuam aparecendo
  como codigos seguros. `/health` confirma apenas o servidor HTTP, nao a IA.
- O chat e temporario: nada e salvo em `users` ou conversas. A rota autenticada
  continua exigindo token, propriedade da conversa e controle de duplicatas.
- Para desligar apenas a IA publica, definir `SYLVINHO_IA_VISITANTE_ENABLED=false`.
  Visitantes voltam ao modo documental; contas autorizadas continuam funcionando.

## Limites e validacao local

O endpoint publico mantem 30 perguntas/minuto e ate 4 requisicoes simultaneas
por processo. Visitantes e contas usam a mesma instancia do gateway: uma
geracao por vez e `SYLVINHO_IA_MAX_POR_MINUTO` (padrao 5, permitido 1..20)
geracoes/minuto no total. Cada resposta bem-sucedida pode consumir quatro
chamadas OpenRouter. `SYLVINHO_IA_TIMEOUT_MS` (padrao 20000, maximo 30000)
abrange as quatro chamadas; a busca documental ocorre antes desse prazo.
O navegador aguarda ate 120 segundos, inclusive a partida do Render.

Esses limites sao locais, reiniciam com o processo e nao sao um teto financeiro
distribuido. CORS nao autentica clientes externos. O operador deve considerar
esse consumo publico ao definir o limite de gastos da chave no OpenRouter;
nenhuma configuracao de conta ou contratacao foi feita nesta tarefa.

Os testes usam Firestore e transporte OpenRouter simulados, incluindo sucesso,
revisao, gates, corpo adulterado, limites, erros, cancelamento por timeout e
isolamento da rota autenticada. O teste de integracao do servidor usa streams
HTTP em memoria, sem abrir portas. Creditos, rede, IAM e a resposta real do
modelo precisam da verificacao no ambiente publicado.

O endpoint legado exportado em `functions/src/index.ts` permanece documental;
a IA publica descrita aqui pertence ao backend Render configurado no frontend.

Validacao desta alteracao: build do Render/TypeScript e lint aprovados;
489 testes passaram, sem falhas ou casos pulados, incluindo 25 novos casos
de IA publica, 16 do chat de visitantes, autenticacao, historico, propriedade,
replay e integracoes HTTP locais. Foram atualizadas expectativas antigas de
testes para a versao institucional atual (respostas locais fora do escopo ou
sem fontes nao sao marcadas como geradas). Nenhuma inferencia real foi feita.
