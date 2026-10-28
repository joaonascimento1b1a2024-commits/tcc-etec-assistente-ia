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
| `ASSISTENTE_CORS_ORIGINS` | `https://tcc-ia-d8891.web.app,https://tcc-ia-d8891.firebaseapp.com` para os dois dominios oficiais. Sem wildcard, barra final ou origem externa. |
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

No fluxo OpenRouter autorizado, perguntas seguras podem chegar a IA mesmo sem
evidencias. Fatos e regras escolares exigem fontes; explicacoes gerais,
saudacoes e perguntas de esclarecimento nao exigem citacoes. Contextos privados
sao descartados integralmente; apenas a pergunta segura e enviada nesse caso.
Se a pergunta contiver identificadores detectados, o fluxo pede reformulacao
localmente, sem envio. ZDR indisponivel nao autoriza outro roteamento.

Falhas do provedor, rejeicao de resposta e limites, apos os gates, retornam
uma mensagem local de continuidade em vez de despejar trechos como se fossem
uma resposta. A mensagem local nao e identificada como gerada por IA. O modo
documental continua disponivel para visitantes, IA desativada e acessos sem
allowlist/aprovacoes; nos provedores legados, o fallback permanece documental.

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
6. Confirmar `SYLVINHO_IA_FLUXO conversa-v5` no log ao inicializar as
   dependencias documentais (primeira requisicao que as utiliza). Esse marcador
   identifica esta revisao do fluxo; nao comprova configuracao, saldo ou IA.
   Conferir tambem o commit do deploy. Usar nova mensagem, pois historico salvo
   nao e reprocessado. Confirmar aviso de IA ou orientacao geral, fontes apenas
   nas respostas documentais, evento `SYLVINHO_IA GERADA` e uso do modelo no
   painel OpenRouter. HTTP 200
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
| `ENTRADA_INSEGURA`, `REVISAO_REPROVADA`, `SAIDA_INSEGURA`, `SAIDA_EXCESSIVA` | Validacao de conteudo ou tamanho final. |
| `REVISAO_FORMATO_INVALIDO`, `REVISAO_CORRECAO_INVALIDA` | Decisao do revisor malformada ou resposta corrigida que falhou na validacao local. Conferir `motivoRevisao` no diagnostico. |
| `PROPOSTA_SCHEMA_INVALIDO`, `PROPOSTA_TEXTO_INVALIDO`, `PROPOSTA_REFERENCIA_INVALIDA` | Estrutura, afirmacao ou referencia rejeitada pela validacao local. |
| `PROPOSTA_VAZIA` | O modelo retornou afirmacoes vazias; conserva a resposta documental. |
| `PROPOSTA_CITACAO_DIVERGENTE` | A citacao retornada nao coincide exatamente com a evidencia enviada. |
| `PROPOSTA_NUMEROS_DIVERGENTES` | Na conversa-v5, a afirmacao introduz um numero ausente das citacoes. Nos caminhos legados, numeros tambem nao podem ser omitidos. |
| `PROPOSTA_CONDICOES_DIVERGENTES` | Comparacao literal de marcadores nos caminhos legados. Na conversa-v5, o revisor avalia o significado das condicoes, sem exigir palavras identicas. |

Versoes anteriores registravam apenas `PROPOSTA_INVALIDA` para esses casos.
Esse codigo antigo nao permite determinar retroativamente a causa exata e
nao indica, por si so, um problema na configuracao da conta OpenRouter.

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

## Diagnostico de privacidade atualizado

Perguntas gerais como “Como faço para renovar minha matrícula?” nao sao
bloqueadas apenas pelo possessivo. Identificadores preenchidos, declaracoes
pessoais e os demais filtros continuam sendo verificados. Esta heuristica
nao comprova ausencia de dados pessoais nem dispensa as aprovacoes.

`DADOS_BLOQUEADOS_PERGUNTA` indica bloqueio no texto enviado pelo usuario;
`DADOS_BLOQUEADOS_CONTEXTO` indica bloqueio em algum trecho recuperado. Se ambos
forem bloqueados, o codigo da pergunta tem prioridade. Nenhum conteudo e incluido
no log. `DADOS_BLOQUEADOS` permanece para a politica demonstrativa legada.
Mencoes genericas a RG, CPF e ao campo nome completo nao sao identificadores
preenchidos. Numeros de documentos, nomes rotulados e os demais padroes de
seguranca continuam bloqueados. Isso reduz falsos positivos, mas nao garante
que toda informacao pessoal sera reconhecida. Nao usar a heuristica como
substituto das aprovacoes ou da revisao dos dados.


## Perguntas curtas e qualidade das evidencias

A busca original preserva siglas de duas letras, como RG, RA e RM, tanto na
selecao dos chunks como na selecao das citacoes. Verbos de pedido como levar,
trazer, apresentar e entregar nao substituem o assunto da pergunta. Assim,
“Preciso levar RG?” nao deve selecionar um trecho so porque ele contem
“levar em consideracao”. A pontuacao utiliza a mesma canonicalizacao de termos
aceita pelo filtro documental; a busca legada V1 mantem sua tokenizacao.

Se nao existir evidencia pertinente, o fluxo OpenRouter pode gerar uma
explicacao geral, indicar a limitacao ou pedir esclarecimento. Se houver
evidencia, ainda deve verificar a pertinencia ao procedimento: uma regra de
transferencia nao comprova regra de rematricula. Perguntas curtas podem omitir
esse procedimento. O fluxo nao envia historico; a IA deve pedir o contexto
faltante, sem supor continuidade. Nenhuma configuracao autoriza inventar uma
regra escolar sem fonte.

Validacao local: testes sinteticos incluem perguntas com siglas, distratores,
termos canonicos e quatro chamadas OpenRouter simuladas, sem chamar Gemini
ou OpenAI diretamente. Isso nao equivale a validar respostas reais do modelo
ou a cobertura do corpus publicado. A regressao V1 depende do arquivo externo
original e a amostra documental depende do snapshot local descrito acima.


## Conversa e orientacao geral (conversa-v2)

O contrato estruturado possui os tipos documental, esclarecimento, sem_base,
geral, conversa e fora_escopo. O modelo analisa a pergunta, redige a resposta e
passa pela revisao independente e moderacao final. O tipo geral permite
explicacoes e calculos, com aviso visivel de que nao sao regras da escola.
Nao permite disfarcar exigencias institucionais sem fonte como dicas gerais.
A revisao semantica e feita por modelo; os testes simulados validam os controles
e contratos, nao garantem acerto de toda resposta real.

Nao ha flag nova nem necessidade de criar um .env no Render. Permanecem as
variaveis e aprovacoes da tabela anterior, cadastradas diretamente no painel,
sem compartilhar a chave no chat. Sem alteracoes na interface, no banco ou nos
emails. A geracao continua exclusiva pelo OpenRouter para usuarios autorizados.

A sequencia continua limitada a quatro chamadas: moderacao da entrada,
resposta, revisao e moderacao da saida. Sem retries ou chamadas extras para
reescrita. O prazo total, limite por minuto, tamanho final e roteamento ZDR
continuam iguais. O limite da mensagem conversacional passa a mil caracteres.

Verificacao apos publicar a versao aprovada, com conta autorizada e novos IDs:

- “Preciso levar RG?”: deve pedir o procedimento, sem apresentar exigencia de
  transferencia como regra geral. A formulacao depende da resposta do modelo.
- Pergunta completa sobre um procedimento presente nos documentos: resposta
  direta e referencias verificadas.
- “O que significa RG?” ou “Como organizar meus estudos?”: orientacao geral.
- Pergunta escolar cuja resposta nao existe na base: indicar a limitacao e
  oferecer um proximo passo, sem inventar prazo ou contato.
- Visitante permanece documental. Replay conserva a resposta original.

Testes locais usam somente corpus sintetico e transporte simulado. Nao houve
chamada paga nem verificacao do modelo real. O snapshot documental e o arquivo
externo V1 ausentes continuam limitando a regressao do corpus original.

Verificacao desta revisao: build e lint executados com Node 22.23.1 local;
o ambiente Render continua configurado para Node 24. Os testes da IA,
HTTP local, autenticacao, historico e idempotencia usam simulacoes. Dois testes
preexistentes de interface ainda esperam o link “Ver como funciona” e o aviso
academico removidos anteriormente; a interface nao foi alterada para reintroduzir
esses textos. O teste do corpus oficial continua ignorado quando falta a amostra.


## Erro de ambiente no frontend (dominio firebaseapp.com)

A mensagem “O assistente não está configurado para este ambiente. Nenhuma
pergunta foi salva.” ocorre antes de persistir a pergunta ou chamar o Render.
Nao e resultado de moderacao, privacidade ou geracao da IA. A configuracao do
frontend agora aceita exatamente os dois dominios oficiais do projeto, web.app
e firebaseapp.com, mantendo ambientes locais isolados.

Para aplicar esta correcao, publicar a versao atualizada do Firebase Hosting
pelo processo do operador. Um deploy apenas no Render nao atualiza o frontend.
Depois, recarregar a pagina para obter os arquivos atuais. No Render, configurar
Environment > ASSISTENTE_CORS_ORIGINS com o valor:

```text
https://tcc-ia-d8891.web.app,https://tcc-ia-d8891.firebaseapp.com
```

Aplicar a alteracao do ambiente no servico caso o alias ainda nao conste.
Isso habilita somente os dois dominios ja aceitos pelo validador do backend;
nao altera login, allowlist de usuarios, politicas de dados ou visitante.
Acessar a versao existente em https://tcc-ia-d8891.web.app pode contornar o
bloqueio do alias enquanto o Hosting nao recebe a correcao.

O log “Detected service running on port 10000” informa que o Render detectou
o servidor HTTP; sozinho nao comprova a chegada de uma pergunta ou chamada
OpenRouter. A pergunta bloqueada nessa etapa nao foi salva e pode ser enviada
apos corrigir o ambiente. Nao mudar IDs de perguntas que ja estejam pendentes.


Verificacao publica somente-leitura em 28/10/2026: o arquivo de configuracao
servido pelo Hosting ja continha a lista dos dois dominios; o preflight OPTIONS
do Render respondeu 204 para web.app e 403 para firebaseapp.com. Isso confirma
um bloqueio de CORS para o alias naquele momento. Nenhum token, pergunta,
credencial ou chamada de geracao foi enviado. O estado pode mudar depois que o
operador atualizar o ambiente; conferir novamente apos aplicar a configuracao.


## Comprovar leitura e envio dos documentos (conversa-v3)

O fluxo autenticado consulta `conhecimento` com `ativo == true` antes de gerar.
Essa leitura retorna chunks de texto, nao PDFs inteiros ou qualquer colecao do
banco. A selecao usa somente os tres `documentoId` de `FONTES_ORIGINAIS`, exige
pertinencia no corpo do texto e respeita o limite de cinco chunks/oito mil
caracteres. Arquivos somente no Storage ou registros inativos nao participam.
As citacoes elegiveis sao preparadas antes do pedido ao provedor.

O log `SYLVINHO_IA FALLBACK REVISAO_REPROVADA` sozinho nao comprova uso de fontes:
no modo conversacional, a IA pode responder tambem sem evidencia. Ele indica
que a proposta nao recebeu aprovacao na etapa revisora; tambem pode indicar
um contrato de revisao nao reconhecido. O texto de indisponibilidade e local,
nao e a resposta gerada pelo modelo. Nao e possivel recuperar a causa semantica
exata dos logs antigos, pois nao armazenamos perguntas, propostas ou contextos.

Esta revisao acrescenta `SYLVINHO_DIAGNOSTICO` com apenas codigos e contagens:

| Etapa/campo | Significado |
| --- | --- |
| `BUSCA_CONCLUIDA`, `lidos`, `selecionados` | Quantos chunks a consulta retornou e quantos passaram na selecao. Nao e o total de documentos do banco. |
| `BUSCA_FALHOU` | A consulta ou preparacao falhou; nao apresentar como base vazia. |
| `CONTEXTO_PREPARADO`, `contextos`, `evidencias` | Quantidades no pedido preparado, antes das chamadas. Nao prova envio bem-sucedido. |
| `PROPOSTA_RECEBIDA` | A etapa de proposta retornou; as contagens correspondem ao pedido enviado ao provedor. Nao comprova a correção ou compreensao semantica pelo modelo. |
| `REVISAO_APROVADA`, `REVISAO_CORRIGIDA` ou `REVISAO_REPROVADA`, `tipo` | Resultado da revisao e categoria da resposta validada (ou da proposta, em caso de recusa). A mesma linha informa as quantidades, uso de documentos e `motivoRevisao` no contrato atual. |
| `uso=DOCUMENTAL` | O pedido contem evidencias documentais. |
| `uso=SEM_EVIDENCIAS` | Nao ha citacoes elegiveis; a IA recebeu somente a pergunta para orientar ou esclarecer. |
| `uso=CONTEXTO_BLOQUEADO` | Trechos foram excluidos do envio pelo filtro de dados; a pergunta segura pode seguir. |

Exemplo ilustrativo dos logs antigos (v3) de uma resposta rejeitada apesar de ter recebido documentos:

```text
SYLVINHO_DIAGNOSTICO {"etapa":"BUSCA_CONCLUIDA","lidos":40,"selecionados":2}
SYLVINHO_DIAGNOSTICO {"etapa":"PROPOSTA_RECEBIDA","contextos":2,"evidencias":1,"uso":"DOCUMENTAL"}
SYLVINHO_DIAGNOSTICO {"etapa":"REVISAO_REPROVADA","contextos":2,"evidencias":1,"uso":"DOCUMENTAL","tipo":"documental"}
SYLVINHO_IA FALLBACK REVISAO_REPROVADA
```

Se lidos for positivo e selecionados zero, conferir o formato dos chunks,
`documentoId` permitido, titulo/secao e pertinencia a pergunta. A existencia do
registro no Firestore nao garante que ele passe nessa selecao. Se selecionados
for positivo e contextos zero, verificar uso: bloqueio de dados ou ausencia de
citacoes elegiveis. Se a proposta tiver contextos/evidencias positivos e a
revisao rejeitar, o problema esta depois da recuperacao; isso nao autoriza
concluir que falta conexao com o banco nem que a resposta deve ser liberada.

Aplicar pelo processo de publicacao do backend; nao ha nova variavel, endpoint,
consulta ao banco ou chamada paga adicional. Conferir `conversa-v5` e enviar uma
nova mensagem com conta autorizada, pois replay devolve a resposta ja salva sem
refazer busca/IA. Em requisicoes simultaneas, nao associar linhas apenas pela
proximidade: cada linha de revisao traz suas proprias contagens. Logs nao incluem
UID, IDs de conversa/documento, texto, chave, token ou erros brutos. Falhas do
logger nao alteram a busca ou a geracao.

Validado localmente com Firebase e transporte OpenRouter simulados, incluindo
revisao reprovada com documentos, base vazia, fonte nao admitida, privacidade,
erro de leitura, erro do provedor e replay. Nao foi inspecionado o conteudo do
Firestore real nem feita chamada de IA real nesta verificacao.

## Revisao que corrige e aceita sinteses (conversa-v5)

A v4 ja introduziu a revisao editora: o OpenRouter retorna `aprovar`, `corrigir`
ou `recusar`. Quando houver um ajuste possivel, o revisor devolve a resposta
completa corrigida, conferida contra as fontes, na mesma chamada. Se faltar
suporte documental, pode trocar a afirmacao por esclarecimento ou explicacao
pertinente do que falta confirmar. Nao ha aprovacao forcada de uma recusa.

A v5 elimina dois conflitos na validacao local desse fluxo: trocar `somente`
por `apenas` nao bloqueia uma parafrase; resumir uma evidencia nao obriga repetir
numeros de detalhes independentes da pergunta. O revisor continua responsavel
por identificar se a omissao muda o sentido, remove uma condicao relevante ou
atribui um numero ao procedimento errado. A validacao local ainda exige
citacoes exatas, IDs conhecidos, formato correto e ausencia de numeros novos
e dados pessoais detectaveis. Os validadores dos caminhos legados permanecem
literais. Essas regras locais, isoladamente, nao autorizam publicar uma resposta.

O resultado aprovado ou corrigido passa pela moderacao final antes de `GERADA`.
Continuam quatro chamadas, sem nova tentativa: moderacao de entrada, proposta,
revisao editora e moderacao final, dentro do mesmo prazo total. Uma recusa
concreta, correcao invalida ou timeout ainda leva ao fallback.

`motivoRevisao` identifica a decisao com codigos fechados: `SEM_PROBLEMA`,
`CLAREZA`, `SEM_SUPORTE`, `CONTRADICAO`, `CONDICAO_RELEVANTE`, `ESCOPO_INCORRETO`,
`PERGUNTA_AMBIGUA` ou `SEGURANCA`. Para erros de contrato, informa
`FORMATO_INVALIDO` ou o motivo da validacao da correcao, como
`PROPOSTA_CITACAO_DIVERGENTE`. Nao grava justificativa livre ou conteudo enviado.

Exemplo sintetico de uma condicao recuperada pelo revisor:

```text
SYLVINHO_IA_FLUXO conversa-v5
SYLVINHO_DIAGNOSTICO {"etapa":"REVISAO_CORRIGIDA","contextos":1,"evidencias":3,"uso":"DOCUMENTAL","tipo":"documental","motivoRevisao":"CONDICAO_RELEVANTE"}
SYLVINHO_IA GERADA
```

Para verificar no Render, publicar o commit que contem a v5 usando os comandos
de build/start acima, conferir o marcador e enviar uma nova mensagem com conta
autorizada. Nao ha nova variavel nem necessidade de alterar o frontend. Um log
`conversa-v3` identifica o fluxo anterior; sua recusa booleana nao permite saber
retroativamente a causa semantica. As contagens positivas de contextos e
evidencias em `PROPOSTA_RECEBIDA` indicam que a proposta recebeu documentos.

Os testes simulam a pergunta de renovacao com um contexto e tres evidencias,
aprovacao de parafrase, correcao de condicao, pedido de esclarecimento, recusa
por contradicao, correcao invalida, moderacao final e timeout. Usam apenas
fontes e transporte sinteticos; nao medem qualidade semantica do modelo real.
Nenhum deploy ou chamada real ao OpenRouter faz parte desta verificacao local.

Verificacao local em 28/10/2026 com Node 24.22.1: build do Render (que compila
functions) e lint aprovados; 567 testes de IA/busca/fundamentacao aprovados,
incluindo 29 cenarios novos de revisao e persistencia da resposta corrigida
com replay sem duplicacao. Os quatro testes HTTP inicialmente impedidos pela
restricao de conexao local passaram apos habilitar esse recurso. Na verificacao
adicional de acesso/historico/visitante, 95 de 96 passaram. A falha preexistente
e de uma expectativa de link na pagina inicial: o teste exige `./Chat/chat.html`,
enquanto o HTML ja usa `Chat/chat.html`. Nenhuma dessas duas partes foi alterada.
