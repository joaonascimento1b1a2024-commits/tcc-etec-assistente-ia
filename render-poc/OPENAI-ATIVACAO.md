# OpenAI no Render — integracao local desativada

## Escopo implementado

A fabrica documental do Render injeta um gerador configuravel. O handler passa
um terceiro argumento interno com o UID do token ja verificado. A verificacao
Auth, consulta conhecimento, pergunta persistida antes do POST, conversationId,
messageId, transacao, replay e contrato `{resposta:string}` permanecem preservados. Nenhum endpoint novo, alteracao de frontend ou dependencia instalada.
O entrypoint Firebase Functions continua documental. Gemini nao e utilizado.

Com flags ausentes a resposta e exatamente a documental e a chave nao e lida.
Com habilitacao aprovada: minimizar -> moderar entrada -> gerar proposta JSON ->
validar referencias/numeros/condicoes -> revisar suporte contra TODOS os chunks
recuperados -> moderar saida -> retornar texto. Cada turno admite no maximo duas
chamadas Responses e duas Moderations, sem retries. Nenhuma etapa e mock no
adaptador real; os mocks existem exclusivamente nos testes.

## Variaveis (somente servidor)

| Nome | Valor ou finalidade |
| --- | --- |
| SYLVINHO_IA_ENABLED | Ausente/false mantem documental. true somente apos autorizacao. |
| SYLVINHO_IA_PROVIDER | openai |
| SYLVINHO_IA_UID_ALLOWLIST | Vazia/ausente bloqueia novas geracoes para todos. Lista CSV privada de UIDs autorizados. |
| OPENAI_MODEL | ID exato de modelo disponivel na conta, com Responses/Structured Outputs. Sem default. |
| OPENAI_API_KEY | Segredo de projeto OpenAI, cadastrar pelo painel seguro do Render. Nunca chat/Git/frontend. |
| SYLVINHO_IA_TIMEOUT_MS | Padrao 20000; inteiro entre 1 e 30000. Prazo TOTAL das quatro etapas externas. |
| SYLVINHO_IA_MAX_POR_MINUTO | Padrao 5; inteiro entre 1 e 20. Limite por instancia. |
| SYLVINHO_IA_INSTITUCIONAL_APROVADA | true somente com autorizacao institucional documentada. |
| SYLVINHO_IA_PRIVACIDADE_APROVADA | true somente apos revisar dados, avisos, consentimentos e retencao. |
| SYLVINHO_IA_MENORES_APROVADA | true somente apos revisar publico, filtros, comunicacao e escalonamento humano. |
| SYLVINHO_IA_ZDR_APROVADO | true somente apos confirmar ZDR efetivo no projeto/organizacao OpenAI. |

A politica inicial e conservadora: exige ZDR inclusive sem idade individual
conhecida. As flags apenas ATESTAM verificacoes do responsavel. Nao habilitam ZDR,
nao aceitam termos, nao verificam idade e nao criam autorizacao institucional.
Nao marcar flags ficticiamente para conseguir uma demonstracao.

## Menores e privacidade — bloqueios para ativacao

Documentacao oficial consultada em 22/10/2026:
- https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance
- https://developers.openai.com/api/docs/guides/your-data
- https://developers.openai.com/api/docs/guides/moderation
- https://developers.openai.com/api/docs/guides/structured-outputs

A orientacao Under-18 exige salvaguardas adicionais, incluindo filtros adequados,
comunicacao e mecanismos de monitoramento/escalonamento. Dados pessoais de criancas
abaixo de 13 anos ou da idade aplicavel de consentimento digital exigem primeiro
ZDR. `store:false` e a ausencia de historico nos pedidos NAO configuram ZDR nem
eliminam a retencao de monitoramento de abuso por si sos.

Pergunta e contextos podem conter dados pessoais mesmo sem UID. A heuristica
local bloqueia alguns nomes rotulados, contatos e injecoes, mas NAO anonimiza.
Somente a pergunta necessaria, citacoes e os chunks ja recuperados sao enviados;
nenhum UID, email de perfil, token Firebase, ID de conversa/mensagem ou historico.
Metadados originais ficam internos; nao ha busca web, ferramentas ou execucao.

O Render emite somente codigos GERADA/FALLBACK/SEGURANCA, sem perguntas, respostas,
identidades ou erros brutos. A instituicao precisa definir quem recebe alertas,
como escalar risco e como comunicar uso de IA. O codigo nao envia notificacoes
nem implementa verificacao de idade. A allowlist limita novas geracoes a UIDs
expressamente autorizados pelo operador; nao comprova idade ou consentimento.
Usuarios fora dela continuam no documental, sem chamadas externas.

## Fundamentacao e limites honestos

O validador local preserva referencias E1/E2/E3 e citacoes literais ja aprovadas
pelo gerador documental. Rejeita campos extras, HTML, referencias inexistentes,
numeros e marcadores criticos alterados. TODA a resposta documental original e
anexada, com fontes internas originais, inclusive contexto que a proposta nao citou.

Uma segunda chamada ao modelo revisa a proposta contra todos os chunks recuperados.
Isso e defesa adicional, NAO prova matematica de implicacao semantica. O mesmo
modelo pode errar nas duas chamadas. Preservar numeros/palavras ou usar JSON Schema
nao prova verdade nem completude normativa. Revisao humana e avaliacao real sao
obrigatorias antes de permitir uso escolar; nao prometer ausencia de alucinacoes.
A cobertura lexical atual do RAG permanece, inclusive recusas para sinonimos nao
mapeados, perguntas inesperadas e assuntos sem evidencia.

Saidas aprovadas comecam por 'Resposta gerada por IA; confira as fontes oficiais.'
Fallbacks retornam EXATAMENTE o texto documental, sem alegar sucesso generativo.
O renderer frontend pode apresentar o novo formato como texto integral seguro,
pois seu parser visual especializado reconhece apenas o formato extrativo antigo.
A UI nao foi alterada; conferir essa apresentacao no ensaio antes de publicar.

O timeout sinaliza AbortSignal. Cancelamento remoto/cobranca dependem do provedor;
nenhum retry automatico. Uma chamada pendente nao inicia etapas seguintes apos
abort. Limite de uma operacao simultanea e quota local por minuto nao sao teto
financeiro global; multiplas instancias podem executar chamadas faturaveis para
a mesma pergunta antes do replay persistido. O modelo pode consumir todo o limite
de tokens e gerar fallback. Configurar limites/custos na conta com o responsavel.

## Sequencia exata para um teste real futuro

1. Responsavel aprova instituicao, privacidade, publico e escalonamento; resolve
   idade/consentimentos. Identificar privadamente os UIDs de teste no Firebase
   Authentication e configurar a allowlist somente no Render, nunca no chat/Git.
2. No projeto OpenAI, confirmar faturamento/saldo, limites, acesso ao modelo atual
   recomendado para menores e suporte a Responses/Structured Outputs; confirmar
   ZDR efetivo e compatibilidade dos endpoints/features usados. Nao foi verificado
   nenhum desses itens da conta. ChatGPT pago nao comprova credito de API.
3. Revisar os arquivos e autorizar separadamente versionamento e publicacao.
   O build existente deve compilar functions/src antes de iniciar o Render.
4. Apos autorizacao de configuracao, cadastrar o segredo no Render pelo painel
   seguro; definir modelo/provider e limites. Manter SYLVINHO_IA_ENABLED=false e a
   allowlist vazia durante a publicacao inicial. Nenhuma chave e necessaria
   para publicar e validar o modo documental com IA desligada.
   Nao alterar a credencial Firebase ou ampliar IAM.
5. Publicar somente o backend apos autorizacao propria. Verificar /health e o
   comportamento documental enquanto a flag esta desligada.
6. So apos os controles reais estarem implementados, definir as quatro atestacoes
   como true, preencher exclusivamente os UIDs de teste autorizados e habilitar IA
   mediante autorizacao explicita. Essa alteracao pode
   reiniciar o servico. Nenhuma ativacao foi feita nesta etapa.
7. Autorizar um pequeno numero de chamadas reais e uma conversa exclusiva na conta
   de demonstracao. Perguntar livremente sobre frequencia/declaracao/matricula,
   comparar cada afirmacao/citacao com a fonte, testar ausencia de evidencia,
   indisponibilidade e replay do mesmo messageId. Verificar evento GERADA para
   distinguir inferencia aprovada de fallback. Nao registrar tokens/conteudo.
8. Se falhar, interromper testes e informar. Com autorizacao, desligar a flag para
   voltar ao documental; nao repetir gravacoes ou fazer rollback automaticamente.

## Validacao local

```powershell
npm --prefix functions run lint
npm --prefix functions run build
node --require ./local-e2e/network-guard.cjs --test tests/openai-geracao.test.mjs
```

Fixtures sao sinteticas e claramente separadas de producao. O transporte da API,
moderacao e verificacao sao simulados nos testes; nenhuma chamada paga ou consulta
real ao Firestore e feita. Nao ha validacao de qualidade de um modelo real ainda.

## Allowlist exclusivamente no backend

SYLVINHO_IA_UID_ALLOWLIST aceita ate 20 UIDs separados por virgula. Comparacao
exata e sensivel a maiusculas, com 1 a 128 caracteres alfanumericos, '_' ou '-'.
Espacos entre itens sao removidos; wildcard, duplicatas, itens vazios, lista
excessiva ou formato invalido bloqueiam TODOS. UID sem contexto autenticado nao
libera IA. O handler ignora uid/usuarioId/contexto enviados no corpo HTTP.
O UID interno nao e repassado ao pedido OpenAI nem aos logs tecnicos.

A allowlist governa NOVAS geracoes. Uma resposta ja persistida continua acessivel
por seu dono e retorna no replay sem regravacao, mesmo apos remover o UID da lista.
Nao apagar/recriar conversas para testar revogacao: usar uma nova pergunta somente
com autorizacao, preservando os dados anteriores. Nao preencher UIDs reais aqui.

## Matriz de ambiente existente (preservar; painel nao revalidado)

Valores exigidos pelo codigo, nao uma leitura das variaveis reais do Render:

| Nome | Valor esperado |
| --- | --- |
| SYLVINHO_POC_MODE | documental |
| SYLVINHO_DOCUMENTAL_ENABLED | true |
| SYLVINHO_DEMO_ACADEMICA | false |
| NODE_ENV | production |
| GCLOUD_PROJECT | tcc-ia-d8891 |
| FIRESTORE_DATABASE_ID | (default) |
| SYLVINHO_SERVICE_ACCOUNT_EMAIL | sylvinho-backend@tcc-ia-d8891.iam.gserviceaccount.com |
| GOOGLE_APPLICATION_CREDENTIALS | /etc/secrets/sylvinho-firebase-admin.json |
| ASSISTENTE_CORS_ORIGINS | https://tcc-ia-d8891.web.app |

RENDER=true e PORT sao fornecidos pela plataforma. Manter Node 24. Preservar o
Secret File existente; nao exibir seu conteudo nem reutiliza-lo como chave OpenAI.
Nenhuma variavel de emulador deve existir no servico publicado.

## Build e publicacao com IA desligada

Cadeia verificada localmente: server.cjs -> dependencias.cjs -> documental.cjs ->
functions/lib/assistente/geracao/gateway.js. O tsc inclui functions/src inteiro e
gera gateway/contratos/adaptador e o handler atualizado em functions/lib.
Compilados nao sao versionados: precisam ser gerados no build do Render.

Configuracao exigida para esse caminho (conferir manualmente no painel):
- Repositorio: joaonascimento1b1a2024-commits/tcc-etec-assistente-ia.
- Branch: commit/branch especificamente aprovado para publicacao.
- Root Directory: raiz do repositorio, vazio.
- Build: npm --prefix functions ci --include=dev && npm --prefix functions run build
- Start: node render-poc/server.cjs
- Health: /health; Auto-Deploy: manter Off durante a revisao.

As alteracoes continuam LOCAIS. Um deploy da main que nao contenha o commit futuro
nao publicara esta integracao. O painel real e o commit implantado nao foram
consultados por API autenticada nesta etapa. Confirmar esses campos antes do deploy.

Sequencia minima, sempre com autorizacoes separadas:
1. Revisar/versionar os arquivos de codigo e testes; confirmar commit remoto.
2. Configurar SYLVINHO_IA_ENABLED=false e deixar a allowlist vazia. Manter todas
   as atestacoes ausentes/false enquanto nao houver comprovacao. Nao exige chave.
3. Autorizar deploy MANUAL do commit exato e verificar o build e o commit servidos.
4. GET /health deve retornar 200; GET /perguntarAssistente deve retornar 405.
5. Em ensaio autorizado, confirmar modo documental para usuario fora da lista;
   nao deve haver evento GERADA nem chamadas OpenAI.
6. Antes de qualquer chamada paga: confirmar conta, modelo, ZDR e aprovacoes reais,
   cadastrar segredo pelo painel seguro, preencher somente UID(s) autorizados e
   pedir autorizacao especifica para habilitar e executar um teste limitado.
7. Autorizar uma conversa de teste. Fora da allowlist: HTTP 200 documental; dentro,
   com evidencia e todas as verificacoes aprovadas: HTTP 200 gerado com fontes.
   Repetir messageId deve retornar a mesma resposta, sem nova geracao/persistencia.
   Pergunta inesperada/sem evidencia permanece documental. Interromper no erro.

Compatibilidade frontend: HTTP permanece objeto com resposta string. O parser
visual antigo reconhece respostas extrativas; no novo formato generativo usa seu
fallback de texto integral, com textContent, sem interpretar HTML. As fontes e
texto completo continuam visiveis; os cartoes/expansores documentais nao sao
aplicados ao novo prefixo. Nenhum arquivo frontend foi modificado.
