# IA: intenção e curso — primeira etapa local

16/11/2026. Trabalho na branch local `feat/ia-confiabilidade-local`, iniciada em `c4b0f17` para preservar `release/tcc-candidate`. Sem commit, push, merge, deploy ou mudança de frontend. Nenhuma chamada Gemini ou embedding externo foi usada nos testes automatizados desta etapa. Foram aplicadas as práticas da skill `ecc:tdd-workflow`; os checkpoints de commit foram omitidos por instrução explícita do usuário de manter as mudanças locais e sem commit.

## Objetivos e resultado

1. Perguntar sobre frequência mínima em Logística não deve ser bloqueado apenas pelo nome do curso. Removido o termo Logística do bloqueio global; a busca continua respeitando escopo, evidência e aprovação. Não foi criada informação sobre oferta desse curso.
2. Um registro restrito a determinados cursos não deve entrar no contexto de geração sem curso conhecido. `elegivel` agora exige esse dado quando há restrição.
3. Se um candidato relevante depende do curso, a busca retorna esclarecimento em vez de passar seus fatos ao modelo. A pergunta é “Qual é o seu curso?”. Regra geral que atende à consulta continua disponível sem pergunta desnecessária.
4. Após o aluno informar o curso, o contexto retoma a pergunta original, com seu ano, em vez de transformá-la em “Como funciona [assunto]?”.
5. Um vizinho semântico genérico não deve substituir uma correspondência mais forte que exige curso. O candidato restrito é usado apenas para detectar necessidade de esclarecimento; não integra o contexto do modelo enquanto faltar curso.

Sem relaxamento dos filtros de pendência, vigência, conflito, dados pessoais ou validação da geração. Não houve alteração nas respostas aprovadas, datas ou contatos institucionais.

## Testes antes e depois

Runner real do projeto: `node --test`; `npm test` da raiz permanece placeholder e não foi usado.

Primeira execução do novo arquivo `tests/ia-escopo-intencao-local.test.mjs`: dez casos executados, seis falharam pelos comportamentos reproduzidos e quatro passaram como controles. Evidência: `.cache/ia-melhorias-2026-11-16/red.log`.

Um teste adicional simulou um vizinho semântico com alta similaridade: falhou inicialmente, porque a busca devolvia `OK` em vez de pedir curso. Evidência: `red-semantico.log`. A pontuação do candidato que depende de curso passou a ser comparada à do candidato geral.

Os doze testes novos passaram após a correção. Um terceiro ciclo RED/GREEN confirmou que um esclarecimento inequívoco não deve sequer esperar uma consulta de embedding. Garantem:

| Garantia | Tipo |
|---|---|
| Frequência em Logística chega à busca e à geração/revisão simuladas | Integração local |
| Calendário restrito exige curso; curso incompatível continua excluído | Unidade |
| Ausência de curso produz esclarecimento sem chamada externa | Integração local |
| Resposta curta com curso preserva pergunta e ano | Integração local |
| Regra geral sem curso não recebe pergunta desnecessária | Integração local |
| Fonte pendente, vencida ou conflitante não provoca esclarecimento enganoso | Unidade |
| Outro assunto não pede curso só porque existe calendário na coleção | Unidade |
| Oferta de curso e informação operacional ausente não são inventadas | Integração local |
| Vizinho semântico genérico não contorna a restrição de curso | Unidade |
| Falta inequívoca de curso não aciona embedding | Unidade |

## Regressão e cobertura

Conjunto final selecionado: **375 testes aprovados, zero falhas**. Inclui os 363 da candidata e os doze novos. O filtro histórico `formato real gerado` foi mantido; o runner informou zero casos pulados. Não é a suíte completa do repositório e não certifica disponibilidade ou qualidade factual geral do Gemini.

Cobertura apenas dos três módulos de IA alterados: **99,68% de linhas, 84,82% de branches e 96,04% de funções**. Não representa a cobertura do produto inteiro.

O avaliador offline de política/recuperação passou **61/61 cenários**. Quatro expectativas antigas permitiam calendário sem curso. Elas foram alteradas para esclarecimento, mantendo os casos com curso explícito e acrescentando seguimento de conversa. O avaliador passou a tratar esclarecimentos da busca e a usar o escopo resolvido do histórico, assim como o gerador.

Os cenários antigos de calendário conservam a data fixa de regressão de 12/11/2026, enquanto os novos testes também usam 16/11/2026. Esse ensaio não é uma auditoria de vigência atual de todas as fontes. O avaliador real de 50 respostas não foi executado nem modificado nesta etapa.

Comandos focados:

```powershell
node --test tests/ia-escopo-intencao-local.test.mjs
node scripts/avaliar-curadoria-local.mjs
```

O comando completo de regressão e seu relatório de cobertura estão registrados em `.cache/ia-melhorias-2026-11-16/regressao-final.log`. Os resultados da execução offline ficam no JSON ignorado já usado pelo projeto, sem fazer parte de publicação.

## Arquivos afetados

- `local-e2e/curadoria-local.mjs`: elegibilidade, esclarecimento na busca e bloqueio por intenção.
- `local-e2e/contexto-curado.mjs`: retomada da pergunta original após curso informado.
- `local-e2e/gemini-curado.mjs`: esclarecimento antes da montagem dos fatos/chamada ao provedor.
- `tests/ia-escopo-intencao-local.test.mjs`: doze regressões novas.
- `knowledge-local/casos-avaliacao.mjs`: expectativas de segurança do calendário e novos controles.
- `scripts/avaliar-curadoria-local.mjs`: paridade do avaliador offline com o fluxo de contexto/esclarecimento.

## Limites e continuidade

Esta etapa corrige os dois primeiros pontos da revisão de IA. Concorrência entre contas, diagnóstico da degradação vetorial, atualização de fontes, amostra independente e paridade com o backend de publicação continuam como próximos trabalhos. O booleano global de ocupado ainda existe; não foi declarado corrigido.

O adaptador local estava desligado no início da implementação. Os emuladores e o adaptador são reiniciados separadamente para carregar os módulos novos; não há hot reload garantido. SDK espelhado permanece exclusivamente no staging ignorado. A IA real continua dependente de cota e disponibilidade do provedor; os testes desta etapa usam transportes simulados.

## Conferência no navegador local

Emuladores Auth/Firestore/Hosting iniciados e adaptador atualizado confirmado com health 200, modo `gemini-rag-curado-local`, 44 entradas. Deixado aberto no navegador em `http://127.0.0.1:5000/Logado/Home/home.html`.

Foi enviada uma pergunta sintética pelo formulário real, com conta emulada: “Quando renovo a matrícula em 2026?”. A resposta exibida foi “Qual é o seu curso?”, com status “Conversa atualizada.”. Os eventos dessa instância registraram somente `RESPOSTA_CURADA`, tipo `esclarecimento`, modo `bm25`, 36 ms no motor, sem evento de chamada ao provedor. Não foi testada uma nova geração paga nesta etapa; o usuário pode continuar a conversa localmente. Evidência: `.cache/ia-melhorias-2026-11-16/navegador-eventos.json`.

Autoavaliação: os problemas foram reproduzidos antes da correção e a regressão passou sem alterar fatos oficiais. A principal limitação é a ausência de nova amostra de geração real; 61 acertos offline não equivalem a 61 respostas Gemini. O julgamento de naturalidade e utilidade em uso real ainda exige observação e avaliação independente.
