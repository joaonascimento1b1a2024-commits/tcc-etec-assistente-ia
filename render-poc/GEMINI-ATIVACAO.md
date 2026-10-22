# Gemini: adaptador offline e publicacao controlada

## Estado e menor alteracao

O gateway existente seleciona `openai` ou `gemini` por
`SYLVINHO_IA_PROVIDER`. Ambos implementam `ProvedorGeracao`; o caminho OpenAI
nao foi substituido. O adaptador novo e `functions/src/assistente/geracao/gemini.ts`.
Nao reutiliza o gerador Gemini legado, que nao tem este contrato de seguranca.
Nenhum frontend, endpoint HTTP, autenticacao, persistencia ou RAG foi alterado.

A criacao e lazy, sem rede, SDK novo ou dependencia adicional. Gemini utiliza
REST `v1beta/models/{modelo}:generateContent`, chave no header `x-goog-api-key`
(nunca query string), `systemInstruction` separado dos dados e
`generationConfig.responseMimeType=application/json` com `responseJsonSchema`.
Nao envia historico, UID, IDs de conversa/mensagem, tokens Firebase ou metadados
internos de documentos. Envia pergunta, evidencias locais E1/E2/E3 e os contextos
necessarios para verificar condicoes e excecoes. Heuristicas de privacidade nao
sao anonimização garantida; evitar dados pessoais mesmo nos testes autorizados.

## Bloqueio de modalidade e termos

Os termos Gemini API consultados em 22/10/2026 proíbem clientes destinados ou
provavelmente acessados por menores de 18 anos. O Sylvinho e um produto escolar
com menores: NAO ha liberacao automatica para ativa-lo nesse produto, mesmo com
allowlist de um professor, filtros ou faturamento pago. Desenvolvimento offline
nao comprova elegibilidade. Qualquer modalidade alternativa (por exemplo Vertex
AI) exige avaliacao propria de termos, privacidade e autenticacao; este adaptador
NAO implementa Vertex AI.

`SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA` apenas atesta uma avaliacao documentada;
nao muda termos, publico, contrato ou permissões. Nao marcar true sem prova de
compatibilidade do uso concreto. As demais aprovacoes continuam obrigatorias. Retencao e avaliada por
provedor/modalidade conforme a secao abaixo; isso NAO libera transmissao. Uma aprovacao ZDR para OpenAI NAO comprova retencao zero
no Google. Ausencia de envio de historico ou de cache explicito NAO controla
retencao pelo provedor. A retencao efetiva deste ambiente Google NAO foi verificada.

## Configuracao futura (nenhuma variavel online foi alterada)

| Nome | Uso |
| --- | --- |
| SYLVINHO_IA_ENABLED | Ausente/false: apenas documental. Manter false na publicacao inicial. |
| SYLVINHO_IA_PROVIDER | openai ou gemini; ausente/desconhecido: documental. |
| GEMINI_MODEL | ID exato autorizado e disponivel, com JSON Schema. Sem default. |
| GEMINI_API_KEY | Segredo exclusivo do servidor, cadastrado pelo painel seguro, nunca no chat/Git/frontend. |
| SYLVINHO_IA_UID_ALLOWLIST | CSV privado de ate 20 UIDs Firebase autorizados. Vazio bloqueia todos. |
| SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA | Exige prova de compatibilidade do uso concreto com termos. |
| SYLVINHO_IA_INSTITUCIONAL_APROVADA | Autorizacao institucional documentada. |
| SYLVINHO_IA_PRIVACIDADE_APROVADA | Revisao efetiva de minimizacao, avisos, retencao e consentimentos. |
| SYLVINHO_IA_MENORES_APROVADA | Revisao do publico e salvaguardas; nao supera proibicao dos termos. |
| SYLVINHO_IA_ZDR_APROVADO | Obrigatoria no OpenAI e no modo Gemini zdr (padrao). Nunca marcar para simular elegibilidade do gratuito. |
| SYLVINHO_IA_GEMINI_MODALIDADE | Ausente: zdr. demonstracao_publica reconhece modalidade restrita, ainda bloqueada por dados. Valor desconhecido bloqueia. |
| SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA | true somente com reconhecimento documentado de retencao, uso para melhoria e possivel revisao humana. NAO e autorizacao de envio. |
| SYLVINHO_IA_TIMEOUT_MS | Padrao 20000, inteiro 1..30000; prazo total, com AbortSignal. |
| SYLVINHO_IA_MAX_POR_MINUTO | Padrao 5, inteiro 1..20; limite por instancia, nao global. |

Nao ha fallback de chave ou modelo OpenAI para Gemini, nem troca automatica de
provedor. Variaveis OpenAI existentes permanecem intactas. Sem todas as aprovacoes,
allowlist e configuracao validas, o gateway nem cria o cliente Gemini. A
modalidade demonstracao_publica no gateway de TEXTO LIVRE tambem NAO cria
cliente. O caminho separado por IDs e comprovacao externa esta descrito abaixo.

## Validacao e limitacoes

Mantem as quatro etapas do contrato: classificar entrada, gerar proposta,
revisar fundamentacao e classificar saida. No Gemini as classificacoes usam o
mesmo modelo configurado com schema booleano estrito e filtros nativos em todas
as chamadas, quatro categorias em BLOCK_LOW_AND_ABOVE. NAO e equivalente ao
endpoint dedicado de moderacao da OpenAI, nem classificacao independente do
modelo gerador. Uma revisao pelo mesmo modelo pode repetir erros. Nao garante
adequacao a menores ou ausencia de alucinacoes.

O validador existente verifica IDs, citacoes literais, numeros e marcadores;
a resposta final conserva integralmente o baseline documental e suas fontes.
Propostas invalidas, recusa de seguranca, HTTP de erro, timeout, formato
inesperado, tools, resposta truncada ou excessiva retornam documental.
Mantem limite final de 2400 caracteres. Erros sao sanitizados, sem body, chave,
pergunta ou logs de identidade. Nao ha retries automaticos.

Uma geracao bem-sucedida usa quatro chamadas Gemini, inclusive classificacoes e
revisao; todas podem ter custo. Nao houve chamadas reais, verificacao de modelo,
cota, disponibilidade da conta ou estimativa monetaria confirmada. O parser aceita somente text, thought booleano e thoughtSignature textual
nao vazia nas partes. Assinaturas sao opacas e descartadas; partes thought=true
nao integram o JSON final. Campos desconhecidos, tools e ausencia de JSON final
continuam recusados. As chamadas sao independentes, sem reenvio de assinaturas
ou historico. Compatibilidade real do modelo ainda exige validacao autorizada.

## Roteiro Render: publicar inicialmente com IA desligada

1. Revisar o diff destes quatro arquivos, executar build/lint/testes offline e
   scanner. Solicitar autorizacao separada para commit, push, PR e merge.
2. Confirmar commit integrado e configuracao REAL de build no painel Render.
   O codigo local mostra que `render-poc/documental.cjs` carrega
   `functions/lib/assistente/geracao/gateway.js`; `render-poc/package.json`
   compila `../functions` e inicia `node server.cjs`. O tsc inclui o adaptador.
   Nao e necessario modificar o servidor. Nao afirmar que o painel foi consultado.
3. Antes do deploy autorizado, preservar release/commit atual para rollback e
   confirmar `SYLVINHO_POC_MODE=documental`. Manter IA desligada, allowlist vazia,
   aprovacoes nao comprovadas ausentes e nao cadastrar chave para esta publicacao.
4. Somente com autorizacao, executar deploy manual do commit aprovado no Render.
   Nao alterar Firebase Hosting, Firestore, regras ou IAM.
5. Verificar GET /health. Testes autenticados com gravacoes exigem autorizacao
   especifica. A publicacao desligada deve continuar retornando documental.

## Antes de uma demonstracao real

Resolver primeiro o bloqueio de termos/publico, retencao e autorizacoes. Confirmar
modelo com suporte aos schemas, conta, chave, cota, custo e limites. Somente depois
de autorizacao expressa cadastrar segredo seguro e flags comprovadas, configurar
provider/modelo e UID de teste. Nunca colar segredos ou UIDs no relatorio publico.

Com autorizacao de gasto e gravacao, utilizar conta de demonstracao e novos IDs
para uma conversa exclusiva; testar resposta com fontes, falta de evidencia e
replay do mesmo messageId. Replays existentes devolvem resposta persistida sem
regerar, portanto nao servem para demonstrar a troca de provedor. Nao excluir
conversas automaticamente. Em erro, interromper; nao tentar mudar provedor ou
repetir gravações. Desativacao futura por flag/rollback requer autorizacao propria.

Referencias oficiais:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/terms

## Politica demonstrativa: reconhecida, mas transmissao bloqueada

A exigencia universal de ZDR era uma politica conservadora do projeto. O caminho
OpenAI permanece integralmente igual: exige ZDR mesmo se variaveis Gemini forem
definidas. Gemini sem modalidade explicita tambem preserva o gate ZDR.

O modo demonstracao_publica distingue reconhecimento de retencao de comprovacao
de retencao zero. Os termos do gratuito permitem uso de entradas e respostas para
melhoria de produtos e revisao humana; nao enviar dados pessoais, sensiveis ou
confidenciais. Isso NAO comprova compatibilidade do produto com os termos de idade.
Uma allowlist/flag nao prova que o cliente nao e destinado a menores.

Estado implementado: a politica retorna demonstracao_bloqueada_dados e o gateway
registra somente SEGURANCA e FALLBACK, retornando documental antes de ler chave
ou criar cliente. Nao existe configuracao que libere TEXTO LIVRE nesse modo.
A extensao web abaixo usa catalogo fechado e nao passa por essa via bloqueada.

Motivo: perguntas livres e documentos publicos podem conter nomes ou dados
pessoais. Detectores heuristicos nao garantem anonimizacao; classificacao pelo
modelo ja exigiria transmitir a entrada. Alem disso, proposta gerada, sua revisao
e classificacao final produzem novos envios que tambem precisam de controle.
A lista de tres fontes documentais comprova escopo do RAG, nao publicidade ou
ausencia de dados pessoais em cada trecho.

Antes de liberar TEXTO LIVRE gratuitamente: implementar e revisar um mecanismo
para TODOS os payloads de saida, com proveniencia e escopo de dados revisados,
rejeicao de qualquer pergunta/trecho nao aprovado e tratamento do texto gerado
antes de reenvio. Manter o bloqueio onde nao houver garantia. Exigir avaliacao
real da elegibilidade etaria do cliente, autorizacao institucional, participantes
adultos e aviso explicito da retencao/revisao. A politica publicada de privacidade
nao autoriza envio de informacoes identificaveis a terceiros; nao basta um aceite
generico. Nenhuma dessas comprovacoes foi criada por esta implementacao.

Teste desta versao, somente offline: configurar valores sinteticos no mock para
demonstracao_publica com reconhecimento de retencao e sem ZDR. Confirmar resposta
documental e ZERO criacoes de cliente/leituras de chave, inclusive com texto
pessoal e chunk marcado confidencial. Repetir gates OpenAI, incluindo tentativa
de usar configuracao Gemini para dispensar ZDR: deve continuar bloqueado.
Nao executar teste real com texto livre nesse modo. Para IDs, a validacao
real exigira autorizacao separada, novos IDs, conta exclusiva e comprovacao do
evento GERADA junto ao consumo do provedor, nunca apenas HTTP 200.

Referencias: https://ai.google.dev/gemini-api/terms e
https://ai.google.dev/gemini-api/docs/usage-policies .

## Ensaio sintetico independente (sem Firestore, sem endpoint web)

`local-e2e/gemini-sintetico.mjs` permite testar o adaptador e os contratos com
uma pergunta e uma evidencia ficticias, fixas no codigo e identificadas como
sinteticas. Nao recebe pergunta livre, UID, chunks externos ou contexto HTTP.
Nao se vincula a fontes oficiais nem importa as fixtures no runtime publicado.
Nao le process.env, arquivos de credenciais, Firestore ou variaveis do Render.
Sem transporte, modelo e leitor de chave explicitamente fornecidos, bloqueia.
Nesta sprint so foi utilizado transporte mock, nunca fetch real.

As quatro cargas inspecionadas pelos testes sao: pergunta+contexto sinteticos;
pedido estruturado fixo com E1; mesmo pedido com proposta validada; texto final
validado. Antes de QUALQUER reenvio de texto gerado, exige contrato/citacoes
validos e vocabulario fechado de palavras sinteticas nao pessoais. Saidas com
nomes, emails, palavras externas ou referencias inventadas retornam apenas a
evidencia sintetica. Nao normaliza nem remove trechos para forcar aprovacao.
Isso limita parafrases; nao e classificador geral de privacidade ou semantica.
O mock produz proposta apenas para testar; nao e uma demonstracao de IA real.

Auditoria retorna somente codigos de etapa, contagem de bytes e ferramentas=0;
nao inclui headers/chaves, payloads, assinatura ou erro bruto. Timeout e falhas
interrompem sem retries. Os testes conferem as quatro cargas exatamente, com
bloqueio de rede. Nenhum log desse ensaio comprova chamada Gemini real.

Proximo teste real ISOLADO: exige autorizacao explicita de chamadas e avaliacao
de elegibilidade contratual do cliente de teste para adultos, uso do gratuito e
retencao/revisao humana. Segredo deve ser lido somente no servidor por mecanismo
autorizado; nao fornecer no chat ou criar comando que exponha seu valor. O helper
nao oferece CLI que execute fetch automaticamente. Nao modificar flags do gateway
para executa-lo. Resultado sintetico nao pode ser apresentado como regra escolar.

Para demonstrar no site com documentos Firestore, o bloqueio de dados do gateway
permanece: o ensaio fechado nao garante que perguntas/chunks reais sejam publicos
ou nao pessoais. Falta implementar e revisar a aprovacao verificavel dos dados e
de todos os reenvios gerados, antes de conectar DOCUMENTOS REAIS ao fluxo.
Isso nao bloqueia o catalogo sintetico fechado descrito abaixo. Nao exige refazer
frontend, Auth, historico, messageIds, RAG ou fallback; exige revisao propria dos
dados enviados e dos termos do cliente escolar. Nenhum endpoint separado foi
publicado: a extensao por IDs no endpoint existente esta descrita abaixo.

## Endpoint web: catalogo sintetico fechado (implementacao preparada)

Esta secao atualiza as limitacoes anteriores: texto livre no gateway normal
continua bloqueado em demonstracao_publica. Existe agora um caminho separado,
explicitamente solicitado por perguntaId, que nao recebe documentos ou pergunta
livre. Nenhuma fixture e misturada ao RAG oficial. Todas as respostas desse modo
exibem `Demonstracao sintetica; nao e informacao escolar oficial` (com acentos no
texto real), inclusive o fallback. O exemplo NAO comprova regras da ETEC.

Catalogo fixo em functions/src/assistente/geracao/demonstracao.ts:
- papel-experimental-v1: Qual papel utiliza o certificado experimental?
- cor-experimental-v1: Qual e a cor do papel do certificado experimental?

A evidencia E1 e fixa e totalmente sintetica. Nao sao usados IDs oficiais,
Firestore conhecimento, historico, UID ou dados pessoais em nenhum dos quatro
pedidos Gemini. A terceira/quarta chamadas so ocorrem depois de validar proposta,
citacao literal E1 e vocabulario fechado. Palavras externas, nomes, emails,
numeros ou referencias inventadas causam fallback antes do reenvio. Nao e um
anonimizador geral nem autoriza reutilizar o mesmo mecanismo com texto livre.

Contrato adicional no MESMO POST /perguntarAssistente:
`{"perguntaId":"papel-experimental-v1","conversationId":"ID_DA_CONVERSA","messageId":"ID_ESTAVEL"}`
Exatamente essas tres propriedades; pergunta, UID, chunks ou historico extras
sao recusados. Token Firebase valido em Authorization continua obrigatorio.
O UID do token e usado somente no servidor, para allowlist e caminho da conversa.
CORS permanece igual. Antes do POST, a pergunta canonica com o aviso sintetico
precisa estar salva como mensagem user com o mesmo messageId na conversa desse
usuario. O servidor nao cria conversas nem mensagens user. Depois, persiste apenas
o bot pela transacao e mecanismo de replay existentes. Pergunta salva divergente
retorna 409 sem geracao. Usuario nao autorizado, ID desconhecido, modo desligado
ou comprovacao ausente retornam 403 antes de ler a conversa ou criar o cliente.

Autorizacoes existentes continuam obrigatorias. Alem delas:
- SYLVINHO_IA_GEMINI_MODALIDADE=demonstracao_publica;
- SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA=true, somente apos revisao real;
- SYLVINHO_IA_GEMINI_DEMO_APROVACAO_SHA256: SHA-256 exato dos bytes do registro
  externo revisado pelo responsavel;
- arquivo do servidor /etc/secrets/sylvinho-gemini-demo-aprovacao.json. Nenhum
  arquivo de aprovacao real foi criado nesta implementacao.

Registro estrito esperado: versao=1, escopo=gemini_demo_sintetica_adultos,
catalogoSha256 (constante exportada CATALOGO_DEMO_SHA256), allowlistSha256
(SHA-256 dos UIDs separados por virgula, aparados e ordenados), termosRef,
privacidadeRef, instituicaoRef (referencias opacas a documentos de revisao reais,
8..100 caracteres alfanumericos, sublinhado ou hifen), somenteAdultos=true,
retencaoAceita=true, emitidoEm/expiraEm ISO. Prazo maximo de 24 horas; registro
futuro, expirado, com campos extras ou hash divergente bloqueia. Mudanca do
catalogo ou da allowlist exige novo registro revisado. Hash garante integridade,
NAO autenticidade da decisao nem comprovacao automatica da idade/termos. O
responsavel deve verificar os documentos referenciados e a elegibilidade REAL
do cliente; inventar referencias/JSON ou mudar flags nao constitui autorizacao.
Nao e uma excecao as condicoes do Google. Manter IA false sem essa comprovacao.

O caminho OpenAI permanece inalterado e exige ZDR. O modo Gemini zdr original
permanece separado; nao converter retencao gratuita em declaracao ZDR.
O novo modo tem limite por instancia, uma geracao concorrente e timeout total,
sem retries. Logs exclusivos: SYLVINHO_IA_DEMO GERADA ou FALLBACK, sem perguntas,
UIDs, assinatura ou credenciais. HTTP 200 pode ser fallback; conferir o aviso de
IA, evento GERADA e consumo da conta, com uma execucao isolada e IDs novos.

Publicacao futura, somente apos autorizacao: revisar/versionar a branch, publicar
backend no Render mantendo SYLVINHO_IA_ENABLED=false. A fabrica documental ja
instancia o novo modulo lazy; nao precisa mudar URL ou servidor de rotas. Apos
revisao externa, cadastrar o registro aprovado pelo canal seguro, seu hash e
configuracoes autorizadas. Nao modificar Firestore, regras, IAM ou frontend.
Nao alterar flags de aprovacao sem comprovacao. Modelo/quota e os termos do
cliente adulto ainda precisam de confirmacao. Nada foi configurado no Render.

Teste web futuro: conta demo adulta autorizada, conversa exclusiva, salvar o
texto canonico que resolverPergunta retorna e enviar somente seu ID pelo executor
controlado; verificar fonte sintetica e replay sem duplicacao. Falha deve encerrar
a validacao, sem repetir gravacoes automaticamente. A integracao de frontend preparada nesta branch esta descrita abaixo. O
site publicado nao muda ate o deploy autorizado; testes nao comprovam IA real.

## Selecao demonstrativa no chat existente (preparada, nao publicada)

A Home possui painel oculto por padrao. Apos login e restauracao do historico,
consulta POST /perguntarAssistente com somente {acao:catalogo_demonstracao},
JSON valido e token Firebase em memoria. Essa consulta e de descoberta: nao
le conversas/Firestore, nao instancia cliente Gemini e nao consome quota Gemini.
O servidor so retorna IDs e perguntas canonicas apos verificar gates, UID e
registro externo vigente; 401/403 ou falha mantem painel oculto. Nenhuma allowlist,
UID de autorizacao, chave ou referencia de aprovacao e retornada ao frontend.

Usuario autorizado seleciona uma pergunta e clica Enviar pergunta de demonstracao.
O texto livre e os atalhos normais continuam documentais. O painel nao usa o
conteudo de messageInput e nao permite edicao da pergunta canonica. Antes de
salvar user, consulta novamente o catalogo para revalidar a autorizacao. Salva
o texto canonico com aviso sintetico na conversa e envia exclusivamente
perguntaId, conversationId e messageId. O bot vem apenas do historico confirmado,
com fonte/aviso recebidos do backend; frontend nao persiste resposta por conta propria.

Pendencia demonstrativa guarda o ID do catalogo e o mesmo messageId no armazenamento
de sessao da conta, nunca token/chave. Recarga NAO repete geracao demonstrativa:
exige clique em Retomar demonstracao pendente depois de nova verificacao de acesso.
Pendencia diferente bloqueia nova pergunta; novo chat preserva o descarte explicito
existente. Troca de conta/logout cancela consulta e envio, limpa o catalogo da tela
e impede resposta tardia da conta anterior. Autorizacao expirada oculta o painel;
server-side continua sendo a unica barreira de seguranca efetiva.

Para uso futuro no site: revisar/versionar esta branch, autorizar publicacao do
backend primeiro com IA false, e depois Hosting. Sem alterar aprovacoes reais,
validar elegibilidade do cliente adulto, registro externo revisado, prazo e hash,
modelo/cota. Somente apos autorizacao expressa de ativacao, ativar o modo. Fazer
login na conta autorizada no proprio Sylvinho: o painel aparecera se a consulta
for autorizada. Selecionar ID, enviar uma vez, conferir aviso gerativo, fonte E1,
log SYLVINHO_IA_DEMO GERADA e consumo no provedor. HTTP 200 pode ser fallback.
Sem registros/aprovacoes comprovados, site continua documental e painel oculto.
Nao cadastrar segredo nem criar dossie ficticio para superar esse bloqueio.
