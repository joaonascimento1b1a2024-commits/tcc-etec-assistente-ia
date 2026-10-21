# Regressao do RAG original — Lote 1

`rag-original.json` contem copias literais de 40 chunks de `conhecimento`, lidos em
21/10/2026 no projeto `tcc-ia-d8891`, banco `(default)`. Nao sao fixtures inventadas
nem um importador. Nao importar esta amostra em nenhum banco.

A selecao inclui B1 (matricula inicial), B4 (renovacao), D5 (atestados e declaracoes),
artigos 83/84/94, modelos DOC 04/67, LGPD e distratores reais de trancamento,
intercambio e cabecalho sem orientacao. Mantem IDs, texto e metadados de origem.
Isso nao certifica a vigencia ou corrige remissoes internas dos documentos.

## Executar offline

Na raiz do worktree, apos compilar as Functions:

```powershell
npm.cmd --prefix functions run lint
npm.cmd --prefix functions run build
node --test tests/rag-original.test.mjs
```

A avaliacao adicional do corpus completo utilizou um snapshot local de 514 chunks
em `.cache/rag-original-auditoria.json`, ignorado pelo Git. Nenhum teste consulta o
Firestore online ou usa credenciais. O snapshot integral nao integra a selecao de
versionamento. Para repetir enquanto ele estiver disponivel neste worktree:

```powershell
$env:RAG_CORPUS_LOCAL='.cache/rag-original-auditoria.json'
node --test tests/rag-original.test.mjs
Remove-Item Env:RAG_CORPUS_LOCAL
```

## Invariantes e limitacoes

- Apenas as tres fontes fixadas no backend participam do contexto original.
- O leitor ainda consulta `ativo == true`; o filtro de fontes ocorre antes do
  ranking e da montagem do contexto. Nao foram criados indices ou alteradas queries
  online/configuracoes do Firebase.
- Mantidos score lexical V1, limite de cinco chunks e 8.000 caracteres.
- Todos os termos significativos precisam aparecer no corpo do chunk, depois das
  flexoes explicitamente enumeradas; sem corte numerico arbitrario de score.
- Pedidos de frequencia minima/aprovacao exigem natureza normativa; evidencia
  quantitativa recebe preferencia sobre remissoes. Isso nao resolve a divergencia
  interna do artigo 84, que remete ao 87, enquanto o percentual esta no artigo 83.
- Matricula inicial e renovacao usam secoes documentais identificadas nos originais;
  declaracoes exigem assunto principal, evitando mencoes incidentais em outros
  procedimentos. D5 e orientacao; DOCs sao modelos, nunca obrigacoes normativas.
- Sem fonte, assunto ou evidencia suficientes, o leitor retorna `[]`. O gerador
  documental existente transforma contexto vazio em recusa e orientacao a secretaria.
- O seletor lexical legado permanece disponivel para os testes e modo academico
  historico explicitamente separado; o leitor original nao usa as tres fixtures.
- Cobertura conservadora pode recusar sinonimos nao mapeados, multiplos assuntos ou
  evidencia distribuida entre varios chunks. Nao e busca semantica nem prova de
  que a resposta inteira esta contida em uma frase.
- O Lote 2 alinha a analise lexical do extrator ao RAG original e preserva frases
  completas mesmo quando o PDF quebra linhas. Frequencia para aprovacao e
  solicitacao de declaracao agora produzem citacoes pertinentes. Nao integra Gemini.
  A resposta permanece extrativa: nao interpreta casos individuais nem garante
  vigencia, procedimento completo ou funcionamento atual de um servico da unidade.
- Telefone local exige identificacao da Etec Sylvio de Mattos Carvalho no corpo e
  numero explicito; contatos genericos ou de outras unidades nao bastam.
- Modelos sao retornados somente quando pedidos explicitamente; o gerador existente
  os rotula como nao normativos. Nao sao fallback para uma orientacao ausente.

As alteracoes nao mudam handler, Firebase ID Token, UID, HTTP, historico,
`messageId`, configuracoes do Render, endpoint do frontend ou dados do Firestore.

## Integracao com o gerador — Lote 2

```powershell
node --test tests/rag-original.test.mjs tests/rag-gerador-original.test.mjs
```

Sao 24 novos testes do Lote 2, alem dos 17 do leitor. A validacao adicional usa
o mesmo `RAG_CORPUS_LOCAL` descrito acima. Nao ha I/O online nos testes.

- RAG e extrator compartilham termos canonicos e a distincao entre assunto e pedido.
- Renovacao de matricula e rematricula compartilham o conceito, sem apagar assuntos
  independentes como uma pergunta conjunta de matricula e rematricula.
- Quebras visuais LF/CRLF sao neutralizadas somente na segmentacao; indices
  preservados permitem citar substrings literais, sem reescrever o texto.
- Sentencas longas so sao separadas em limites estruturais de lista. A introducao
  e o primeiro item sao mantidos juntos quando cabem no teto de citacao.
- Pedidos de procedimento priorizam passos numerados em vez de material de apoio.
- Perguntar explicitamente por modelo pode retornar `trechos_encontrados`, sempre
  com aviso e citacoes nao normativas. Sem esse pedido, apenas modelos continuam
  insuficientes para provar uma regra. Titulos literais comprovam existencia do
  formulario, sem transformar seus campos ou prazos em atendimento garantido.
- Preservados os limites de tres citacoes, 480 caracteres por citacao e 2.400
  caracteres na resposta. Secoes originais maiores que 180 caracteres deixam de
  ser descartadas; o limite seguro do campo secao passa a 1.200 caracteres.
- O contrato HTTP permanece `{ resposta: string }`. Testes com o handler real e
  Auth/Firestore em memoria verificam UID derivado do token, concorrencia e replay:
  uma resposta persistida com o mesmo messageId, inclusive para recusas.

Exemplos validados: artigo 83/pagina 26 para frequencia minima; B1/paginas 25-26
para matricula; B4/pagina 32 para renovacao; D5/pagina 99 para declaracoes;
DOC 67/paginas 260-261 para existencia de modelo de declaracao de transferencia.
Telefone local ausente e transporte interplanetario permanecem recusados.

Limites conhecidos: sinonimos nao mapeados, frases muito longas sem estrutura,
evidencia distribuida entre frases e contradicoes semanticas podem exigir recusa.
Nao ha respostas fixas escolares, consulta ao relogio, inferencia de datas ou LLM.
