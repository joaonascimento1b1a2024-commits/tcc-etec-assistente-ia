# Etapa 2 — otimização local do RAG

29/10/2026. Sem chamadas de IA, leitura/escrita remota de Firestore, alteração
de documentos, índices, autenticação, histórico ou frontend. Sem novas
dependências, serviços, commit, push ou deploy. Alterações preexistentes da
Etapa 1, `.firebaserc` e `firebase.json` foram preservadas.

## Diagnóstico

- A composição Render usa `pergunta-livre/busca.ts` e
  `rag/recuperacao.ts`, lendo `conhecimento.where('ativo', '==', true)`.
  O diagnóstico local também consulta essa coleção. Não há união com `avisos`.
- A consulta lê todos os chunks ativos; ranking e filtragem são locais. Não
  existe paginação/cache nessa recuperação. Esta etapa não reduz leituras remotas.
- `firestore.indexes.json` contém listas vazias de índices compostos e overrides.
  Não declara índice vetorial. Estado dos índices e edição do banco remoto não
  foram verificados; nenhuma alteração de SDK/modelo de dados foi necessária.
- Cada chunk contém identificador, documentoId, título, categoria, seção,
  conteúdo, termosBusca, páginas, ativo e tipoConteudo opcional. O seletor admite
  apenas os três IDs documentais previamente autorizados.
- Cinco chunks e 8.000 caracteres são os limites; chunks grandes são descartados,
  nunca truncados. A granularidade real de extração, overlap e separação por
  páginas não pôde ser confirmada: os importadores encontrados carregam fixtures,
  não implementam o pipeline dos documentos oficiais. O snapshot oficial esperado
  em `tests/dados/rag-original.json` está ausente neste checkout.
- Ranking anterior: pesos 8/5/3/1 em título/categoria/termosBusca/conteúdo,
  após exigir os termos no corpo. Cortesias, hífens e equivalências simples
  causavam falsos negativos. Menções em frases separadas empatavam com respostas
  mais diretas. Duplicatas podiam ocupar as cinco vagas.
- A heurística de matrícula inicial só se aplicava quando matrícula era o único
  termo. Agora também vale para consultas com qualificadores, evitando usar
  transferência como evidência de requisitos de matrícula.

## Implementação

Somente `functions/src/rag/recuperacao.ts` foi alterado no runtime nesta etapa.

1. Normalização compartilhada pela recuperação e pelas citações: re-matrícula,
   renovação/renovar matrícula, presença/assiduidade mínima e calendário
   escolar/letivo. Flexões adicionais de horários, calendários e adjetivos.
   A aplicação ocorre apenas na comparação; o texto original nunca é reescrito.
2. Remoção limitada de cortesias no começo da pergunta. Datas, negações,
   condições, nomes de procedimentos e demais qualificadores não são descartados.
3. Matrícula inicial exige cabeçalho compatível mesmo em consultas qualificadas.
   Consultas que misturam matrícula e rematrícula retornam insuficiência em vez
   de escolher um procedimento. Comparação de procedimentos fica como limitação.
4. Reranking lexical limitado: bônus de 12 quando todos os termos estão numa
   mesma unidade textual e de 4 por termo presente na seção. Os filtros de
   procedência, corpo, tipo e assunto continuam anteriores ao ranking.
5. Deduplicação antes do orçamento: mesmo documento, título, seção, tipo,
   páginas e conteúdo, tolerando apenas diferenças de espaço. Mantém uma cópia
   determinística. Não funde fontes/páginas diferentes nem textos divergentes.
6. O caminho lexical legado de demonstrações continua sem os novos bônus e sem
   deduplicação. A seleção de fontes originais recebe as melhorias.

Não é busca semântica por embeddings nem busca híbrida vetorial: são
equivalências lexicais explícitas. Não foi demonstrada infraestrutura de
embeddings adequada no repositório; não foram adicionados serviços ou custos.

## Proveniência, conflitos e vigência

Metadados, fontes, páginas e tipoConteudo são preservados. Modelos continuam
separados de normas; frequência mínima requer tipo normativo e solicitações de
declaração exigem procedimento. `interno` e `aviso` não são promovidos a
`normativo` pelo código. Isso não equivale a uma classificação completa do corpus:
outros assuntos ainda dependem da qualidade dos metadados e do contexto.

Textos conflitantes não são deduplicados. O validador documental existente
detecta algumas divergências literais de números, negação e modalidade; um teste
com 80% versus 60% comprova a abstenção nesse caso sintético. Não há detector
semântico geral de conflitos. Não foram inventados campos de validade ou critérios
de vigência: ativo=true não prova que a norma ainda está em vigor. Nenhum documento
antigo foi apagado ou automaticamente considerado substituído.

## Benchmark reproduzível

`tests/fixtures/rag-benchmark.mjs`: 36 perguntas, 28 respondíveis e oito que
exigem abstenção neste corpus. Inclui matrícula, renovação, frequência,
declaração, calendário, atendimento, paráfrases, ambiguidades, documentos
inativos, fonte não autorizada, modelo, aviso e rotina interna como distratores.
Todos os documentos e rótulos são sintéticos, não são regras reais da ETEC.

Baseline congelado antes das mudanças: `tests/fixtures/rag-antes-etapa2.ts`,
copiado do seletor do checkout no início desta etapa (HEAD debb696a).
SHA-256 dos bytes da cópia: d74dc521fd2f9c57b6a3846f82b16bf7dc60f0b536a2c361667697b2d6fe9278.
O runner transpila essa cópia em memória, usando TypeScript já existente.
Não depende de um branch mutável ou de serviços externos.

```powershell
npm --prefix functions run build
node scripts/benchmark-rag.mjs
node --test tests/rag-etapa2.test.mjs
```

Resultados completos por pergunta: `docs/etapa-2-benchmark.json`.

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Precisão das fontes recuperadas | 100% | 100% |
| Cobertura das 28 perguntas respondíveis | 75% (21/28) | 100% (28/28) |
| Primeiro resultado relevante, nas respondíveis | 75% | 100% |
| Abstenção correta nos oito casos negativos | 100% | 100% |
| Saídas documentais sem evidência suficiente, nas 36 perguntas | 41,67% (15/36) | 22,22% (8/36) |

Precisão = chunks recuperados cujo ID está no gabarito / total de chunks
recuperados; não certifica a veracidade jurídica de uma fonte. Cobertura =
perguntas respondíveis com pelo menos um resultado relevante / respondíveis.
A abstenção de recuperação significa lista vazia. A taxa sem evidência usa o
status do compositor documental atual, fixo nos dois braços; isola a comparação
da recuperação, não compara versões completas da geração ou respostas de IA.
Não foram medidas latência/custo no Firestore ou geração real.

O conjunto foi construído durante o desenvolvimento e não é holdout cego. Os
100% medidos não representam qualidade geral, perguntas reais ou produção.
Uma próxima avaliação deve utilizar corpus oficial autorizado e rótulos revisados
pela secretaria, inclusive perguntas não utilizadas para desenvolver as regras.

## Validação

- Build, ESLint e git diff --check aprovados.
- 347 testes selecionados aprovados; 43 da nova suíte de RAG.
- Suítes executadas com sucesso: rag-etapa2, qualidade-atendimento,
  pergunta-livre-siglas, pergunta-livre-fluxo, assistente-handler, gemini-geracao,
  openrouter-conversa, openrouter-contexto, openrouter-revisao, resposta-ia-view.
- Testes novos verificam metadados, limite de contexto, deduplicação, fontes
  diferentes, preservação de ressalvas, reranking, conflito e ambiguidade.
- `rag-v1-paridade` foi tentado, mas não executou seus casos por depender de
  arquivo externo ausente em `D:/Programação/sylvinho-backend/...`. Não foi
  contabilizado como aprovado. As suítes dependentes do snapshot oficial ausente
  também não foram usadas como evidência de validação.

## Riscos e próximos passos

- Equivalências explícitas não cobrem todas as paráfrases; palavras adicionais
  ainda podem causar falsos negativos. O bônus por proximidade é heurístico.
- Normalização de calendário escolar/letivo e presença mínima deve ser avaliada
  no corpus real para detectar usos com significado diferente.
- A regra conservadora de matrícula pode rejeitar um documento pertinente cujo
  cabeçalho não siga a nomenclatura esperada; manter avaliação de recall real.
- Cópias em fontes/páginas diferentes permanecem, deliberadamente. Uma fusão
  mais ampla exigiria preservar múltiplas proveniências no contrato.
- Chunks maiores que o orçamento podem conter a resposta; não truncá-los evita
  remover ressalvas, mas mantém lacunas. Revisar extração depende do pipeline real.
- Não há comprovação automática de vigência. É necessária curadoria oficial.
- Histórico continua fora da recuperação. Não houve ativação de IA ou alteração
  das políticas de privacidade, autorização e moderação.
