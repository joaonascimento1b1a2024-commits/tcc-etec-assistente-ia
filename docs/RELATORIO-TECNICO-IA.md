# Relatório técnico da inteligência artificial do Sylvinho

Este documento explica como a IA do Sylvinho funciona, por que cada decisão foi tomada e quais trechos de código mostrar no relatório técnico e nos slides. O código citado está todo comentado no próprio arquivo.

## 1. O problema e a decisão principal

Um chatbot que manda a pergunta direto para um modelo de linguagem (como o ChatGPT ou o Gemini) responde com segurança mesmo quando não sabe. Ele pode inventar datas, prazos, documentos ou regras. Na secretaria de uma escola, uma resposta inventada sobre prazo de matrícula prejudica o aluno.

Por isso o Sylvinho segue uma regra central: **a IA só pode dizer o que está em fatos aprovados.**

- Os fatos ficam numa **base curada** (`knowledge-local/faq-curada.json`): 90 entradas com pergunta, formas alternativas de perguntar e resposta. Cada entrada tem a **fonte oficial** (URL), o **trecho literal** que a comprova e o **hash SHA-256** desse trecho.
- O modelo de linguagem (Google Gemini) **não decide o conteúdo**. Ele recebe a pergunta e os fatos encontrados, escreve uma resposta curta e informa **quais fatos usou**. Depois, o código e uma segunda chamada ao Gemini conferem se a resposta está sustentada nos fatos.
- Se a pergunta for **igual** a uma pergunta aprovada, o Gemini nem é chamado: o texto aprovado é a resposta.

A técnica é uma forma de **RAG** (*Retrieval-Augmented Generation*, geração aumentada por recuperação): primeiro recupera os fatos, depois gera a resposta presa a eles. A diferença em relação a um RAG comum é que a base não é feita de trechos soltos de documentos, mas de **fatos já revisados**, com validação depois da geração.

## 2. Arquitetura

```text
Navegador (public/)  ──HTTPS──►  Servidor Render (render-poc/server.cjs)
                                    │
                                    ├─ /perguntarVisitante  → functions/src/assistente/visitante.ts
                                    └─ /perguntarAssistente → functions/src/assistente/handler.ts
                                                               (token do Firebase; histórico no Firestore)
                                    │
                                    ├─ Classificador local ........ functions/src/assistente/escopo.ts
                                    ├─ MOTOR CURADO (híbrido) ..... render-poc/motor-curado.cjs
                                    │     ├─ gemini-curado.mjs      fluxo: fila, cache, geração, validação, revisão
                                    │     ├─ curadoria-local.mjs    busca BM25 + embeddings, filtros, política, prompt
                                    │     ├─ contexto-curado.mjs    perguntas de acompanhamento ("e o prazo?")
                                    │     ├─ embeddings-curados.mjs vetores de significado (Gemini Embedding)
                                    │     ├─ concorrencia-curada.mjs fila e limite de perguntas simultâneas
                                    │     └─ cache-respostas-curadas.mjs  cache de respostas validadas
                                    └─ Fluxo documental (RAG antigo) .. functions/src/assistente/pergunta-livre/
                                                                         (documentos no Firestore)
Google Gemini API: geração (um modelo principal e modelos de reserva) e embeddings (gemini-embedding-001)
```

**Tecnologias:**
- **Node.js 24** no servidor e **TypeScript** nas regras compartilhadas;
- **Firebase**: Authentication, Firestore, Hosting e Cloud Functions;
- **Render**, onde roda o servidor da IA;
- **Google Gemini API**, para geração e embeddings.

O servidor da IA fica no Render, e não nas Cloud Functions, porque o plano gratuito do Render permite um servidor Node sempre disponível para as duas rotas do chat. A chave do Gemini fica só no servidor e nunca chega ao navegador.

## 3. A base curada

Exemplo de entrada (resumido):

```json
{
  "id": "horario-secretaria",
  "pergunta": "Qual o horário de atendimento da Secretaria?",
  "variacoes": ["qual o horario da secretaria", "que horas a secretaria abre", "..."],
  "resposta": "A Secretaria Acadêmica atende de segunda a sexta-feira, das 9h às 14h e das 18h30 às 21h. ...",
  "categoria": "secretaria",
  "aplicaSe": {"cursos": [], "turnos": [], "idades": []},
  "vigencia": {"inicio": null, "fim": null, "revisarEm": "2027-06-30"},
  "fonte": [{
    "url": "https://nsaetec.com.br/alunos/alunos_menu.aspx",
    "evidencia": "Horário de atendimento da Secretaria Acadêmica: Segunda a sexta-feira: das 9h às 14h e das 18h30 às 21h.",
    "sha256": "…64 caracteres…",
    "formaConferencia": "leitura pelo navegador … aviso da Secretaria de 05/08/2026"
  }],
  "status": "aprovado", "versao": 1
}
```

| Campo | Para quê |
| --- | --- |
| `variacoes` | Outras formas de fazer a mesma pergunta. Ajudam a busca e permitem a resposta exata, sem Gemini. |
| `aplicaSe` | Restringe a entrada a cursos, turnos ou idades. Exemplo: datas do calendário que só valem para alguns cursos. |
| `vigencia` | A entrada sai da busca sozinha quando vence. Exemplo: as datas do Vestibulinho 2027 saem depois de 28/02/2027. |
| `fonte` | Precisa de URL `https`, trecho de evidência e hash. Sem isso, a entrada é ignorada (função `elegivel`). |

**Fontes usadas:**
- site da ETEC e documentos publicados (Regimento Comum, Calendário Escolar 2026, regulamentos da biblioteca e dos laboratórios);
- portal do Vestibulinho, com cerca de 150 perguntas oficiais;
- avisos da Secretaria no NSA, a área do aluno.

Divergências entre fontes ficaram registradas, e o que não tinha fonte oficial ficou como **pendência**. Para essas perguntas o Sylvinho diz que "a Secretaria confirma".

O índice vetorial (`knowledge-local/embeddings-curados.json`) guarda um vetor de 768 números para cada entrada e o **hash da base**. Se alguém mudar a base sem reindexar, os hashes não batem e o servidor desliga a busca semântica, em vez de usar vetores errados.

## 4. Passo a passo de uma pergunta

### 4.1 Classificador local (`functions/src/assistente/escopo.ts`)

Antes de qualquer IA, expressões regulares classificam a mensagem:
- **social:** saudação, agradecimento e perguntas sobre o próprio assistente ("Quem é você?", "Quem te criou?", "Você é uma IA?"). A resposta é fixa.
- **fora_escopo:** pedidos sem relação com a escola ("capital da França", "faz meu trabalho de matemática") e tentativas de manipular o bot ("ignore suas instruções"). A resposta é fixa: "Posso ajudar com informações da escola…".
- **institucional ou ambígua:** segue para o motor curado.

Assim o Gemini nunca recebe perguntas fora do escopo da escola, e as respostas sociais saem na hora.

### 4.2 Motor curado (`render-poc/motor-curado/gemini-curado.mjs`, função `responder`)

| Etapa | O que faz | Por quê |
| --- | --- | --- |
| 1. Entrada | Limita o tamanho e **bloqueia CPF, RA, nomes, e-mails e telefones pessoais** antes de qualquer chamada externa. | Privacidade (LGPD): dado pessoal não sai do servidor. |
| 2. Contexto e política | Reescreve continuações ("qual o prazo?" depois de "como renovo?") e trata casos fixos (atendimento humano, perguntas amplas demais e pendências conhecidas). | Conversa natural sem dar ao modelo o histórico bruto. |
| 3. Cache | A mesma pergunta, da mesma conta, há menos de 5 minutos devolve a resposta já validada. | Economia de cota e velocidade. |
| 4. Fila | No máximo 2 perguntas ao mesmo tempo, 4 na fila e uma vaga por conta. | Servidor e cota gratuitos. |
| 5. Busca | Até 5 fatos com confiança ≥ 0,42 (ver 4.3). | Só fatos relevantes vão ao modelo. |
| 6. Pergunta exata | Se a pergunta é igual a uma pergunta ou variação aprovada, devolve o texto aprovado em cerca de 40 ms. | Mais rápido e sem risco de o modelo misturar fatos vizinhos. |
| 7. Geração | O Gemini recebe a instrução (`PROMPT_CURADO`), a pergunta, o escopo e os fatos, e devolve JSON `{resposta, ids}`. | Saída estruturada e rastreável: dá para saber quais fatos ele usou. |
| 8. Validação por código | Formato, IDs citados, dado pessoal, **números e datas presentes nos fatos**, linguagem (sem links, sem perguntas, sem "segundo o artigo"). | Regras que não dependem da IA. |
| 9. Revisão | Segunda chamada: "TODA a resposta está sustentada nos fatos?" A saída é `{sustentada: true/false}`. | Detecta troca de assunto ou condição apagada, que o código não percebe. |
| 10. Falha | Uma resposta reprovada **nunca** é mostrada. Se houver um fato inequívoco, ele vai como "reserva" e o servidor mostra o texto aprovado. | Quando o Gemini falha, o usuário ainda recebe resposta correta. |

### 4.3 Busca híbrida (`render-poc/motor-curado/curadoria-local.mjs`, função `criarBuscaCurada`)

Dois sinais são combinados:

1. **BM25 (palavras):** fórmula clássica de busca textual, com k1 = 1,2 e b = 0,75. Uma palavra rara na base ("trancamento") vale mais que uma comum, e repetir uma palavra ajuda cada vez menos.
   `bm25 = Σ idf(t) · f·(k1+1) / (f + k1·(1 − b + b·|doc|/média))`
2. **Embeddings (significado):** a pergunta vira um vetor de 768 números (Gemini Embedding), comparado por **similaridade de cosseno** com o vetor de cada entrada. Assim, "Quantas faltas posso ter?" encontra a entrada sobre "frequência mínima", mesmo sem palavras em comum.

Os dois rankings são fundidos com **Reciprocal Rank Fusion** (RRF, k = 60): `score = 1/(60+posição_lexical) + 1/(60+posição_semântica)`. Uma entrada que aparece bem nas duas listas sobe.

A **confiança** de cada fato é:
- **1**, se a pergunta é exata;
- senão, `max(cobertura × 0,8 ; semântica × 0,75)`, em que cobertura é a fração das palavras da pergunta presentes na pergunta ou nas variações da entrada.

Só fatos com confiança ≥ 0,42 vão para a geração. Se o embedding falhar, a busca continua só com BM25.

### 4.4 Decisão do modo híbrido (`render-poc/motor-curado.cjs`, função `responder`)

| Resultado do motor curado | O que o usuário vê |
| --- | --- |
| Resposta válida (texto aprovado ou gerada e aprovada) | A resposta. |
| Falha com reserva (fato inequívoco) | O texto aprovado desse fato. |
| Sem fato aprovado | O **fluxo documental**: RAG sobre os documentos no Firestore, com as próprias validações. |
| Todos os modelos sem cota ou sobrecarregados, sem reserva | O fluxo documental tenta. |
| Tempo esgotado ou resposta reprovada, sem reserva | Aviso "tente novamente" (erro recuperável). |

### 4.5 Resiliência com o Gemini gratuito

O plano gratuito limita pedidos e às vezes fica sobrecarregado (HTTP 429 e 503). O sistema se protege assim:
- **Lista de modelos:** um modelo principal do Gemini e modelos de reserva, cada um com cota própria (configurados por variável de ambiente).
- **Pausa por modelo:** depois de 429, 5xx ou demora maior que 8 s, o modelo fica entre 15 s e 5 min sem ser chamado. As próximas perguntas vão direto ao seguinte.
- **Resposta exata e reserva direta:** perguntas comuns respondem mesmo com o Gemini fora do ar.
- **Prazo total de 20 s**, abaixo dos 30 s de espera do cliente.
- **Acordar o servidor:** o Render gratuito "dorme" sem uso, e as telas do chat chamam `/health` ao abrir para acordá-lo.

## 5. Privacidade e segurança

- A chave do Gemini fica só no servidor (variável de ambiente no Render) e é lida na hora de cada chamada. Nunca vai para o navegador nem para os logs.
- **Dados pessoais** são bloqueados na pergunta e na resposta (`criarFiltroContatos` e `functions/src/assistente/fundamentacao/contrato.ts`). Contatos só passam se forem os oficiais da página da escola.
- **O que o Gemini recebe:**
  - a pergunta, já sem dados pessoais;
  - o escopo (curso, turno, idade e ano);
  - os fatos aprovados.

  Nunca recebe nome, e-mail, UID ou o histórico bruto.
- **Logs de diagnóstico** sem o texto da pergunta ou da resposta: só códigos, tempos e contagens.
- **Injeção de prompt:** o classificador recusa pedidos como "ignore suas instruções". O pedido vai ao modelo como JSON (dado, não instrução), e o prompt manda ignorar instruções que venham dentro da pergunta ou dos fatos.
- **Histórico privado:** as regras do Firestore (`firestore.rules`) só deixam cada conta ler as próprias conversas. Os administradores não leem conversas alheias.
- **Visitante:** o chat sem login não grava nada e tem limite de 30 perguntas por minuto.

## 6. Avaliação

| Rodada | Resultado |
| --- | --- |
| Produção, 40 perguntas (19/11/2026, antes da varredura) | 31 adequadas |
| Produção, mesmas 40 perguntas, depois da varredura dos sites oficiais | 37 adequadas (92,5%) |
| 76 perguntas típicas de banca com o **Gemini simulado fora do ar** (local) | Antes das melhorias: 23 com o texto aprovado. Depois das variações, da resposta exata e das entradas do NSA: 47 ou mais. |
| **Rodada final em produção, 76 perguntas típicas de banca (20/11/2026, versão `c23752c`)** | **76 de 76 respondidas sem erro.** 55 com "Fonte ▾" (base curada), 18 com resposta local (saudação, identidade, esclarecimento, atendimento humano, fora do escopo, bloqueio de dados pessoais e as pendências conhecidas de cancelamento e merenda, que a Secretaria confirma) e 3 sem fonte oficial (curso gratuito, entrar atrasado e bolsa), encaminhadas à Secretaria pelo fluxo documental. |
| Tempo de resposta na rodada final | Mediana de **0,2 s**, e 90% das respostas em até 0,5 s. As 3 do fluxo documental levaram de 5 a 10 s. |

A suíte automatizada tem 1.346 testes (1.343 passando e 3 pulados, que dependem da amostra privada de documentos). Eles cobrem a busca, a validação de números, o bloqueio de dados pessoais, a fila, o cache, a reserva, o classificador, as regras de acesso e as telas.

## 7. Limitações

- **Plano gratuito:** o Gemini e o Render gratuitos trazem limite diário de pedidos, sobrecargas ocasionais e o servidor que "dorme". A primeira pergunta depois de um tempo parado pode demorar.
- **Escopo da base:** responde bem só o que está na base curada. Gratuidade, bolsa, merenda e calendário de 2027 ainda não têm fonte oficial na base.
- **Revisão humana:** as entradas foram conferidas com as fontes, mas não confirmadas formalmente pela Secretaria.
- **Fonte com login:** o NSA exige login, então quem não é aluno não consegue abrir essa fonte.

## 8. Trechos de código para o relatório técnico

Os números de linha são da versão final. Cada trecho já está comentado no arquivo, e a coluna "explicação" é o que dizer sobre ele.

| # | Arquivo e linhas | O que mostrar | Explicação |
| --- | --- | --- | --- |
| 1 | `functions/src/assistente/escopo.ts`, 44–99 | `classificarEscopo` | Primeira barreira: regras locais, sem IA, para saudação, identidade, fora do escopo e manipulação. Barato, rápido e previsível. |
| 2 | `functions/src/assistente/visitante.ts`, 59–86 | Ordem do chat de visitante | Classificador → motor curado → fluxo documental. Mostra o "híbrido" na prática. |
| 3 | `render-poc/motor-curado.cjs`, 84–121 | `responder` do adaptador | Decisão do híbrido: resposta, reserva, fluxo documental ou "tente de novo". |
| 4 | `render-poc/motor-curado/gemini-curado.mjs`, 207–263 | Etapas 1 a 4 (entrada, contexto, cache, fila) | Proteções antes de gastar IA: dados pessoais, cache e fila. |
| 5 | `render-poc/motor-curado/curadoria-local.mjs`, 154–287 | `criarBuscaCurada` | Busca híbrida: elegibilidade, BM25, embeddings, RRF e confiança. É o "R" do RAG. |
| 6 | `render-poc/motor-curado/curadoria-local.mjs`, 295–303 | `PROMPT_CURADO` | Instrução do modelo: usar só os fatos e não inventar. |
| 7 | `render-poc/motor-curado/gemini-curado.mjs`, 265–335 | Etapas 5 a 7 (busca, exata, geração) | O "G" do RAG, e a resposta exata que dispensa o modelo. |
| 8 | `render-poc/motor-curado/gemini-curado.mjs`, 337–369 | Etapas 8 e 9 (validação e revisão) | Defesa contra alucinação em duas camadas: código e segunda IA. |
| 9 | `render-poc/motor-curado/gemini-curado.mjs`, 34–68 | `numerosSustentados` | Toda data, número ou medida da resposta precisa estar nos fatos. |
| 10 | `render-poc/motor-curado/gemini-curado.mjs`, 112–200 | `json` e `chamarComReserva` | Chamada ao Gemini: saída em JSON, sem ferramentas, filtros de segurança, troca de modelo e pausa. |
| 11 | `render-poc/motor-curado/curadoria-local.mjs`, 56–92 | `elegivel` | Uma entrada só vale com fonte verificável e dentro da vigência e do público. |
| 12 | `render-poc/motor-curado/contexto-curado.mjs`, 75–165 | `resolverConversaCurada` | Perguntas de acompanhamento, com contexto tirado só das mensagens do usuário. |
| 13 | Uma entrada de `knowledge-local/faq-curada.json` | Exemplo da seção 3 | O que é um "fato aprovado". |

## 9. Trechos para os slides

Trechos curtos e já resumidos, para caber em um slide cada.

**Slide "Fluxo do modo híbrido"** (`render-poc/motor-curado.cjs`):

```js
// Gemini falhou, mas a busca achou um fato aprovado inequívoco: mostra o texto aprovado.
if (resultado.tipo === 'falha' && resultado.reserva) return resultado.reserva;
// Nenhum fato aprovado: o fluxo documental (RAG sobre os documentos) responde.
if (modo === 'hibrido' && semEvidencia) return null;
```

**Slide "Busca híbrida"** (`curadoria-local.mjs`):

```js
const sem = cos(vetorPergunta, vetores.valores[r.id]);        // significado (embeddings)
const confianca = exata ? 1 : Math.max(cobertura * .8, sem * .75);
r.score = 1 / (60 + posLexical) + 1 / (60 + posSemantica);    // Reciprocal Rank Fusion
const selecionados = candidatos.filter(r => r.confianca >= 0.42).slice(0, 5);
```

**Slide "Pergunta exata: resposta sem IA"** (`gemini-curado.mjs`):

```js
if (primeiro?.exact) // pergunta igual a uma pergunta aprovada
    return {texto: primeiro.registro.resposta, tipo: 'curado_direto'}; // ~40 ms, sem Gemini
```

**Slide "O que o Gemini recebe"** (`gemini-curado.mjs`):

```js
const fatos = selecionados.map(r => ({id: r.id, texto: r.resposta})); // só fatos aprovados
json(modelo, PROMPT_CURADO, {pergunta, escopo, fatos}, schemaResposta);
// devolve {resposta: "...", ids: ["frequencia"]}: quais fatos foram usados
```

**Slide "Antialucinação"** (`gemini-curado.mjs`):

```js
if (!numerosSustentados(p.resposta, fatosCitados)) throw Error('NUMERO_OU_DADO_NAO_SUSTENTADO');
if (/https?:\/\//.test(p.resposta) || p.resposta.includes('?')) throw Error('LINGUAGEM');
const {sustentada} = await revisar({pergunta, fatos, resposta}); // segunda IA confere
if (sustentada !== true) throw Error('NAO_SUSTENTADA');          // reprovada nunca aparece
```

**Slide "Privacidade"** (`gemini-curado.mjs`):

```js
if (filtro(pergunta)) // CPF, RA, nomes, contatos pessoais: bloqueados ANTES de chamar a IA
    return {texto: 'Reformule sua pergunta sem nomes, números de identificação ou dados pessoais.'};
```

## 10. Perguntas prováveis da banca

- **"Se a IA errar?"** A resposta gerada passa por duas verificações: o código confere formato, números, datas, dados pessoais e linguagem, e uma segunda chamada ao Gemini confere se tudo está nos fatos. Se reprovar, ela não aparece. Para as perguntas mais comuns, a resposta é o texto aprovado, sem IA.
- **"De onde vêm as informações?"** Das fontes oficiais: site da ETEC, Regimento, Calendário Escolar, portal do Vestibulinho e avisos da Secretaria no NSA. Cada fato guarda a URL, o trecho literal e o hash.
- **"Por que não usar só o ChatGPT ou o Gemini?"** Porque ele responderia com conhecimento genérico e poderia inventar regras da escola. Aqui ele só redige a partir dos fatos aprovados.
- **"O que é RAG?"** Recuperar informações relevantes de uma base e gerar a resposta com elas. No Sylvinho, a recuperação é a busca híbrida (palavras e significado) e a geração é do Gemini, presa aos fatos.
- **"E se a internet ou o Gemini cair?"** As perguntas exatas e as que têm um fato inequívoco respondem com o texto aprovado. As outras recebem o aviso para tentar de novo.
- **"E os dados dos alunos?"** Dados pessoais são bloqueados antes de qualquer chamada externa. O Gemini não recebe nome nem e-mail, e cada conta só vê as próprias conversas.
- **"Como atualizar a base?"** Edita-se `faq-curada.json` com a fonte e a evidência, roda-se `npm run indexar` e publica-se. O passo a passo está no documento de manutenção.
