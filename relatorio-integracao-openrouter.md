# Entrega: Sylvinho + Gemini via OpenRouter

Implementado em 'tcc-etec-assistente-ia`, em 26/10/2026.
As alterações estão nos arquivos locais, sem commit, push ou deploy. O estado inicial
estava limpo; os arquivos de destino foram conferidos novamente antes da aplicação.

## Implementação

- Novo adaptador fetch nativo para Chat Completions, independente do contrato Responses
  da OpenAI, com moderação, proposta e verificação por Gemini via OpenRouter.
- Instruções e schemas compartilhados com o Gemini existente; validação documental,
  citações e resposta de fallback preservadas. Nenhuma nova dependência.
- Gateway aceita `openrouter`, ID com barra e segredo somente no backend. Não permite
  controlar modelo, chave, URL ou identidade autorizada pelo corpo da requisição.
- ZDR e JSON Schema obrigatórios em todas as chamadas. Falhas, recusa, créditos,
  limite, JSON, truncamento, timeout e cancelamento produzem códigos sanitizados.
- Allowlist Firebase preservada. Aprovações seguem falsas nos exemplos e não são
  herdadas do Gemini direto. Visitante continua documental.
- Firebase Admin, CORS, transações, propriedade das conversas e idempotência mantidos.
- Demonstração separada continua Gemini direto, não foi migrada e não funciona com
  `provider=openrouter`; o teste confirma ausência de chamada acidental.
- Documentação Render reescrita conforme o código atual, exemplos completos e
  roteiro de ativação/rollback abaixo. Frontend só teve um comentário corrigido;
  endpoint e interface permanecem iguais. E-mails e banco não foram alterados.

`server.cjs`, `config.cjs`, `producao.cjs`, `handler.ts`, `contrato.ts` e o fluxo de
busca foram inspecionados. Seus contratos já suportavam esta composição; não foi
necessário alterar autenticação, persistência, porta, rotas ou busca.

## Arquivos alterados

Caminhos relativos à raiz do projeto indicada acima. São 18 arquivos:

- `functions/.env.example`
- `functions/src/assistente/geracao/gateway.ts`
- `functions/src/assistente/geracao/gemini.ts`
- `functions/src/assistente/geracao/instrucoes.ts`
- `functions/src/assistente/geracao/openrouter.ts`
- `functions/src/assistente/visitante.ts`
- `public/Logado/Home/assistente-config.js`
- `render-poc/.env.example`
- `render-poc/OPENROUTER-ATIVACAO.md`
- `render-poc/README.md`
- `render-poc/documental.cjs`
- `render-poc/package.json`
- `render-poc/test/adapter.test.cjs`
- `tests/assistente-handler.test.mjs`
- `tests/assistente-producao.test.mjs`
- `tests/fixtures/matricula-sintetica.cjs`
- `tests/openrouter-geracao.test.mjs`
- `tests/openrouter-render.test.mjs`

## Validação final

Executada no projeto real com Node **24.22.1**:

| Verificação | Resultado |
| --- | --- |
| Instalação pelo lockfile, depois build via render-poc | Aprovado; compilação de functions concluída. |
| Lint completo de functions | Aprovado. |
| Regressão selecionada | **702 testes aprovados, zero falhas**. |
| Testes novos OpenRouter | **64 testes**, incluídos nos 702. |
| Diff/whitespace e comparação dos arquivos aplicados | Aprovados. |
| Consulta pública de catálogo e endpoints ZDR | Realizada sem chave e sem inferência. |
| Chamada real ao OpenRouter | **Não realizada**. |
| Firebase real, IAM/Rules implantados e latência remota | **Não validados**. |

A regressão cobre sucesso, quatro chamadas exclusivamente OpenRouter, erros HTTP
inclusive 402/429, falha embutida em HTTP 200, cancelamento antes/durante transporte
ou leitura, timeout total, JSON/schema inválido, gates, chaves ausentes, visitante,
CORS, token inválido, tentativa de mudar provedor pelo corpo, propriedade, histórico,
replay e requisições simultâneas. Provedores e Firebase foram simulados; o teste de
Render usa HTTP real apenas em loopback. Não foram usados dados reais de alunos.

Comandos de build e lint:

```sh
npm --prefix functions ci --include=dev
npm --prefix render-poc run build
npm --prefix functions run lint
```

Comando exato da regressão selecionada (Node 24):

```sh
node --test --test-skip-pattern='formato real gerado a partir da amostra oficial local' tests/openrouter-*.test.mjs tests/openai-*.test.mjs tests/gemini-*.test.mjs tests/assistente-handler.test.mjs tests/assistente-producao.test.mjs tests/assistente-client.test.mjs tests/pergunta-livre-fluxo.test.mjs tests/fundamentacao-*.test.mjs tests/chat-visitante.test.mjs tests/conversation-store.test.mjs tests/envio-pendente.test.mjs tests/auth-flow.test.mjs tests/home-assistente.test.mjs tests/resposta-documental-view.test.mjs tests/session-navigation.test.mjs render-poc/test/*.test.cjs
```

O teste chamado **“formato real gerado a partir da amostra oficial local e reconhecido”**
foi explicitamente excluído porque `tests/dados/rag-original.json`, ignorado pelo
Git, não está presente. Ele não está contado nos 702. As demais suítes específicas
do corpus original e os testes com emuladores/serviços reais também não foram
validados. Não se fabricou a amostra nem se consultou Firestore para obtê-la.
Os testes gerais de contrato que dependiam dela agora têm uma fixture sintética
versionada; suas asserções de autenticação, histórico e CORS foram preservadas.

A auditoria online apontou uma vulnerabilidade alta preexistente em
`firebase-functions -> express -> body-parser@2.3.0`
([GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)).
O lockfile não foi alterado. O servidor Render usa seu próprio leitor Node HTTP;
a revisão da dependência nos demais caminhos continua pendente. O resultado
“0 vulnerabilidades” da instalação posterior em modo offline não substitui essa
auditoria online.

## Pendências reais

1. Operador cadastrar chave OpenRouter e credencial Firebase autorizada diretamente
   no Render, conferir crédito/quota, IAM e origens reais.
2. Responsáveis registrar decisões institucionais, de privacidade, menores,
   modalidade OpenRouter/Gemini e ZDR antes de mudar qualquer aprovação para true.
3. Selecionar UIDs autorizados e, em uma publicação futura autorizada, validar uma
   chamada real com conteúdo de teste, consumo, latência, histórico e logs seguros.
4. Disponibilizar o snapshot local aprovado caso seja necessária a regressão do
   corpus original; revisar a vulnerabilidade transitiva antes da publicação.

A integração está **implementada e testada com simulação**. Não está declarada
**validada com chamada real ao OpenRouter**. O roteiro completo e todas as
variáveis seguem abaixo.

---

# Gemini pelo OpenRouter: ativacao controlada

Implementado localmente e testavel com transporte simulado. Nenhuma chamada
real de inferencia, credencial, deploy, push ou alteracao do banco faz parte
desta entrega. Aprovar uma flag nao cria contrato, conta, credito ou permissao.

## Fluxo migrado e elegibilidade

`public/` (Firebase Hosting) -> Firebase Authentication -> Node no Render ->
Firebase Admin/Cloud Firestore -> busca documental -> gateway -> Gemini pelo
OpenRouter. O endpoint externo e fixo:
`https://openrouter.ai/api/v1/chat/completions`.

Quatro chamadas sequenciais por pergunta bem-sucedida: classificar entrada,
propor resposta com evidencias, revisar proposta e classificar resposta final.
Todas usam o mesmo `OPENROUTER_MODEL`, `response_format=json_schema`,
`strict=true`, `provider.zdr=true`, `data_collection=deny`,
`require_parameters=true` e `allow_fallbacks=false`. Sem ferramentas/plugins,
retries automaticos ou troca para Gemini/OpenAI diretos. Schema local, numeros,
negacoes e citacoes literais continuam verificados. O baseline documental
integral permanece no resultado. Moderacao por modelo nao e garantia de seguranca.

O modelo de exemplo e `google/gemini-3.5-flash-lite`. Na consulta publica de
2026-10-26, seu catalogo listava saida textual, `response_format`,
`structured_outputs` e `max_tokens`, com endpoints `google-vertex/global`,
`google-vertex/eu` e `google-vertex/us` tambem presentes na lista ZDR. Isso
confirma compatibilidade anunciada, nao disponibilidade para a conta ou sucesso
de inferencia. Reconfirmar no momento da ativacao. O `google/gemini-2.5-flash`
ainda anunciava JSON Schema, mas nao aparecia na lista ZDR consultada; por isso
nao foi escolhido no exemplo.

Referencias oficiais:
[catalogo do modelo](https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-lite/endpoints),
[endpoints ZDR](https://openrouter.ai/api/v1/endpoints/zdr),
[JSON estruturado](https://openrouter.ai/docs/guides/features/structured-outputs),
[roteamento](https://openrouter.ai/docs/guides/routing/provider-selection),
[politica ZDR](https://openrouter.ai/docs/guides/features/zdr) e
[erros](https://openrouter.ai/docs/api_reference/errors-and-debugging).

O validador aceita IDs explicitos `google/gemini-...`, incluindo a barra,
letras minusculas, numeros, pontos e hifens (ate 150 caracteres). Rejeita URLs,
rotas extras, routers, outros fabricantes e variantes `:online` que poderiam
habilitar recursos nao aprovados. Modelo nao tem default oculto. Trocas sao
feitas somente no ambiente do servidor, nunca por campos do corpo HTTP.

## Variaveis exatas no Render

Abrir o Web Service -> **Environment -> Environment Variables -> Add Environment
Variable**. Cadastrar `OPENROUTER_API_KEY` diretamente ali; nao enviar no chat,
nao inserir no frontend, Git, arquivo de exemplo, comando ou captura de tela.
A aplicacao nao carrega `.env` automaticamente. Os exemplos versionados deixam
segredos e allowlist vazios e aprovacoes falsas.

| Variavel | Valor/condicao |
| --- | --- |
| `NODE_VERSION` | `24` (runtime exigido pelo projeto). |
| `NODE_ENV` | `production`. |
| `SYLVINHO_POC_MODE` | `documental`; `health` nao oferece o assistente. |
| `SYLVINHO_DOCUMENTAL_ENABLED` | `true` somente para o backend Firebase ja autorizado. |
| `GCLOUD_PROJECT` | `tcc-ia-d8891`. |
| `FIRESTORE_DATABASE_ID` | `(default)`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/etc/secrets/sylvinho-firebase-admin.json`. |
| `SYLVINHO_SERVICE_ACCOUNT_EMAIL` | `sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com`. |
| `ASSISTENTE_CORS_ORIGINS` | `https://tcc-ia-d8891.web.app`; se necessario, adicionar `https://tcc-ia-d8891.firebaseapp.com` separado por virgula. Sem wildcard, barra final ou origem externa. |
| `SYLVINHO_DEMO_ACADEMICA` | `false` (ou ausente). O valor true e rejeitado neste modo. |
| `SYLVINHO_IA_PROVIDER` | `openrouter`. |
| `OPENROUTER_MODEL` | `google/gemini-3.5-flash-lite` como exemplo confirmado no catalogo; reavaliar termos/custo/disponibilidade. |
| `OPENROUTER_API_KEY` | Segredo real cadastrado exclusivamente no painel. Conta autorizada com credito/quota suficiente. |
| `SYLVINHO_IA_ENABLED` | Inicialmente `false`; `true` somente apos cumprir as condicoes abaixo. |
| `SYLVINHO_IA_UID_ALLOWLIST` | Inicialmente vazia; CSV privado com ate 20 UIDs Firebase autorizados, sem duplicatas ou itens vazios; cada UID aceita `[A-Za-z0-9_-]`, 1..128 caracteres. |
| `SYLVINHO_IA_TIMEOUT_MS` | `20000`; inteiro entre 1 e 30000, prazo TOTAL das quatro chamadas. |
| `SYLVINHO_IA_MAX_POR_MINUTO` | `5`; inteiro entre 1 e 20, por instancia, nao por usuario. |
| `SYLVINHO_IA_INSTITUCIONAL_APROVADA` | `false` ate autorizacao institucional documentada para este fluxo. |
| `SYLVINHO_IA_PRIVACIDADE_APROVADA` | `false` ate revisar minimizacao, transferencias de dados, avisos, retencao e consentimentos aplicaveis. |
| `SYLVINHO_IA_MENORES_APROVADA` | `false` ate revisar publico, termos, protecoes e encaminhamento humano. |
| `SYLVINHO_IA_ZDR_APROVADO` | `false` ate revisar a politica do intermediario e dos endpoints, inclusive cache implicito. Nao habilitar armazenamento opt-in de prompts no OpenRouter. |
| `SYLVINHO_IA_OPENROUTER_MODALIDADE_APROVADA` | `false` ate revisar especificamente OpenRouter + modelo Gemini + provedores finais e uso escolar. Aprovacao antiga do Gemini direto nao e herdada. |

`RENDER=true` e `PORT` sao fornecidas pela plataforma; nao sobrescrever.
Nao definir hosts de emulador no Render. `SYLVINHO_CREDENTIAL_SOURCE` e a conta
`...render-reader...` pertencem ao plano antigo `production-locked`; nao sao
requisitos deste modo. `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`,
`OPENAI_MODEL` e flags `SYLVINHO_IA_GEMINI_*` nao sao necessarias para OpenRouter.
Nao existe variavel para URL do provedor ou para dispensar ZDR.

Em **Environment -> Secret Files**, usar o arquivo autorizado existente com
nome `sylvinho-firebase-admin.json`; o Render o monta no caminho acima.
O codigo valida tipo, projeto, email e token_uri antes de inicializar Admin;
nao usa ADC pessoal. A conta precisa de IAM para ler conhecimento e ler/gravar
conversas. Admin ignora Firestore Rules; preservar escopo minimo e revisar
permissoes com o operador. Nenhuma credencial ou permissao foi criada aqui.
Ver [instrucoes oficiais do Render](https://render.com/docs/configure-environment-variables).

## Condicoes de ativacao

Todas as cinco aprovacoes devem ser `true` somente depois da decisao real.
Tambem sao obrigatorios enabled, provider reconhecido, allowlist valida e UID
proveniente de token Firebase verificado, modelo/chave validos e limites validos.
Visitante sem UID nunca chega ao provedor. O corpo HTTP nao pode liberar UID,
flag, modelo, chave ou URL, mesmo que contenha campos com esses nomes.

Mesmo habilitado, o fluxo so gera quando ha evidencias documentais suficientes,
fontes originais ativas, ausencia de bloqueio de minimizacao e capacidade local.
Qualquer falha de geracao preserva o fallback documental. ZDR indisponivel nao
autoriza enviar a outro endpoint sem essa garantia.

## Passo a passo do operador (nao executado nesta tarefa)

1. Revisar este diff e disponibilizar a versao aprovada no processo normal de
   publicacao. Configurar Root Directory vazia; build
   `npm --prefix functions ci --include=dev && npm --prefix render-poc run build`;
   start `node render-poc/server.cjs`; health check `/health`. O build precisa
   de `functions/`, mesmo quando o servidor esta em `render-poc/`.
2. Conferir as variaveis/Secret File no painel. Manter IA desativada, allowlist
   vazia e aprovacoes falsas enquanto faltarem decisoes. Em Environment,
   `Save only` salva variaveis sem deploy; elas passam a valer no proximo deploy.
   Salvar Secret File pode disparar deploy: executar apenas na janela autorizada.
3. Confirmar Auth, CORS e Firestore com conta de teste autorizada, conversa
   pertencente a essa conta e uma pergunta nao pessoal. Verificar resposta
   documental e uma unica resposta bot no historico. `/health` sozinho nao
   confirma nenhum desses servicos. Nao usar dados reais de alunos no ensaio.
4. Revisar politicas/termos/privacidade/publico e disponibilidade ZDR/JSON Schema.
   Cadastrar a chave pelo painel, escolher modelo, definir limite de gasto/quota
   na conta e registrar as aprovacoes reais. Inserir apenas os UIDs aprovados.
5. Quando a validacao real estiver autorizada, ativar `SYLVINHO_IA_ENABLED=true`
   e aplicar a configuracao pelo processo de deploy do operador. Fazer uma
   pergunta de teste com evidencia valida e sem dados pessoais. Usar novo
   `messageId`; repetir um ID ja respondido devolve historico sem nova IA.
6. Confirmar o aviso `Resposta gerada por IA`, fontes documentais preservadas,
   evento `SYLVINHO_IA GERADA` e uso do modelo no painel OpenRouter. HTTP 200
   tambem pode ser fallback. Confirmar consumo/latencia sem exportar perguntas
   ou documentos para logs. Um sucesso simulado nao valida credito, IAM ou rede.
7. Conferir visitante documental, UID externo documental, token invalido 401,
   origem externa 403 e replay sem bot duplicado. A demonstracao sintetica deve
   continuar indisponivel (catalogo 403) com `provider=openrouter`.
8. Rollback: definir `SYLVINHO_IA_ENABLED=false` e aplicar no servico; remover
   allowlist se necessario. Novas geracoes voltam ao documental. Respostas ja
   salvas permanecem no historico e no replay, sem migracao do banco.

## Diagnostico seguro

O Render registra `SYLVINHO_IA GERADA` ou `SYLVINHO_IA FALLBACK <codigo>`;
seguranca pode produzir tambem `SEGURANCA`. Nao registra UID, token, credencial,
pergunta, documento ou erro bruto do fornecedor. Nenhum endpoint publico expoe
configuracao, chave ou allowlist. O motivo fica apenas no log operacional.

| Codigo | Interpretacao |
| --- | --- |
| `UID_NAO_AUTORIZADO`, `IA_DESATIVADA`, `PROVEDOR_INVALIDO` | Identidade/allowlist ou ativacao. |
| `APROVACAO_PENDENTE`, `MODALIDADE_PENDENTE`, `RETENCAO_BLOQUEADA`, `DADOS_BLOQUEADOS` | Gate de politica; modalidade legada continua separada. |
| `CONFIGURACAO_INVALIDA`, `OPENROUTER_MODELO_INVALIDO` | Modelo, prazo ou limite invalido. |
| `OPENROUTER_CHAVE_AUSENTE`, `OPENROUTER_AUTENTICACAO` | Segredo ausente/invalido localmente ou HTTP 401. |
| `OPENROUTER_SEM_CREDITOS`, `OPENROUTER_LIMITE` | HTTP 402 ou 429, sem retry. |
| `OPENROUTER_SEM_ENDPOINT_COMPATIVEL` | HTTP 404/503: modelo/roteamento/capacidade indisponivel. Pode incluir ausencia de endpoint ZDR/JSON Schema; o codigo nao prova a causa exata. |
| `OPENROUTER_RECUSA`, `OPENROUTER_INCOMPLETA` | Recusa/filtro ou finalizacao diferente de stop. |
| `OPENROUTER_JSON_INVALIDO`, `OPENROUTER_FORMATO_INVALIDO`, `OPENROUTER_SAIDA_EXCESSIVA` | JSON/envelope invalido ou limite de tamanho. |
| `OPENROUTER_TIMEOUT`, `OPENROUTER_CANCELADO`, `GERACAO_TIMEOUT` | Prazo/cancelamento da chamada ou prazo total. |
| `OPENROUTER_HTTP`, `OPENROUTER_INDISPONIVEL`, `GERACAO_INDISPONIVEL` | Demais erros HTTP, rede ou erro interno sanitizado. |
| `EVIDENCIAS_INSUFICIENTES`, `FONTES_INVALIDAS` | Contexto documental nao elegivel. |
| `OCUPADO`, `LIMITE_LOCAL` | Uma geracao por vez ou limite por minuto atingido. |
| `ENTRADA_INSEGURA`, `PROPOSTA_INVALIDA`, `REVISAO_REPROVADA`, `SAIDA_INSEGURA`, `SAIDA_EXCESSIVA` | Validacao de conteudo/contrato ou tamanho final. |

## Tempo, custos e validacao

Quatro chamadas compartilham 20 segundos por padrao (maximo 30 segundos).
Cada chamada limita saida a 2048 tokens, podendo incluir raciocinio conforme
modelo; truncamento leva ao fallback. A entrada inclui contextos na classificacao,
proposta e revisao, e a saida/documental na classificacao final: custo por
pergunta nao equivale a uma unica completion. Sem retries automaticos.

O adaptador possui limite defensivo de 30 segundos por chamada e respeita o
AbortSignal do gateway. O cancelamento conclui localmente mesmo com transporte
nao cooperativo; nao garante cancelamento/custo remoto. Recuperacao Firestore,
Auth, transacoes e cold start somam-se ao prazo IA. O frontend publicado usa
120 segundos; esse prazo nao e garantia de disponibilidade ponta a ponta.

Os testes novos usam fixtures sinteticas, transporte simulado e Firebase em
memoria; incluem cadeia Render real com HTTP loopback, quatro chamadas,
falhas, gates, CORS, propriedade, historico, concorrencia, replay e visitante.
Nao validam servicos remotos, Rules/IAM implantados, saldo, termos ou latencia
real. O lint exige tambem arquivos preexistentes; um ajuste de quebra de linha
em `visitante.ts` corrige um erro de comprimento ja existente, sem alterar fluxo.

A demonstracao `functions/src/assistente/geracao/demonstracao.ts` continua sendo
Gemini direto e exige `provider=gemini`, catalogo fechado e dossie proprio.
Com OpenRouter, o teste confirma bloqueio antes de ler dossie ou criar cliente.
Nao apresentar esse fluxo como migrado. Scripts locais legados de ensaio Gemini
tambem nao foram migrados e nao devem ser usados para validar OpenRouter.

## Pendencias locais identificadas

O snapshot ignorado `tests/dados/rag-original.json` nao esta presente nesta
copia do projeto. Os testes gerais de handler, entrypoint e adaptador HTTP
agora usam `tests/fixtures/matricula-sintetica.cjs`, sem enfraquecer as assercoes
de Auth, transacao ou CORS. A regressao especifica da amostra real permanece
pendente e nao deve ser declarada validada com a fixture sintetica.

A auditoria das dependencias ja fixadas detectou `body-parser` transitivo com
severidade alta ([GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)).
Nenhuma dependencia foi adicionada ou atualizada nesta integracao. O servidor
Render usa Node HTTP e leitor de corpo proprio, mas o risco da dependencia em
outros caminhos deve ser revisado em manutencao especifica antes da publicacao.
