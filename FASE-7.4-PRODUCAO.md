# Fase 7.4 - Function preparada, sem publicacao

## Codigo e escopo

Criados functions/src/assistente/gemini.ts, http.ts,
tests/assistente-producao.test.mjs e este documento.
Modificados functions/src/index.ts, functions/package.json e package-lock.json.
Fases7.2/7.3 permanecem byte a byte intactas.
Nenhum frontend, Rules, firebase.json, .firebaserc ou dado real foi alterado.
Sem consulta Firebase, leitura de credenciais, geracao real, secret remoto ou deploy.

Exportacao unica: perguntarAssistente, Functions v2 onRequest.
setGlobalOptions({maxInstances: 10}) preservado.
Admin default inicializado uma vez, sem projectId/credenciais hardcoded.
getAuth/getFirestore() usam o app default e o database default do ambiente.
O projeto oficial e tcc-ia-d8891 conforme .firebaserc; antes de publicar, confirmar
explicitamente projeto/database e inventario remoto mediante nova autorizacao.
O adapter cria dependencias depois do controle CORS; secret/SDK sao lazy.
O handler7.3 mantem autenticacao, UID, conversa e transacao; RAG V1 inalterado.

## Gemini e incompatibilidade TypeScript

Dependencia unica adicionada: @google/genai2.17.1, fixa, resolvida pelo npm.
Modelo preservado: gemini-2.5-flash. Sem nova temperatura/configuracao.
Mesmo contents user/parts e prompt/pergunta do JS original.
Resposta valida permanece intacta; vazia/invalida ou erro vira falha generica.
Nenhuma mensagem/causa SDK, token, contexto ou secret e enviada ao cliente/logada.
Testes usam apenas valores sinteticos efemeros e mocks; nunca credenciais reais.

As declaracoes do SDK2.17.1 referenciam @modelcontextprotocol/sdk opcional ausente.
Importacao estatica dessas declaracoes falhou no build. Solucao local:
carregamento CommonJS lazy com createRequire de node:module e facade minima.
Nao se adicionou MCP, nao se alterou skipLibCheck/tsconfig ou versao do SDK.
A fachada depende de testes/compatibilidade da API usada; futuras atualizacoes
do SDK exigem revalidacao, nao sao automaticamente seguras.

## Secret: apenas declaracao e vinculo

defineSecret("GEMINI_API_KEY"), vinculado somente a perguntarAssistente
em secrets:[geminiApiKey]. value() somente durante geracao.
Nao ha dotenv, fallback para chave do projeto antigo ou valor no codigo.

Comando futuro, NAO executado, apos autorizacao de alteracao remota:
firebase functions:secrets:set GEMINI_API_KEY --project tcc-ia-d8891
Usar entrada interativa; nao colocar o valor na linha de comando/documentacao.
Confirmar permissoes/IAM, custos e requisitos do Secret Manager/Functions
antes de configurar. Nao habilitar billing, migrar chave ou mudar tier automaticamente.

## Regiao: decisao e compatibilidade

Preparada explicitamente southamerica-east1 (Sao Paulo), mesma localizacao
Firestore indicada em firebase.json, para proximidade entre Function e banco.
Backend JS anterior usa onRequest({cors:true}) sem regiao explicita;
o padrao documentado e us-central1 na ausencia de outra configuracao.
Essa escolha NAO garante mesma URL nem substituicao de endpoint ja existente.
Nenhum inventario remoto consultado. Confirmar existencia/regiao atual e plano
de publicacao/migracao antes de deploy. Nao excluir endpoint antigo automaticamente.

## CORS: configuravel e restrito

ASSISTENTE_CORS_ORIGINS e defineString nao secreta com default vazio.
Lista de origens exatas separadas por virgulas, incluindo esquema/porta,
sem paths, wildcard ou correspondencia por sufixo/subdominio.
HTTPS aceito; HTTP somente localhost/127.0.0.1/[::1] para teste local.
Nenhum dominio Hosting foi assumido ou configurado nesta fase.

Com lista vazia, qualquer Origin do navegador retorna403.
Sem Origin, clientes diretos ainda precisam Bearer token; CORS nao e autenticacao.
Origem permitida recebe Access-Control-Allow-Origin exato e Vary:Origin.
Sem cookies/Access-Control-Allow-Credentials.
OPTIONS valido:204, metodo solicitado POST, headers Authorization/Content-Type.
Preflight nao chama Auth/Firestore/secret/SDK.
Origem negada:403; preflight invalido:400; configuracao invalida:500 generico.
onRequest cors:false evita dupla politica; adapter implementa a politica acima.
POST autorizado conserva {resposta} e erros400/401/404/405/409/500 do handler.

Antes de publicar, confirmar URL Hosting/custom domain e configurar somente
essas origens no parametro nao secreto. Pode ser provisionado futuramente
por configuracao parametrizada local do Firebase CLI; nao gravar chave ali.
Nao usar '*' temporariamente para fazer funcionar. Hosting nao recebeu rewrite.

## Validacao e pendencias

Testes compilados executam gateways/adapters reais com SDK/Admin/entrypoint
mockados. Importacao real de index.ts/secret e chamadas externas nao ocorreram.
75 testes aprovados/0 falhos:22 novos,33 handler,17 paridade e3 suites existentes.
Build TypeScript aprovado. Lint dos dois modulos novos aprovado.
Entry index.ts preserva CRLF preexistente; lint normal acusa linebreak-style.
Diagnostico somente do entrypoint com essa regra desligada passa, sem alterar
configuracao. .eslintrc.js/erros antigos nao foram corrigidos.
Predeploy global continua bloqueado pela politica LF versus checkout CRLF;
resolver apenas mediante autorizacao futura, antes de publicar.

Continuam as limitacoes7.3: retries duplicam bot, abas concluem fora de ordem,
troca de sessao nao cancela request e perda HTTP apos commit esconde sucesso.
Nada disso foi otimizado nesta fase.

Antes de deploy: autorizacao separada, inventario/regiao/URL, politica CORS real,
secret/IAM, cota generativa/custos, bloqueio do lint predeploy, validacao controlada
de infraestrutura e depois publicacao restrita do endpoint. Frontend em etapa separada.
Nao confundir cota gratuita anterior de embeddings com cota/custo generativo.
Nenhum comando remoto de configuracao/deploy foi executado.

Fontes oficiais:
- https://firebase.google.com/docs/functions/config-env
- https://firebase.google.com/docs/functions/locations
- https://firebase.google.com/docs/functions/http-events
