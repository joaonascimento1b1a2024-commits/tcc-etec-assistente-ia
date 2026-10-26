# Diagnóstico de ativação do Gemini — 26/10/2026

## Conclusão verificável

A `main` remota `5b98277ae803319ab124cc3535edf74f7e0576fd` não contém o
modo geral automático. A implementação está no commit
`b555fa2db0518cc62c15da2e8db9ecd41ac78650`, da
[PR #17](https://github.com/joaonascimento1b1a2024-commits/tcc-etec-assistente-ia/pull/17),
confirmada aberta e não integrada pela API autenticada do GitHub nesta investigação.
Portanto, publicar a main atual não publica esse fluxo, independentemente da chave.
O commit efetivamente Live no Render ainda precisa de conferência no painel.

Esta correção incorpora a implementação existente sobre a main atual, sem criar
outro endpoint ou adaptador Gemini. Mantém os gates desativados por padrão e
acrescenta diagnóstico seguro e regressões. Nenhuma configuração de produção foi
alterada e nenhuma chamada real ao Gemini foi executada nesta investigação.

O responsável informou nesta conversa que **já existe revisão documentada para o
modo automático**. O documento, seu arquivo no Render, hash, escopo e vigência
ainda não foram inspecionados. Não se fabricaram registros ou aprovações.

## Evidências públicas e limites de acesso

- GET `https://sylvinho-backend-poc.onrender.com/health`: 200, status ok.
- OPTIONS `/perguntarAssistente`, Origin do Hosting, POST e headers esperados:
  204 e `Access-Control-Allow-Origin` correto.
- POST `/perguntarAssistente` com `{}` e sem token: 401. Nenhuma conversa criada.
- Os arquivos publicados `Logado/Home/assistente-config.js`, `assistente-client.js`,
  `home.js`, `Chat/chat.js` e `Chat/cliente.js` são iguais aos da main local,
  comparando SHA-256 após normalizar LF/CRLF.
- O endpoint do frontend autenticado é o Render esperado. Timeout do cliente:
  120.000 ms. O chat visitante usa outra rota e só atende pelo documental.
- Não há conexão de leitura ao painel/API Render nesta sessão. Nenhuma credencial
  Gemini está disponível no ambiente local. Não foram lidos logs privados do Render.
- `/health` não informa commit, configuração IA ou consumo do provedor. GitHub não
  apresentou deployments/statuses que permitissem determinar a release Live.

## Caminho da pergunta e diagnóstico

| Etapa | Evidência e comportamento | Tipo / ação / verificação |
| --- | --- | --- |
| 1. Interface | Home salva a mensagem user e envia pergunta, conversationId, messageId e ID token. Cliente publicado confere com main. | Sem falha de envio demonstrada. Testes do cliente e HTTP local cobrem contrato. |
| 2. Endpoint/CORS | URL aponta ao Render; preflight 204. | Publicação/acesso HTTP confirmados, geração não. |
| 3. Autenticação/autorização | Token é verificado; UID vem do token; histórico está em users/UID/conversas. Sem token retorna 401. | Preservados. Token real de conta autorizada não disponível nesta sessão. |
| 4. Roteamento | Main sempre consulta conhecimento. PR #17 tenta geral antes do RAG. O roteador da PR não reconhecia “Posso faltar amanhã?”, prova, recuperação e segunda via. | Código/publicação. Incorporada PR e ampliados termos escolares. Regressões exigem zero chamadas Gemini nesses casos. Roteamento lexical ainda não é classificador semântico perfeito. |
| 5. Seleção | No gateway documental, ausência de evidência impede geração; demonstracao_publica bloqueia texto livre documental. | Não corrigível apenas com chave. Geral usa fluxo separado já existente na PR, mantendo o RAG escolar. |
| 6. Gates | Geral exige flags, allowlist, modo automatico, plano e política própria com validade máxima de 24h. Registro do catálogo não serve. | Configuração/autorização: valores no Render não verificados. Checker local e eventos mostram bloqueio. Não relaxados. |
| 7. Chave | Backend lê GEMINI_API_KEY somente depois dos gates e antes de cada chamada; header x-goog-api-key. | Credencial: presença no Render não verificada. Falta/invalidade local agora gera código seguro. |
| 8. Modelo | Sem default; GEMINI_MODEL deve coincidir com registro de política. | Modelo: gemini-3.5-flash-lite existe na documentação oficial e suporta structured outputs. Acesso/cota da conta não verificados. |
| 9. API | Mesmo adaptador REST v1beta generateContent, JSON Schema, filtros e sem retries. Duas chamadas no geral: moderação e geração. | Código: erros antes indistinguíveis agora classificam HTTP 400/401/403/404/429/5xx, rede, formato e timeout. HTTP 400 não prova sozinho chave inválida; 429 não distingue sozinho quota diária de taxa. |
| 10. Validação | Recusa, truncamento, formato inesperado, conteúdo inadequado/institucional, revogação e prazo invalidam saída. | Preservados. Fallback explícito; nunca resposta sintética apresentada como real. Testes de resposta tardia impedem sucesso após timeout. |
| 11. Entrega | Backend persiste bot antes de retornar resposta. Home relê histórico do servidor e renderiza como texto. | Request ID correlaciona resposta do provedor, GERADA e RESPOSTA_CONFIRMADA. Erro de persistência não é sucesso HTTP. |
| 12. Histórico/idempotência | Mesmo messageId devolve resposta já salva, inclusive fallback antigo. Concorrência local é coalescida; transação evita bot duplicado. | Comportamento preservado. Diagnóstico identifica REPLAY, REPLAY_REVALIDACAO, REPLAY_TRANSACAO e COALESCIDA. Teste real precisa de IDs novos. |

**Firestore:** o caminho geral não consulta a coleção conhecimento nem usa RAG.
Ainda lê/grava o histórico autenticado; remover isso quebraria a persistência e a
idempotência exigidas. O visitante continua documental e não ganha acesso à IA.

## Correções adicionais desta investigação

- `geracao/gemini.ts`: códigos seguros de falha e evento de resposta parseada do
  provedor; registra apenas SHA-256 do responseId, nunca body, chave ou assinatura.
- `geracao/geral.ts`: roteamento escolar, motivos por etapa e correlação com ID
  aleatório recebido do handler. O evento GERADA só ocorre após validação final.
- `handler.ts`: ID aleatório próprio no header `X-Sylvinho-Request-Id`, no-store,
  eventos HTTP e identificação de replay inclusive na transação entre instâncias.
- `render-poc/documental.cjs`: conecta diagnóstico estruturado ao fluxo existente.
- `scripts/diagnosticar-gemini.mjs`: inspeção local de configuração, somente leitura,
  sem rede; nunca imprime chave, allowlist, referências ou conteúdo da política.
- `visitante.ts`: apenas quebra de linha para corrigir lint preexistente na main.
- Testes do automático/diagnóstico e atualização dos mocks desatualizados no teste
  do entrypoint de avisos (dependências do visitante já existentes na main).

## Testes executados nesta correção

- `npm.cmd --prefix functions run lint`: aprovado.
- `npm.cmd --prefix functions run build`: aprovado.
- `node scripts/verificar-segredos.mjs`: nenhum achado (scanner heurístico).
- Regressão selecionada: 455 aprovados, zero falhas, um ignorado condicionalmente.
  Inclui Gemini geral, REST, erros, cota, timeout, resposta tardia, política,
  catálogo, OpenAI, pergunta livre/RAG sintético, declaração, cliente, visitante,
  histórico, avisos e arquitetura/health do Render.
- HTTP real em localhost com Auth/Firestore em memória e provedor simulado:
  geral sem conhecimento, escolar com RAG, token inválido, conflito, replay e
  correlação completa. Esses resultados **não são geração Gemini real**.
- Regras administrativas executadas em Auth/Firestore Emulator com projeto
  `demo-etec-rbac`: aprovadas. Nenhuma conexão a dados reais nesses testes.
- Suíte completa final sob emuladores: **729 resultados, 707 aprovados,
  20 falhas, 2 ignorados**. Dezenove falhas são dependências do corpus ausente
  `tests/dados/rag-original.json`, ignorado pelo Git; uma é a fonte histórica
  ausente `D:/Programação/sylvinho-backend/functions/rag/recuperacao.js`.
  Não se inventou corpus oficial nem se removeram testes para ficar verde.
  Restaurar esses artefatos locais autorizados e repetir a regressão antes do merge.

Comando da suíte completa (exige os artefatos acima):

```powershell
firebase.cmd emulators:exec --config firebase.admin.test.json --project demo-etec-rbac --only auth,firestore "node --test --test-reporter=tap tests/*.test.mjs render-poc/test/*.test.cjs"
```

## Conferência de produção pendente

No Render, obter commit/release Live, branch vinculada e estado do Auto-Deploy.
Não pressupor que o SHA da main seja a release efetiva. Preservar essa identificação
para rollback antes de qualquer publicação autorizada.

Depois de disponibilizar o código por publicação autorizada, executar no Shell do
serviço, a partir da raiz do repositório:

```sh
node scripts/diagnosticar-gemini.mjs
```

Se Root Directory for `render-poc`, usar `node ../scripts/diagnosticar-gemini.mjs`.
O checker não ativa nem testa Gemini e não comprova billing real. Sua execução
local nesta investigação mostrou ambiente ausente; isso **não descreve o Render**.

Requisitos exatos para futura ativação, depois da confirmação explícita:

| Configuração | Valor/requisito |
| --- | --- |
| SYLVINHO_POC_MODE | documental, preservando configuração Firebase/CORS existente |
| SYLVINHO_IA_PROVIDER | gemini |
| SYLVINHO_IA_ENABLED | true |
| SYLVINHO_IA_GEMINI_GERAL_ENABLED | true; manter false durante publicação inicial |
| SYLVINHO_IA_GEMINI_GERAL_MODO | automatico |
| GEMINI_MODEL | ID confirmado no projeto da chave e igual ao registro |
| GEMINI_API_KEY | segredo presente apenas no servidor |
| GEMINI_API_TIER | free ou paid conforme conta real e registro |
| SYLVINHO_IA_UID_ALLOWLIST | contas adultas autorizadas; lista privada válida de até 20 UIDs |
| SYLVINHO_IA_GEMINI_MODALIDADE | demonstracao_publica |
| SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA, SYLVINHO_IA_GEMINI_RETENCAO_RECONHECIDA | true somente conforme revisão existente aplicável |
| SYLVINHO_IA_INSTITUCIONAL_APROVADA, SYLVINHO_IA_PRIVACIDADE_APROVADA, SYLVINHO_IA_MENORES_APROVADA | true somente conforme revisão existente aplicável |
| SYLVINHO_IA_GEMINI_GERAL_AUTOMATICO_SHA256 | digest exato do arquivo de política automático aprovado e vigente |
| Secret File | /etc/secrets/sylvinho-gemini-geral-automatico.json; contrato em GEMINI-GERAL-AUTOMATICO.md |
| SYLVINHO_IA_TIMEOUT_MS | 1..30000; padrão 20000, prazo total das duas chamadas |
| SYLVINHO_IA_MAX_POR_MINUTO | 1..20; padrão 5 perguntas por minuto, por instância/caminho; 1 operação concorrente |

No AI Studio, conferir no projeto **da chave**: acesso ao modelo, plano e quotas
RPM/TPM/RPD. Cinco perguntas podem usar dez chamadas/minuto. O limite local não
constitui teto global nem garante quota do provedor. Não presumir que o projeto
da chave seja o mesmo projeto Firebase. Não alterar modelo para contornar falhas
sem atualizar a política aprovada correspondente.

## Prova real necessária e rollback

1. Confirmar configuração, revisão vigente, disponibilidade/cota e autorização
   explícita para publicar/ativar. A solicitação desta investigação não autoriza
   deploy nem alteração de flags. Não marcar revisão inexistente como aprovada.
2. Publicar somente o backend revisado, inicialmente com geral desligado. O
   frontend já envia o contrato necessário. Capturar antes a release Live real.
3. Ativar somente após confirmação explícita, com o registro existente válido.
4. Login de adulto da allowlist no chat autenticado, conversa e messageId novos;
   uma pergunta geral não sensível. Não usar o catálogo nem o chat visitante.
5. Correlacionar o header X-Sylvinho-Request-Id com SYLVINHO_DIAGNOSTICO:
   RECEBIDA → MODERACAO/RESPOSTA_PROVEDOR → GERACAO/RESPOSTA_PROVEDOR →
   GERACAO/GERADA → HTTP/RESPOSTA_CONFIRMADA, e com a resposta efetiva no chat.
   O digest do responseId da geração distingue a resposta do provedor da moderação.
   Conferir também uso do modelo na conta. Rejeitar como prova uma execução com
   replay/coalescência, fallback, falha, timeout ou apenas HTTP 200.
6. Não exportar tokens, perguntas privadas, respostas privadas ou logs brutos.
   Em falha, interromper; não repetir automaticamente nem mudar provedor.

Rollback, também sujeito à autorização: desligar somente
SYLVINHO_IA_GEMINI_GERAL_ENABLED; se houver regressão de código, republicar a
release anterior **confirmada no Render**. Não apagar histórico, usuários ou
conhecimento. Base Git preservada: 5b98277ae803319ab124cc3535edf74f7e0576fd;
isso não é afirmação de que ela seja a release Live.

## Referências verificadas

- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite — modelo e saída estruturada.
- https://ai.google.dev/gemini-api/docs/structured-output — contrato JSON Schema.
- https://ai.google.dev/gemini-api/terms — restrições de idade/público e tratamento de dados;
  revisão informada pelo responsável não foi inspecionada nesta sessão.
- https://render.com/docs/deploys — marcador [skip render] evita auto-deploy por commit.
- https://render.com/docs/service-previews — o mesmo marcador no título evita preview.

Nenhuma evidência desta investigação permite declarar ATIVO E TESTADO COM GEMINI REAL.
