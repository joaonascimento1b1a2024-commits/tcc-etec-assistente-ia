# Continuidade, cache e avaliação local

12/11/2026. Alterações carregadas na composição `--faq-curada` do chat local. Sem commit, push, deploy ou importação em Firebase de produção.

## O que melhorou

- Acompanhamentos como “onde entrego?”, “precisa de responsável?”, “qual o prazo?” e “e no meu curso?” usam o assunto da conversa. Curso, turno, idade declarada e ano são extraídos das mensagens do usuário; não são inferidos das respostas do bot.
- Pergunta nova não herda automaticamente os detalhes de um assunto anterior. Troca explícita de curso ou ano atualiza o escopo. Assunto desconhecido encerra a referência anterior.
- Matrícula inicial, renovação, trancamento, transferência e saída antecipada permanecem distintos. A regra de responsável na matrícula não é aplicada automaticamente à saída ou à renovação.
- Quando falta contexto, há um esclarecimento curto. “Como faço a matrícula?” distingue inicial e renovação. “E no meu curso?” pede o curso quando ele não foi identificado.
- Canal de entrega, procedimento local e lista de renovação não são inventados. Um acompanhamento sobre prazo em 2027 não recebe datas do calendário de 2026.
- O modelo e a revisão semântica recebem o escopo resolvido. A autenticação, a propriedade da conversa, a pendência de envio e a proteção contra duplicação foram preservadas.

## Cache seguro

Somente respostas geradas **e aprovadas pela revisão** entram no cache. Ele fica em memória, por até cinco minutos, com limite de 128 entradas; não grava conversas nem segredos em disco.

A chave considera a conta autenticada, pergunta, contexto necessário, escopo, dia, catálogo completo, contatos, prompt e modelos configurados. Perguntas autônomas iguais podem reaproveitar a resposta na mesma conta; acompanhamentos consideram o histórico relevante. Contas distintas não compartilham entrada.

Erros, informações pendentes, saudações e referências não são armazenados como geração validada. Entrada com dados pessoais continua bloqueada antes da consulta ao cache. Mudança do catálogo carregado ou do escopo invalida a chave; reiniciar o backend esvazia o cache. Alterações de fontes em arquivo exigem a atualização normal do catálogo/índice e reinicialização, não são aprovadas automaticamente.

O cache reduz chamadas repetidas quando já existe resposta validada. Ele não elimina a cota da API nem cria uma resposta para uma pergunta ainda não respondida.

## Verificação

- Build e lint de `functions/`: passaram.
- Regressão selecionada: **310 testes passaram**. Mantido o recorte já estabelecido nas entregas anteriores, com exclusão do teste antigo dependente da fixture ausente `formato real gerado`.
- Casos offline de recuperação/política: **56/56** passaram.
- Dez testes novos cobrem contexto, mudança de curso/ano/idade, responsável, ausência de procedimento, expiração do cache, limite de entradas, separação entre contas, fonte alterada, revisão rejeitada e bloqueio de dados pessoais.
- Cobertura da execução focada em curadoria/contexto/cache: **86,40% de linhas e 83,79% de branches**, incluindo o contrato legado importado. Os módulos novos de contexto e cache tiveram 100% de linhas nessa execução. Isso não é a cobertura total do repositório.
- Navegador: conversa com esclarecimento de matrícula, entrega sem canal confirmado, documentos de renovação, prazo em 2027 e curso desconhecido passou sem erro JavaScript.
- A regressão de navegador para 503 simulado, retry manual após recarga, duplo clique e resposta perdida após commit continuou passando. Esses cenários não exigiram chamadas Gemini.

Evidências: `.cache/curadoria-sylvinho/contexto-navegador.json` e `retry-navegador.json`.

## Avaliação real de 50 respostas

Foi criado `scripts/avaliar-50-respostas-curadas.mjs`, com 50 perguntas factuais, limite de chamadas, intervalo entre perguntas, registro de resultados e retomada. Não usa cache de respostas e não conta recusas/falhas como respostas geradas.

Nesta rodada, foram feitas **oito chamadas de geração/revisão**: duas respostas foram geradas e validadas, com média de **2,980 s**. Em seguida a API retornou limite de uso; a rodada parou e as outras 48 perguntas ficaram pendentes. O resultado parcial está em `avaliacao-50-real.json`.

As duas respostas trataram do horário geral da escola, separado do atendimento da Secretaria, e da autorização do professor para uso de celular em aula. Foram conferidas contra os fatos aprovados. A amostra não certifica precisão de 95% nem desempenho geral abaixo de oito segundos.

Os ajustes finais de contexto posteriores à rodada não foram reavaliados com mais geração porque a cota estava indisponível. O avaliador identifica a versão por hash; se o código, catálogo ou casos mudarem, arquiva o resultado anterior e inicia uma avaliação da nova versão, evitando misturar medições.

Para uma próxima rodada, quando houver cota:

```powershell
node scripts/avaliar-50-respostas-curadas.mjs --max-chamadas=12
```

O teto conta as chamadas de geração e revisão, incluindo tentativas nos modelos principal e reserva. Os embeddings são consultas separadas. Resultados automáticos exigem revisão humana; não equivalem a uma certificação factual independente.

## Informações que continuam pendentes

Nenhum dado informal foi promovido a aprovado. Continuam dependendo de confirmação rastreável da Secretaria:

1. Horário atual de atendimento e necessidade de agendamento.
2. Canal e passo a passo de renovação, inclusive confirmação do uso do NSA.
3. Procedimento para quem perde o prazo.
4. Como solicitar declarações, histórico, segunda via e diploma; prazos e eventual custo.
5. Formulários e canais de transferência/trancamento.
6. Entrega de atestado e prazos de acompanhamento.
7. Regras de estágio/TCC por curso e turma, orientador e banca.
8. Valor atual do uniforme e regras de alimentação/benefícios.

A confirmação precisa identificar setor competente, data, resposta e evidência escrita anonimizada. Depois há revisão, versão e atualização do índice. Não foram enviadas mensagens à escola nem preenchidas respostas por suposição.

## Arquivos e reversão

Novos: `local-e2e/contexto-curado.mjs`, `local-e2e/cache-respostas-curadas.mjs`, `tests/contexto-cache-curado.test.mjs`, `scripts/avaliar-50-respostas-curadas.mjs` e `scripts/verificar-contexto-chat-local.mjs`.

Atualizados: `local-e2e/curadoria-local.mjs`, `local-e2e/gemini-curado.mjs`, `scripts/iniciar-rag-gemini-local.mjs` e testes de curadoria. Os dados aprovados da base e os arquivos visuais não foram alterados.

Backup anterior desta rodada: `C:\Programação\Backups\sylvinho-contexto-cache-20261112-124817`. Para reverter somente esta rodada, comparar/restaurar os quatro arquivos existentes dessa cópia e reiniciar o backend local. Os módulos novos ficam sem uso após a restauração dos imports; removê-los somente após conferir alterações posteriores. Preservar os dados e as conversas locais. Não usar reset ou limpeza global do Git.

Chat: http://127.0.0.1:5000/Logado/Home/home.html. O tratamento de falhas e o botão Tentar novamente da entrega anterior continuam ativos. Novas gerações ainda dependem de cota do Gemini.
