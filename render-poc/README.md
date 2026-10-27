# Backend Sylvinho no Render

O estado atual do codigo ja inclui Firebase Admin, busca documental, historico
transacional e geracao opcional. Este README substitui a descricao antiga de
POC exclusivamente mockada; nao afirma que houve deploy ou validacao online.

## Arquitetura atual

- Firebase Hosting serve `public/`; Firebase Authentication fornece o ID token.
- O navegador chama `/perguntarAssistente` no Node HTTP do Render com Bearer.
- Firebase Admin valida o token e usa Cloud Firestore: `conhecimento` para busca
  e `users/{uid}/conversas/{conversationId}` para historico.
- `documental.cjs` compoe `pergunta-livre/fluxo` e `geracao/gateway` compilados
  de `functions/`. Nao importa `functions/lib/index.js`.
- O gateway pode selecionar OpenRouter, Gemini direto ou OpenAI. Ao selecionar
  `openrouter`, moderacao, proposta, verificacao e moderacao final usam somente
  Gemini via OpenRouter; falhas voltam ao documental, sem outro provedor.
- `/perguntarVisitante` nao recebe contexto UID e permanece documental.
- A demonstracao sintetica de `geracao/demonstracao.ts` usa Gemini direto,
  exige suas proprias aprovacoes e `provider=gemini`. Nao esta migrada e fica
  indisponivel com `provider=openrouter`. `SYLVINHO_DEMO_ACADEMICA` e outro
  mecanismo de fixtures, rejeitado no modo documental real.

O frontend ja aponta para
`https://sylvinho-backend-poc.onrender.com/perguntarAssistente` e usa 120 segundos
no ambiente publicado. URL configurada nao comprova disponibilidade remota.
Nenhum segredo ou configuracao de provedor deve ir para `public/`.

## Modos

| Modo | Comportamento |
| --- | --- |
| `health` (padrao) | Apenas `/health`; demais rotas 404; sem Admin, Firestore ou IA. |
| `documental` | Auth/Firestore reais quando configurados; geracao opt-in conforme gates. |
| `production-locked` | Plano antigo de identidade de leitura, acesso sempre bloqueado. Nao usar para ativar IA. |
| `emulator`, `documental-emulator` | Projeto `demo-sylvinho-render-poc`, loopback; proibidos no Render. |
| `auth-diagnostic`, `firestore-diagnostic`, `rag-diagnostic` | Diagnosticos locais com emuladores; nao sao endpoints de readiness online. |

`GET /health` retorna `{status: "ok", service: "sylvinho-backend"}` sem criar
Admin, ler credenciais ou chamar IA. Um 200 comprova somente o processo HTTP.
Firestore/Auth devem ser verificados pela requisicao autenticada e persistencia;
a IA exige resposta gerada e evento `SYLVINHO_IA GERADA`.

## Build, testes e inicializacao

Usar Node 24, a partir da raiz do repositorio:

```sh
npm --prefix functions ci --include=dev
npm --prefix render-poc run build
npm --prefix functions run lint
node --test tests/openrouter-*.test.mjs tests/assistente-handler.test.mjs tests/openai-allowlist.test.mjs tests/gemini-geracao.test.mjs tests/pergunta-livre-fluxo.test.mjs tests/chat-visitante.test.mjs render-poc/test/*.test.cjs
node render-poc/server.cjs
```

Sem variaveis, o servidor inicia em `health`. Nenhum destes comandos publica.
O script `test` da raiz ainda e um placeholder; usar os comandos acima.
`npm --prefix render-poc test` executa todos os testes locais da pasta.
Testes com emuladores precisam ser executados separadamente, com projeto demo
e bloqueio de rede externa; nao fazem parte da validacao simulada OpenRouter.

No Render, manter Root Directory vazia (raiz do repositorio), pois `render-poc/`
depende da pasta irma `functions/`. Configuracao:

- Build: `npm --prefix functions ci --include=dev && npm --prefix render-poc run build`.
- Start: `node render-poc/server.cjs`.
- Runtime: Node 24 (`NODE_VERSION=24`). Health Check Path: `/health`.
- Preservar `PORT` fornecida pelo Render, com bind `0.0.0.0`.
- Sem variaveis de emulador, ADC pessoal ou credencial Firebase inline.

Ver [OPENROUTER-ATIVACAO.md](OPENROUTER-ATIVACAO.md) para a lista completa de
variaveis, aprovacoes, cadastro de Secret File, verificacao e rollback.
Os guias OpenAI/Gemini existentes descrevem provedores diretos legados.

## Garantias e limites

CORS usa origens exatas HTTPS; token Firebase e propriedade da conversa sao
validados no backend. `messageId` vincula pergunta salva e resposta. Repeticoes
na mesma instancia compartilham a geracao; a transacao evita bot duplicado
entre instancias, mas duas instancias ainda podem gerar/cobrar antes do commit.

O limite de corpo e 16 KiB. `requestTimeout=30000` limita o recebimento da
requisicao HTTP, e nao todo o processamento. `headersTimeout=10000` limita
cabecalhos. Geracao tem deadline proprio total de ate 30 segundos. Busca e
transacoes Firestore nao tem deadline global adicional neste adaptador.
O frontend publicado aguarda 120 segundos, incluindo rede e inicializacao.
Nao ha garantia de conclusao nesse prazo durante cold start ou falha Firestore.

Limites de IA sao por processo (uma geracao concorrente, ate cinco por minuto
por padrao). Nao substituem quota global, controle de gastos ou revisao de
privacidade. Classificacao por modelo e verificacoes locais nao garantem
seguranca semantica. Nenhuma aprovacao foi concedida por esta implementacao.

Referencias oficiais consultadas em 2026-10-26:
[Render monorepos](https://render.com/docs/monorepo-support),
[Environment e Secret Files](https://render.com/docs/configure-environment-variables),
[OpenRouter JSON Schema](https://openrouter.ai/docs/guides/features/structured-outputs),
[OpenRouter ZDR](https://openrouter.ai/docs/guides/features/zdr).
