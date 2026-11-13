# Chat com RAG e Gemini real — execução local

11/11/2026. Sem commit, push ou deploy. Sem escrita no Firebase real.

Modelo local atualizado por solicitação do usuário para `gemini-3-flash-preview` (Gemini 3 Flash Preview). Identificador confirmado pela listagem da API e pela [documentação oficial](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview). Usa `thinkingLevel: minimal`, sem herdar `thinkingBudget: 0` do 2.5 e sem forçar temperatura 0,3. O padrão do Gemini 2.5 permanece somente no caminho de compatibilidade explícito.

Teste real da troca aprovado no navegador: quatro chamadas HTTP 200, resposta RAG validada em aproximadamente 6,6 segundos nesse caso, fontes expansíveis, recarga, replay sem duplicação e bloqueio sem token. Evidência atualizada em `.cache/chat-rag/navegador.json` e `eventos.json`. Isso substitui a pendência de geração dessa execução específica, sem garantir qualidade de todas as perguntas ou cota ilimitada. A captura do projeto mostra 20 solicitações diárias para esse modelo; o fluxo ainda pode consumir quatro por resposta.

Atualização posterior: linguagem, contexto, busca BM25, corpus de 290 trechos e diagnóstico específico de HTTP 429 estão descritos em [CONVERSA-NATURAL-E-DESEMPENHO-LOCAL.md](CONVERSA-NATURAL-E-DESEMPENHO-LOCAL.md). O teste de geração da nova rodada ficou limitado pela cota externa; os resultados abaixo descrevem a implementação inicial.

## O que mudou

O chat em `http://127.0.0.1:5000/Logado/Home/home.html` passou a usar uma composição local que recupera trechos de fontes reais e pede ao Gemini 2.5 Flash para redigir uma resposta fundamentada. O frontend mostra o texto natural primeiro, a identificação de IA depois e as fontes em “Ver fontes”, fechado inicialmente. O texto original completo é preservado para histórico e cópia.

Fluxo: autenticação no emulador → salvar pergunta → recuperar trechos → classificar entrada → gerar proposta com citações → validar referências e números → revisar sustentação → classificar saída → salvar resposta → reler histórico.

São reaproveitados o handler autenticado, as transações e os identificadores da conversa/mensagem. A chave fica no processo do servidor; o navegador não recebe a chave. Não são enviados ao Gemini UID, token nem histórico completo. Perguntas podem ser enviadas à API externa do Gemini; “local” refere-se ao frontend, backend e Firebase emulados, não à execução do modelo no computador.

Se não houver evidências suficientes, a resposta informa isso. Se o provedor falhar ou a proposta não passar nas validações, a mensagem informa que não foi possível gerar uma resposta validada. Não transforma extração documental em resposta atribuída à IA. Não há retry automático do provedor.

## Documentos reais e limites

Foi copiada para `.cache/chat-rag/` a base revisada preservada em `stash@{0}^3:knowledge-base/`, sem aplicar ou remover o stash. São oito trechos ativos, com arquivos de origem conferidos por SHA-256. Os snapshots são de páginas institucionais e do Regimento Comum, com consulta registrada em 14/10/2026. Os trechos são sínteses revisadas identificadas como tais, não transcrições literais do PDF. Os originais permanecem preservados.

A base não cobre todos os procedimentos da secretaria e não certifica vigência. Não é o corpus antigo de 514 chunks, que não estava disponível localmente. A busca deste ambiente usa o seletor lexical existente compatível com a base revisada. Os seletores e aprovações de produção não foram alterados para aceitar esses IDs diferentes.

O teste real perguntou “Qual é a frequência mínima exigida?”. O Gemini produziu uma resposta natural sustentada pelo trecho do artigo 83, com referência à página 26 do snapshot. Esse exemplo demonstra a integração, não constitui revisão jurídica ou confirmação de vigência pela escola.

## Arquivos desta implementação

- `scripts/preparar-rag-real-local.mjs`: recupera somente a base e as fontes necessárias do stash e verifica hashes.
- `local-e2e/rag-gemini-real.mjs`: composição local RAG/Gemini, validação, revisão, limite de cinco perguntas por minuto e uma geração por vez.
- `scripts/iniciar-rag-gemini-local.mjs`: servidor apenas em 127.0.0.1:5002; usa Auth/Firestore emulados e configura apenas a cópia de frontend ignorada em `.cache/local-e2e/`.
- `local-e2e/prepare-history.mjs`: opção explícita `geminiLocal` para permitir a porta local 5002 na CSP do staging.
- `local-e2e/history-run.mjs`: opção `--gemini-local`; espera de navegação corrigida para não acessar o campo antes do carregamento. As demais correções do roteiro já foram feitas na rodada anterior.
- `public/Logado/Home/resposta-documental-view.js`: resposta natural antes do aviso, com fontes expansíveis preservadas.
- `tests/rag-gemini-real-local.test.mjs` e `tests/resposta-documental-view.test.mjs`: cobertura dos novos comportamentos.
- `scripts/verificar-rag-gemini-navegador.mjs`: teste com Gemini real, histórico, fontes, replay e autenticação.

O serviço local não preenche flags de aprovação institucional, privacidade, menores ou retenção do gateway publicado. Não altera seu comportamento nem configura ZDR. A integração pública continua exigindo sua própria revisão e autorização de publicação. A composição local aceita somente trechos exatos do corpus selecionado e aplica o filtro de entrada existente; esse filtro heurístico não garante detecção de todo dado pessoal. Não usar informações pessoais reais nos testes.

## Verificações

- Fluxo integrado dos emuladores aprovado antes da conexão: histórico, regras de isolamento, concorrência e recuperação de resposta perdida sem duplicação.
- Gemini real no navegador: resposta gerada, referências reconhecidas, fontes inicialmente fechadas, persistência após recarga, replay do mesmo identificador e bloqueio HTTP 401 sem token. Nenhum erro JavaScript nessa execução.
- 246 testes selecionados passaram na rodada final. Um caso antigo de apresentação foi excluído por nome porque depende do arquivo ausente `tests/dados/rag-original.json`; a execução que incluiu esse caso registrou falha. Não foi criada fixture falsa nem removido o teste.
- Testes novos verificam falta de evidência, indisponibilidade externa, referência falsa, valor numérico inventado, entrada com dados pessoais e trecho adulterado.
- Houve uma recusa do Gemini numa rodada intermediária. Foi mantida como falha, sem aprovação artificial. A validação local passou a usar a modalidade já existente `sintese_revisada`, que permite omitir números incidentais, proíbe valores novos e exige revisão semântica posterior. O teste final com chamadas reais passou.
- A configuração de raciocínio do Flash no transporte local usa `thinkingBudget: 0`, sem mudar o cliente publicado. Referência técnica: [documentação oficial do Firebase sobre thinking](https://firebase.google.com/docs/ai-logic/thinking). Isso reduz trabalho de geração adicional; não elimina a revisão da resposta.

Evidências: `.cache/chat-rag/navegador.json`, `chat-real.png`, `eventos.json`; integração anterior: `.cache/local-e2e/result.json`. Os logs contêm códigos de diagnóstico; nunca a chave.

## Iniciar novamente

Na raiz do projeto, primeiro:

```powershell
node scripts/preparar-rag-real-local.mjs
node local-e2e/history-run.mjs --keep-open --gemini-local
```

Quando aparecer `CHAT_LOCAL_READY`, em outro terminal na mesma pasta:

```powershell
node scripts/iniciar-rag-gemini-local.mjs
```

Abrir `http://127.0.0.1:5000/Logado/Home/home.html`. A chave é lida da variável GEMINI_API_KEY ou do `.env` já existente no backend irmão. Não copiar a chave para HTML, JavaScript público, relatório ou arquivo versionado. É necessária conexão com a API externa e com o SDK oficial do Firebase usado pelo frontend.

A prévia da porta 4173 continua sendo visual e fictícia. Conversas antigas de teste contendo MARCADOR_ATIVO não são reescritas; iniciar “Novo chat” no ambiente 5000.

## Reverter somente esta rodada

Encerrar os processos locais nos terminais com Ctrl+C. Regenerar o staging sem `--gemini-local` para voltar ao roteiro documental. Reverter somente a troca de ordem dos dois elementos em `resposta-documental-view.js` e a opção local adicionada ao preparador/runner, preservando as alterações anteriores. Os novos módulos, scripts e testes desta rodada podem ser retirados separadamente. Não executar reset/clean global nem reaplicar o stash.

Ainda pendentes: ampliar e revisar o corpus de documentos completos, testar mais perguntas, medir qualidade e limites do provedor, revisar o tratamento de dados e preparar uma composição publicável somente após aprovação. A evidência desta rodada é local e não aprova automaticamente a publicação.
