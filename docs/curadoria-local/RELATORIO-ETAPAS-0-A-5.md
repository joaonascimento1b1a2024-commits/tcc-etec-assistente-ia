# Sylvinho: resultado local das etapas 0 a 5

Data: 12/11/2026. A bancada foi executada com resultados e pendências abaixo. **A composição nova não foi ligada ao chat nem ao servidor.** Não houve commit, push, deploy, importação no Firebase ou alteração de modo do RAG.

## Resultado principal

| Verificação | Resultado | Limite da conclusão |
|---|---|---|
| Regressões anteriores | 260/260 passaram | Mesmo conjunto de regressão estabelecido na etapa 0 |
| Testes novos | 24/24 passaram | Políticas, filtros, falhas de provedor, revisão e privacidade |
| Avaliação de política/recuperação | 56/56 passaram | Usa rascunhos curados; **não são 56 respostas do Gemini** |
| Embeddings reais | 43 fatos e 44 consultas vetorizados | Cache local com `gemini-embedding-001`, sem banco remoto |
| Gemini 3 Flash real | Quatro respostas, duas perguntas distintas, em duas rodadas | Todas sustentaram os fatos de presença e idade; amostra pequena |
| Linguagem na última rodada real | Sem saudação, fontes técnicas ou perguntas finais | Só duas respostas após o ajuste; não certifica o conjunto inteiro |
| Tempo real | Rodada inicial: 20,241 s e 12,903 s; final: 3,187 s e 2,747 s | Média das quatro: **9,770 s**; meta global de 8 s **não atingida nessa amostra** |
| Build / TypeScript / lint | Passaram | `functions/`; sintaxe dos módulos novos também conferida |

**Não certifico correção factual de ≥95% para 50 respostas reais.** O conjunto de desenvolvimento passou na recuperação, mas faltam uma avaliação completa de geração e um conjunto independente. A última rodada real foi melhor, porém a variação de latência impede prometer 8 segundos.

## Etapa 0 — diagnóstico e proteção

- Base anterior: 290 trechos, busca lexical BM25, timeout de 30 s e composição Gemini 3 Flash Preview. A composição sem RAG continuou preservada; nenhum servidor foi iniciado nesta rodada.
- Na conferência final não havia processos ouvindo nas portas locais 4400, 5000, 5002, 8080 e 9099. Preservar a configuração anterior não significa que o servidor esteja em execução.
- Os 260 testes passaram antes do trabalho e na regressão final.
- Backup: `C:\Programação\Backups\sylvinho-curadoria-2026-11-12T13-05-13-515Z`, com manifesto e hashes. Inclui as entradas recebidas e os arquivos existentes relevantes, sem copiar chave de API.
- SHA-256 da base de 290, antes e depois: `99225eef1834bd13b968c32ceb0ff4ac1762b3f94ff7c6d2df5aeab967041074`.
- Fontes antigas foram lidas do stash para uma pasta separada, com conferência dos hashes. O stash não foi aplicado.

## Etapa 1 — coleção curada

Foram criadas **43 entradas aprovadas**: 36 fatos/respostas e sete contatos. Cada entrada tem pergunta, quatro variações, resposta, categoria, escopo, vigência, confirmação, evidência interna, versão e substituições. As aprovações significam conferência da fonte primária, não confirmação telefônica pela Secretaria nem garantia de ausência de normas posteriores.

A Parte B foi convertida em **131 propostas**, incluindo itens subordinados e descrições de modalidade. As alegações continuam fora do índice. Identificações de ocupantes de cargos foram omitidas da proposta correspondente. As **200 perguntas** foram preservadas individualmente: **96** receberam alguma alegação para revisão e **104** continuam sem dado, com resposta `null`. **45** perguntas têm ligações explícitas para partes oficiais já aprovadas; isso não transforma sua pendência operacional numa resposta completa.

Não se deve somar essas listas como fatos independentes: há sobreposição intencional entre perguntas, propostas recebidas e fatos atômicos. Só `faq-curada.json` foi usado no índice experimental.

Decisões aplicadas:

- Camiseta ~R$ 50, declaração em até um dia, renovação via NSA, merenda às 10h20 e TCC no terceiro ano com banca continuam em revisão, sem indexação dessas alegações.
- Para essas perguntas, a expectativa é confirmação pela Secretaria; os testes não exigem o valor ou prazo informal.
- O período oficial da renovação pode ser respondido, sem afirmar qual sistema a escola usa.
- Matrícula: a partir de 16 anos pelo próprio candidato; abaixo de 16 pelo representante legal. A orientação informal para todos os menores irem acompanhados não virou obrigação.
- Saída antecipada de menor de 18 anos: regra local do folder conferida; preservada também a hipótese de liberação pela Coordenação de Curso na ausência dos responsáveis indicados.
- PTD: referência normalizada para **104-VIII**. Os arquivos originais em Downloads não foram editados.
- Declarações, históricos, diplomas e transferências não receberam formulários, preços ou prazos inventados.

Fontes conferidas: PDF do Regimento Comum 87/2022 (artigos completos usados nas respostas), folder local revisado em 26/02/2024, calendário geral 2026 alterado em 20/03/2026, páginas oficiais de contato/APM/cursos/TCC, calendário oficial do Vestibulinho e portaria de matrícula vinculada nesse portal. As duas páginas do calendário escolar também foram conferidas visualmente.

## Etapa 2 — busca e resposta, em composição separada

O motor novo pesquisa pergunta, variações e resposta. Filtra status, evidência, conflito declarado, substituição, ano, vigência e escopo **antes** de pontuar os candidatos. Combina BM25 e cosseno dos embeddings por fusão de posições, considera até 15 candidatos e seleciona até cinco. A FAQ recebe preferência; o escore de confiança é heurístico, não uma probabilidade calibrada.

Datas escolares não são recuperadas de uma entrada sobre Vestibulinho só porque ambas mencionam 2027. O calendário geral também não é extrapolado para Enfermagem, que não aparece na lista de cursos desse PDF. Quando nada elegível resta, há encaminhamento cauteloso à Secretaria.

As referências dos fatos normativos guardam o artigo completo, seus parágrafos e exceções. O modelo recebe a síntese curada limpa e IDs opacos; títulos de PDF e links ficam internos. **Os 290 trechos não foram todos promovidos para o índice híbrido novo.** Continuam preservados no corpus anterior; ampliar a curadoria deles permanece trabalho posterior. Não há abertura geral dos bloqueios de cursos ou horário da Secretaria: só as partes aprovadas são utilizáveis.

O histórico é limitado e reescrito por regras para os acompanhamentos reconhecidos, antes da busca. Isso cobre o prazo da renovação e pedido de referência, mas não equivale a uma memória conversacional geral para qualquer assunto.

A composição Gemini usa temperatura 0,3, filtros locais, configurações de segurança do provedor, saída estruturada, IDs recuperados, bloqueio de números não sustentados e uma revisão semântica separada. Falha de validação não vira resposta factual. Fontes só são anexadas quando solicitadas. Saudações e esclarecimentos ficam sob controle da aplicação, sem pergunta final automática do modelo.

Modelo principal: `SYLVINHO_GEMINI_MODEL`, padrão `gemini-3-flash-preview`. Reserva local: `SYLVINHO_GEMINI_FALLBACK_MODEL`, padrão `gemini-2.5-flash`; um valor vazio a desativa. Embeddings: `SYLVINHO_EMBEDDING_MODEL`, padrão `gemini-embedding-001`. A reserva foi testada com HTTP 429 simulado, inclusive na revisão; não houve troca forçada de modelo em chamadas reais. Há limite total de 30 s, exclusão de chamadas concorrentes e espera após 429, sem repetição indefinida.

## Etapa 3 — sete contatos

Cada contato tem aprovação própria, URL, evidência e hash. A coleta de **11/11/2026 é declarada nos materiais**; a reconferência efetiva desta rodada foi em **12/11/2026**. Essas datas não foram confundidas.

| Contato | Origem conferida |
|---|---|
| WhatsApp Secretaria: (16) 99637-1226 | Página Contato; apoio do folder, p. 2 |
| WhatsApp Orientação: (16) 99716-1071 | Página Contato |
| WhatsApp geral: (16) 99189-2181 | Link público `wa.me` no HTML oficial; não confundir com telefone fixo |
| e103dir@cps.sp.gov.br | Página Contato |
| e103adm@cps.sp.gov.br | Página Contato |
| e103acad@cps.sp.gov.br | Texto da página Contato e folder, p. 2; não usar o `mailto` divergente |
| e103apm@cps.sp.gov.br | Página da APM |

O filtro novo aceita somente esses sete valores com origem registrada. E-mails parecidos, telefones pessoais, CPF, identificadores, credenciais e instruções suspeitas continuam bloqueados. A lógica dos botões/links de WhatsApp e o filtro global existente não foram alterados.

## Etapa 4 — Instagram

Coleção vazia, esquema de entrada, validação e conversão isolada foram criados. Exigem publicação, fim de validade, URL do post, revisão humana, status e declaração de ausência de dados pessoais. A conversão atribui prioridade 5, inferior às fontes oficiais.

Nenhum post foi coletado, importado ou aprovado. Não houve scraping nem login. A revisão humana de nomes e de conflitos é necessária; o detector de dados pessoais não prova que um texto está anônimo. Falta receber os posts com datas e validade, conforme combinado.

## Etapa 5 — resultados, falhas encontradas e limites

Os primeiros 30 cenários correspondem à Parte C, com as expectativas informais corrigidas. Foram acrescentados 26: idades 15/16/17, troca de ano e curso, calendário vencido, acompanhamento do prazo, foto ausente, contatos, procedimentos sem confirmação e temas próximos.

Durante a avaliação, foram encontradas e corrigidas:

1. Busca lexical: falhas em contato genérico, critérios, recuperação e bullying; pergunta de horário sem assunto precisava de esclarecimento.
2. Busca vetorial: aproximava recesso de 2027 de Vestibulinho ou curso. O filtro de domínio e escopo passou a excluir essas trocas antes do ranking.
3. Filtro de contato: o padrão anterior não reconhecia alguns telefones com parênteses. A camada local agora também bloqueia esses contatos quando não estão na lista fechada.
4. Gemini: fazia perguntas finais dispensáveis. O prompt e a validação passaram a impedir esse comportamento.
5. Lint: uma linha de 83 caracteres já existente no handler. Foi feita somente uma quebra de linha, comprovada contra o backup sem alterar os tokens.

O último ensaio híbrido passou nos **56/56 casos**, com zero jargão técnico não solicitado nos rascunhos. Esse é um conjunto de desenvolvimento conhecido; não há conjunto independente nem validação factual completa das respostas geradas.

As respostas reais da última rodada foram:

> Você precisa de pelo menos 75% de presença no total das aulas, considerando o conjunto das matérias. Notas boas não compensam frequência abaixo desse limite mínimo.

> Sim, se você tiver a partir de 16 anos, pode realizar sua própria matrícula. Caso tenha menos de 16 anos, o procedimento deve ser feito obrigatoriamente pelo seu responsável legal.

Foram quatro chamadas reais de geração e quatro de revisão, nas duas rodadas. A amostra real foi limitada considerando a cota gratuita já discutida. A avaliação completa de pelo menos 50 respostas fica pendente; os testes com transporte simulado estão identificados como tais.

Regressão final: **284 passaram, zero falhas**. Comando reproduzível: `node scripts/verificar-curadoria-local.mjs`. O conjunto estabelecido usa `--test-skip-pattern='formato real gerado'` para um caso antigo dependente de fixture ausente; ele já era excluído no diagnóstico inicial. Não se declara que todos os testes de qualquer pasta do repositório foram executados. O contador do conjunto selecionado é 284, incluindo os 260 de referência.

Cobertura dos 24 testes novos: linhas — motor de curadoria 97,50%, embeddings 100%, geração 100%; branches — 81,05%, 86,36% e 73,58%. O total dessa execução incluindo o contrato legado importado ficou em 78,91% de linhas. Não é uma medição da cobertura total do projeto.

## Pendências concretas

1. Avaliar pelo menos 50 respostas **realmente geradas**, com conjunto independente, orçamento de cota e avaliação de sentido/condições; não apenas palavras esperadas.
2. Melhorar e medir latência em amostra representativa. A última média de 2,967 s não elimina a média de 9,770 s das quatro respostas observadas.
3. Confirmar na Secretaria os dados AL e procedimentos locais: valor de uniforme, prazos de emissão, NSA, merenda, banca, canais, formulários e atendimento atualizado. Até lá, continuam em revisão.
4. Continuar a conferência das propostas OF/PA restantes, especialmente horários por turma, cursos ofertados no processo atual, matrizes/PPC, benefícios e atos posteriores.
5. Examinar os prazos específicos de reconsideração/reclassificação e recurso escritos no calendário 2026; não tratá-los como inexistentes, nem generalizá-los para qualquer período. Veja `DIVERGENCIAS-E-PENDENCIAS.md`.
6. Receber os avisos do Instagram com origem, publicação e validade.
7. Quando houver instrução explícita para testar o RAG no chat, conectar esta composição ao adaptador autenticado, conservar isolamento de conversas e testar no navegador. Essa integração e a validação visual do chat **não ocorreram nesta rodada**.

## Arquivos e reversão

`knowledge-local/`: fatos conferidos, FAQ, propostas da Parte B, fila das 200 perguntas, contatos, esquema/coleção Instagram e casos de avaliação.

`local-e2e/`: `curadoria-local.mjs`, `embeddings-curados.mjs` e `gemini-curado.mjs`.

`scripts/`: preparação/backup, conferência de fontes/portaria, geração da coleção, indexação, avaliação offline/real, consulta isolada e verificação. Os nomes e hashes individuais constam de `manifesto-entrega.json`.

`tests/curadoria-local.test.mjs`: 24 testes novos. `docs/curadoria-local/`: este relatório, divergências e evidências JSON das avaliações. PDFs, extrações, imagens de conferência e vetores ficam em `.cache/curadoria-sylvinho/`, sem chave de API.

Único arquivo existente editado nesta rodada: `functions/src/assistente/handler.ts`, apenas quebra de linha para o lint. Os demais arquivos existentes protegidos pelo backup permaneceram idênticos. `public/`, autenticação, regras do Firestore, Figma remoto, logos, imagens originais e configuração do servidor não foram alterados.

Consulte `COMO-TESTAR-E-REVERTER.md`. A reversão deve usar o backup desta rodada e a lista desta entrega, sem `git reset --hard`, `git clean` ou aplicação do stash.
