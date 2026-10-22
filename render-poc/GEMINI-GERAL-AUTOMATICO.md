# Gemini geral automático — modalidade separada, desativada

## Resultado e alcance

O backend local aceita perguntas gerais diferentes e paráfrases SEM catálogo,
perguntaId, lista de entradas ou aprovação individual. Reutiliza o handler, o
adaptador Gemini e a persistência existentes. Não modifica o frontend.
Perguntas institucionais continuam no RAG; sem evidências, não inventa regras.
Não é ativação de perguntas escolares livres para envio de documentos ao Gemini.

Esta implementação NÃO habilitou produção, alterou aprovações ou criou um registro
aprovado. Os registros dos catálogos anteriores não liberam este novo escopo.

## Requisitos do provedor versus escolhas do projeto

Fontes oficiais consultadas:
- https://ai.google.dev/gemini-api/terms
- https://ai.google.dev/gemini-api/docs/billing

Não há nessas condições exigência geral de revisar cada pergunta. A aprovação por
entrada era uma escolha conservadora da implementação, não uma limitação da API.

Free: candidato para demonstração de desenvolvimento compatível, somente adultos,
região permitida e sem informações pessoais/sensíveis/confidenciais. Pode haver
uso de entradas/saídas para melhoria e revisão humana. Não garante elegibilidade
só porque a banca é adulta. Cliente dirigido/provavelmente acessado por menores
não se torna compatível apenas por ter allowlist.

Paid: não usa prompts/respostas para melhoria de produtos segundo os termos, mas
mantém monitoramento de abuso; não equivale a ZDR. Restrições etárias e demais
condições continuam aplicáveis. Este código não habilita nem exige faturamento
pago universalmente e não modifica a conta Google.

Escolhas do projeto, não exigências universais do Google: allowlist de até 20 contas,
registro privado com SHA-256 e validade máxima de 24h, flags de aprovação e seleção
de modalidade. Os experimentos locais de entrada revisada não integram esta publicação.
Nenhuma aprovação por pergunta é exigida neste modo automático.

Controles técnicos: Auth Firebase, pergunta persistida antes do POST, moderação,
filtros nativos, limites/timeout, sem ferramentas, sem histórico/IDs/documentos no
provedor, validação JSON estrita, bloqueio local de sinais pessoais e conteúdo
institucional, revisão de vigência antes de cada envio e antes de aceitar a saída.
Logs não contêm prompt, resposta completa, identidade, chave ou token.

Limitações: os detectores e o roteamento são heurísticos; podem errar nos dois
sentidos e NÃO garantem anonimização nem compreensão de todo conteúdo escolar.
A revisão da modalidade precisa avaliar se os controles e a orientação efetiva
dos participantes atendem ao escopo e ao plano. Se não atenderem, não aprovar o
modo. O registro não deve afirmar garantia que o software não oferece.

## Conta/projeto/plano — o que foi efetivamente verificado

- Informado pelo responsável nesta etapa: o projeto da chave usada no Render está
  no plano Free. Não houve consulta direta a billing ou ao conteúdo da chave.
- Responsável ainda precisa confirmar modelo/cota disponível. Não se inferiu que a
  conta Firebase e o projeto ao qual a chave Gemini pertence sejam o mesmo.
- GET público /health retornou status ok, service sylvinho-backend. Isso comprova
  alcance do backend, não cota, elegibilidade, chave nem geração Gemini.
- Elegibilidade contratual e privacidade do uso AUTOMÁTICO precisam de revisão
  específica; aprovações do catálogo sintético não foram estendidas.

Conferência manual sem segredos: no AI Studio, Projects, localizar o projeto usado
pela chave do Render; verificar Billing Tier. Em Usage/Rate limits, selecionar o
modelo configurado e confirmar acesso/quota. Informar só Free/Paid e disponível/
indisponível; não copiar chave, dados de pagamento, UIDs ou identificadores de conta.
GEMINI_API_TIER é uma declaração de configuração do Sylvinho, NÃO consulta nem altera
o billing real. Um arquivo/ref/flag por si só não comprova os fatos declarados.

## Configuração futura — nenhuma aplicada

Preserva GEMINI_API_KEY, GEMINI_MODEL, SYLVINHO_IA_ENABLED,
SYLVINHO_IA_PROVIDER=gemini, SYLVINHO_IA_UID_ALLOWLIST, os gates existentes de
modalidade/privacidade/instituição/público e reconhecimento de retenção.
Preserva SYLVINHO_IA_GEMINI_MODALIDADE=demonstracao_publica neste caminho.
Não marca SYLVINHO_IA_ZDR_APROVADO nem altera OpenAI ou catálogo.

| Variável | Uso |
| --- | --- |
| SYLVINHO_IA_GEMINI_GERAL_ENABLED | Ausente/false mantém o caminho novo desligado. |
| SYLVINHO_IA_GEMINI_GERAL_MODO | automatico para esta política. Ausente ou outro valor bloqueia o novo caminho. |
| GEMINI_API_TIER | free ou paid; precisa corresponder ao plano real e ao registro. Não contrata plano. |
| SYLVINHO_IA_GEMINI_GERAL_AUTOMATICO_SHA256 | SHA-256 dos bytes do registro de revisão da modalidade. Não é hash de pergunta. |
| SYLVINHO_IA_TIMEOUT_MS | Mantido, padrão 20000, 1..30000. |
| SYLVINHO_IA_MAX_POR_MINUTO | Mantido, padrão 5, 1..20 perguntas por instância/caminho. Não é teto global de gasto. |

Secret File novo, não criado:
`/etc/secrets/sylvinho-gemini-geral-automatico.json`.

Contrato do registro de modalidade, para preenchimento real pelo responsável:
- versao: 1; escopo: gemini_geral_automatico; modelo: o modelo verificado.
- plano: free ou paid, confirmado no projeto correto da chave.
- allowlistSha256: digest dos UIDs privados aparados, ordenados, unidos por vírgula.
- somenteAdultos, dadosNaoPessoais, semHistorico, semDocumentos: decisões verdadeiras
  sobre o escopo e o sistema; não alegações de detecção perfeita de todo texto.
- tratamentoDados: melhoria_revisao_humana para free, ou
  sem_treinamento_monitoramento para paid. Nunca declarar ZDR sem comprovação.
- emitidoEm/expiraEm: ISO, vigência até 24h; revogado: false só enquanto vigente.
- termosRef, elegibilidadeRef, privacidadeRef, instituicaoRef,
  contaProjetoPlanoRef, orientacaoParticipantesRef, controlesRef: referências reais
  às avaliações e orientações específicas do uso automático. Podem apontar seções
  da mesma revisão real; não inventar documentos para preencher os campos.

Não há entradas, perguntas, hashes de conteúdo ou respostas prontas neste registro.
O transporte compara o corpo com a requisição montada em memória para evitar troca
interna de pergunta/schema; isso é integridade, não aprovação prévia da pergunta.

## Fluxo e teste autorizado

1. Responsável confirmar modelo/cota e concluir revisão da modalidade, incluindo
   restrição efetiva de acesso adulto e orientação para não inserir dados pessoais.
2. Depois de autorização para publicação: isolar diff, commit/PR/merge e publicar
   apenas o backend Render com GERAL_ENABLED=false; Hosting não precisa mudar.
3. Preservar SHA/release Live para rollback. Não atualizar flags no mesmo passo.
4. Somente após evidências válidas e autorização de ativação: fornecer registro
   verdadeiro e configurações pelo canal seguro do Render. Manter demais controles.
5. Teste real exige autorização específica de chamada/gravação: login manual de
   adulto aprovado, uma conversa exclusiva e uma pergunta geral não sensível.
   Por exemplo, digitar uma pergunta nova sobre algoritmos, sem registrá-la no arquivo.
6. Esperar HTTP 200, resposta com marcador de IA geral e evento
   SYLVINHO_IA_GERAL GERADA. Conferir uso do modelo na API: duas chamadas por pergunta
   bem-sucedida (moderação + geração). Não copiar corpos, headers ou tokens.
7. Com a mesma política vigente, uma paráfrase diferente deve funcionar sem editar
   o registro. Pergunta escolar segue ao RAG com fontes/recusa conforme evidências.
8. Erro/cota/timeout: interromper o teste, não repetir gravações automaticamente.

Histórico/idempotência são os existentes. Respostas não são reenviadas ao provedor.
A validação geral não é prova factual; não apresentar conteúdo geral como norma ETEC.
Cada instância tem seu limite; uma corrida entre réplicas pode gerar antes do commit,
embora a transação evite duplicar o bot no histórico, como já ocorria.

Rollback autorizado: GERAL_ENABLED=false desliga só este caminho; se houver regressão
no código, republicar a release/SHA anterior preservada. Não excluir histórico,
conhecimento, usuários ou credenciais. Nenhum deploy/rollback foi executado.

## Publicacao e rollback desta PR

Base main preservada: 13e1d193b8ad2cfd054554efcadd51661d7a203e.
Esse SHA e a referencia Git anterior; a release realmente Live deve ser conferida
no painel Render antes de publicar. Nao foi possivel inspecionar o painel nesta
sessao; nao se presumiu que o SHA-base seja a release atual.

Ultimo modelo informado pelo responsavel: gemini-3.5-flash-lite. O codigo nao
possui modelo padrao: usa GEMINI_MODEL. O valor atualmente salvo no Render e
a disponibilidade/cota desse modelo na conta nao foram confirmados diretamente.
Conferir o valor nao secreto no Render e o mesmo projeto/modelo no AI Studio.

A PR exclui frontend, revisao humana por pacote, nova colecao Firestore, mudancas
de regras/IAM, experimentos de qualidade RAG e diagnosticos nao necessarios.
O modo documental, o catalogo sintetico e OpenAI/ZDR publicados sao preservados.

## Variaveis existentes exigidas na ativacao (preservar na publicacao desligada)

- SYLVINHO_IA_ENABLED=true e SYLVINHO_IA_PROVIDER=gemini.
- GEMINI_MODEL: valor do Render a confirmar; ultimo informado gemini-3.5-flash-lite.
- GEMINI_API_KEY: segredo do servidor existente; nao copiar nem cadastrar no Git.
- SYLVINHO_IA_UID_ALLOWLIST: contas adultas autorizadas, CSV privado.
- SYLVINHO_IA_GEMINI_MODALIDADE=demonstracao_publica.
- SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA=true.
- SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA=true.
- SYLVINHO_IA_INSTITUCIONAL_APROVADA=true.
- SYLVINHO_IA_PRIVACIDADE_APROVADA=true.
- SYLVINHO_IA_MENORES_APROVADA=true.

Os true acima sao requisitos verificados no codigo, NAO instrucoes para fabricar
aprovacoes: so atestar depois da avaliacao material do novo escopo. Nao alterar
nenhum valor atual para publicar codigo com GERAL_ENABLED=false. A configuracao
Firebase/Firestore/CORS existente continua exigida pelo servico e nao foi alterada.

## Homologacao da arvore exata desta PR

- 779 testes offline aprovados na copia isolada da arvore de publicacao.
- 1 teste de gitignore aprovado separadamente no repositorio real (sem mudar regras).
- 1 teste condicional ignorado: snapshot integral SHA-256 nao presente na copia.
- 15 testes do adaptador Render aprovados; lint, build e scanner aprovados.
- Teste administrativo por emulador e paridade historica externa nao executados.
- Os testes de RAG usaram o corpus local autorizado, somente na cache; corpus,
  snapshots, dependencias e artefatos compilados NAO integram o commit.
- Os 969 resultados anteriores pertenciam ao worktree experimental completo, nao
  a esta selecao menor. Nenhuma falha funcional apareceu na selecao homologada.
- Experimentos excluidos permanecem locais; para publicar, usar somente o SHA
  revisado da PR, nao o estado com alteracoes pendentes do worktree.
