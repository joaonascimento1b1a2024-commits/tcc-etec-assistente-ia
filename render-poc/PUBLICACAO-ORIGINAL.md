# Publicacao do RAG original — roteiro coordenado (nao executado)

## Estado local

Backend: `node render-poc/server.cjs`, Node 24. Build no Render, raiz do repositorio:
`npm --prefix functions ci --include=dev && npm --prefix functions run build`.
O build compila tambem os modulos existentes de avisos/e-mail; nao publicar Functions.
Start: `node render-poc/server.cjs`. Health check: `/health`.
Nenhum build ou teste faz deploy. Endpoint do frontend continua vazio, timeout 120s.
URL preparada (informada pelo responsavel):
`https://sylvinho-backend-poc.onrender.com/perguntarAssistente`.
Nao ativar apenas porque `/health` responde.

Em producao, `documental.cjs` liga explicitamente o leitor original e o gerador
compilados. O leitor consulta conhecimento ativo, filtra as tres fontes fixas antes
no ranking/contexto e nao grava documentos. Auth valida ID Token, deriva UID e
limita o historico a users/{uid}/conversas/{conversationId}; transacao revalida a
conversa e deduplica a resposta por messageId. Nao usa Gemini nem o snapshot local.

Diferenca do E2E: o teste usa snapshot com SHA-256 e Auth/Firestore emulados. No
Render a identidade dedicada acessa o Firestore real e os certificados publicos do
Auth. O teste HTTP Node usa a fabrica real com SDKs mockados, nao prova IAM online.
O cache/snapshot nao deve ser enviado ao Render como substituto da base real.

## Configuracao manual futura no Render — exige autorizacao

Confirmar servico `sylvinho-backend-poc`, branch/revisao, Auto-Deploy Off e commands.
Nao presume estado privado do painel. Aplicar somente depois da revisao autorizada:

```
SYLVINHO_POC_MODE=documental
SYLVINHO_DOCUMENTAL_ENABLED=true
SYLVINHO_DEMO_ACADEMICA=false
NODE_ENV=production
GCLOUD_PROJECT=tcc-ia-d8891
FIRESTORE_DATABASE_ID=(default)
SYLVINHO_SERVICE_ACCOUNT_EMAIL=sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/sylvinho-firebase-admin.json
ASSISTENTE_CORS_ORIGINS=https://tcc-ia-d8891.web.app,https://tcc-ia-d8891.firebaseapp.com
```

RENDER=true e PORT sao fornecidos pela plataforma. Sem variaveis de emulador,
NODE_OPTIONS, ADC pessoal, tokens da CLI, chaves inline ou GEMINI_API_KEY.
Secret File: `sylvinho-firebase-admin.json`; conteudo somente no mecanismo privado
aprovado do Render. Nao gerar/copiar chaves nesta etapa e nunca coloca-las no chat,
Git, frontend, logs ou exemplos. Confirmar existencia/validade desse Secret File
manualmente; nao foi possivel verifica-lo neste lote. Sem ele, manter health.
O codigo exige a conta dedicada exata e rejeita a flag academica ficticia.
O frontend aceita os dois dominios oficiais; manter ambos no CORS quando
forem usados para acessar o assistente. Nao usar wildcard.

## IAM — confirmar atribuicao existente, nao ampliar automaticamente

Permissoes correspondentes ao codigo atual:

- datastore.databases.get: operacoes do banco/transacoes.
- datastore.entities.get: ler conversa e documentos.
- datastore.entities.list: query da base conhecimento.
- datastore.entities.update: transacao que atualiza conversa existente.

Nao ha criacao de conversa pelo Admin, nem escrita de conhecimento; nao precisa
entities.create/delete ou papéis Owner, Editor, Firebase Admin. Verificar a conta
sylvinho-backend e o papel customizado sylvinhoDocumentalRuntime condicionado ao
banco (default), conforme contexto informado. A atribuicao efetiva nao foi
reconsultada. IAM de banco nao limita colecoes: a identidade pode ter alcance maior
que cada usuario; o isolamento por UID depende tambem do backend. Nao ha necessidade
de permissoes administrativas de Authentication para verifyIdToken comum.
Regras de cliente nao restringem o Admin SDK. Nenhuma regra/IAM foi alterada.

## Sequencia futura — nenhuma etapa online executada

1. Reconfirmar main remota, branch e diff; revisar `render-poc/commit-original.json`.
   Criar commit(s) somente dos caminhos explicitos, apos scanner e diff staged/check.
   Excluir snapshots, credenciais e caches. Enviar branch, abrir PR e revisar;
   merge apenas com autorizacao separada, preservando o historico.
2. Manter frontend desconectado e Render Auto-Deploy Off. Anotar revisao/configuracao
   anterior; confirmar Secret File, identidade e IAM existentes, sem ampliar acesso.
3. Mediante autorizacao, fazer deploy manual da revisao validada no Render com os
   parametros acima. Testar health e endpoint autenticado com conta de demonstracao;
   testar 401/404, CORS, fonte original e replay do mesmo messageId. Nao importar dados.
4. Somente apos esses testes, autorizar configurar assistenteConfig.endpoint com a
   URL preparada. Revisar e versionar esse pequeno ajuste; nao reutilizar bootstrap
   emulado. Antes de publicar, confirmar Auth e regras efetivamente publicadas.
5. Publicar somente Hosting, sob autorizacao: `firebase deploy --only hosting --project tcc-ia-d8891`.
   Nao publicar Functions, indices ou regras junto. Se uma incompatibilidade de
   regras surgir, interromper; eventual deploy de regras e outra autorizacao.
6. Testar duas contas de demonstracao, cinco perguntas documentadas, duas recusas,
   reabertura, reload, recuperacao, isolamento e indisponibilidade. Nao enviar dados
   pessoais nas perguntas. O prototipo nao e atendimento oficial da escola.

## Reversao

Anotar commit/release/configuracao anteriores antes de cada publicacao. Para parar
novas geracoes, retornar Render a SYLVINHO_POC_MODE=health e
SYLVINHO_DEMO_ACADEMICA=false (remover/zerar enable documental); reiniciar/deploy
controlado exige autorizacao. Health deve responder 200 e outras rotas 404, sem
inicializar Admin. Nao apagar conversas nem limpar pendencias/sessionStorage.
Pedidos em andamento podem concluir antes do reinicio: verificar historico por
messageId antes de tentar novamente. Nao trocar IDs para forcar reenvio.

Se frontend ja estiver conectado, publicar uma revisao compativel com endpoint
vazio ou restaurar release previamente confirmado compativel com messageId e regras
atuais. Nao restaurar frontend antigo incompatível nem enfraquecer regras.
Falha de credencial/permissao: interromper, manter health, apresentar erro sanitizado.
Nao gerar nova chave ou ampliar IAM como correcao automatica.

## Arquivos e reproducibilidade

O manifesto e uma selecao explicita, nao executa git add. Runners locais podem ser
versionados para regressao, mas nao sao entrypoints de producao. Os 40 chunks da
amostra e o snapshot integral sao somente locais e ignorados; os testes documentais
exigem esses insumos aprovados. Ausencia deles deve ser registrada, nao simulada
como aprovacao. Build do Render nao depende desses dados. A instalacao limpa via
npm ci nao foi repetida neste lote; compilacao e testes usam dependencias existentes.

Componentes antigos de fixtures permanecem isolados: demo-academica, leitor de demo
emulado e runners legados. Producao documental os rejeita. Avisos do prototipo fica
sem dados e sem consulta institucional; a demonstracao anterior permanece em ramo
explicito isolado. Cartoes de equipe de exemplo permanecem em template nao exibido.
Nao foi verificada vigencia documental nem configuracao privada atual do Render.
Render Free pode apresentar partida fria/indisponibilidade; a Home preserva o ID e
orienta recuperacao, sem produzir resposta artificial. Testar isso online antes da banca.
