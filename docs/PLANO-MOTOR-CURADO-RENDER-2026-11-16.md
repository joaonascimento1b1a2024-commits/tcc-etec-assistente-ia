# Plano — levar o motor curado ao Render

Data: 16/11/2026. Etapas 1 e 2 implementadas localmente na branch `feat/motor-curado-render`: ver [MOTOR-CURADO-RENDER.md](MOTOR-CURADO-RENDER.md). Etapas 3 a 5 pendentes de autorização.

## Por que

Teste no site publicado (conta de teste, 16/11): "Posso trancar a matrícula? Como funciona?" recebeu "Sobre matrícula, não encontrei orientações completas…". O mesmo tema foi respondido corretamente pelo motor curado local na rodada real do mesmo dia (`IA-RODADA-REAL-LOCAL-2026-11-16.md`). A pergunta de frequência funcionou nos dois.

## Situação atual no código

| | Render (produção) | Motor curado (local) |
| --- | --- | --- |
| Entrada | `render-poc/server.cjs` → `documental.cjs` | `scripts/iniciar-rag-gemini-local.mjs` |
| Motor | `criarFluxoPerguntaLivre` (trechos no Firestore, provedor por `SYLVINHO_IA_PROVIDER`, exemplo atual `openrouter`) | `criarGeminiCurado` em `local-e2e/gemini-curado.mjs` |
| Base | trechos documentais no Firestore | `knowledge-local/faq-curada.json` (44 registros) + `contatos-publicos.json` + vetores em `.cache/curadoria-sylvinho/embeddings.json` (430 KB, ignorado pelo Git) |
| Provedor | OpenRouter/Gemini via `functions/lib/assistente/geracao` | Gemini direto (`generativelanguage.googleapis.com`), chave `GEMINI_API_KEY`, reserva `gemini-2.5-flash` |
| Rota autenticada | `gerarResposta` + `recuperarConhecimento` | `deps.responderConversa` — **gancho já existe** em `functions/src/assistente/handler.ts:66` e `:314` |
| Rota visitante | `visitante.ts` usa `recuperarConhecimento` + `gerarResposta` | sem gancho equivalente |

Pontos que impedem copiar diretamente:

1. O motor está em `local-e2e/`, pasta de testes, em ESM; o servidor Render é CommonJS.
2. Os vetores estão em `.cache/`, que não vai para o Render.
3. O motor usa Gemini direto; o Render está configurado para OpenRouter.
4. A rota visitante não tem gancho para um motor de conversa.
5. O lançador local grava eventos em arquivo e depende de emuladores; produção precisa de logs no console e Firebase real.
6. Cobertura: o motor curado só conhece 44 registros aprovados. Fora deles devolve "sem evidência", enquanto o fluxo antigo busca nos 290 trechos. Trocar sem cuidado pode **piorar** perguntas que hoje funcionam.

## Decisões necessárias antes de implementar

| # | Decisão | Recomendação |
| --- | --- | --- |
| D1 | Provedor do motor curado | Gemini direto com `GEMINI_API_KEY` no Render (o motor já está validado assim). Alternativa: adaptar o transporte ao OpenRouter — mais trabalho e nova validação. |
| D2 | Pergunta fora dos 44 registros | **Híbrido:** motor curado primeiro; se devolver `sem_evidencia`, cair no fluxo documental atual. Não usar o fluxo antigo em falhas técnicas (429, timeout), só em falta de evidência. |
| D3 | Vetores | Versionar `knowledge-local/embeddings-curados.json` (derivado de fatos públicos aprovados, sem segredo, com hash do índice). Sem ele a busca fica só lexical. |
| D4 | Ativação | Variável `SYLVINHO_MOTOR=fluxo|curado|hibrido`, padrão `fluxo`. Rollback = trocar a variável e reiniciar, sem novo deploy. |

## Etapas

### 1. Branch e mudança de lugar (sem mudar comportamento)
- Branch `feat/motor-curado-render` a partir da `main` atual.
- Mover os módulos do motor (`gemini-curado`, `curadoria-local`, `contexto-curado`, `cache-respostas-curadas`, `concorrencia-curada`, `embeddings-curados`) para `render-poc/motor-curado/`, mantendo reexportações em `local-e2e/` para os scripts e testes existentes continuarem funcionando.
- Copiar o índice de vetores para `knowledge-local/` (D3).

### 2. Adaptador no Render
- Novo `render-poc/curado.cjs`: carrega o motor por `import()`, lê registros/contatos/vetores, chave por `lerAmbiente`, logs por `console.info` sem pergunta nem dados pessoais.
- Em `documental.cjs`: conforme `SYLVINHO_MOTOR`, expor `responderConversa` (rota autenticada) e o modo híbrido de D2. Com `fluxo`, o objeto retornado deve ser idêntico ao de hoje.
- `visitante.ts`: aceitar dependência opcional `responder(pergunta)`; sem ela, caminho atual. Visitante sem histórico; cache em namespace próprio `visitante`, separado das contas.
- `/health`: acrescentar `motor`, versão do código e número de registros, sem segredos.
- Alinhar tempos: o motor tem limite de 30 s e o cliente usa `timeoutMs` de 30 s — o servidor precisa terminar antes do cliente desistir (ex.: motor 25 s).
- Mapear `retentavel` para `ErroRespostaTemporaria`, como o lançador local já faz, preservando retry sem duplicação.

### 3. Testes (sem chamadas pagas)
- Regressão atual inteira com `SYLVINHO_MOTOR=fluxo` — deve continuar idêntica.
- Novos: motor com transporte simulado nas duas rotas; híbrido cai no fluxo só em `sem_evidencia`; 429/timeout viram erro temporário; namespace do visitante isolado; health sem segredos; CORS e autenticação inalterados.
- Build/lint das Functions e `render-poc` `npm test`.

### 4. Avaliação comparativa (com orçamento)
- Mesmo conjunto de ~20 perguntas (frequência, matrícula com idade, estágio, trancamento, renovação, fora de escopo, dado pessoal) nos modos `fluxo` e `hibrido`, localmente com emuladores.
- Limite de chamadas reais definido antes (ex.: 40). Registrar acertos, recusas corretas, tempo e custo. Critério para seguir: `hibrido` não piora nenhuma pergunta que `fluxo` acerta.

### 5. Publicação (precisa de autorização em cada passo)
1. Commit/push da branch e revisão do grupo.
2. Merge na branch ligada ao Render.
3. Deploy com `SYLVINHO_MOTOR=fluxo`: smoke (`scripts/verificar-publicacao-sylvinho.mjs`) e uma pergunta — comportamento igual ao atual.
4. No painel do Render: adicionar `GEMINI_API_KEY` (D1) e mudar para `hibrido`. Feito por quem tem acesso ao painel; a chave não passa pelo chat.
5. Repetir: smoke, visitante (frequência e trancamento) e logado pelo navegador; conferir `/health` com `motor: hibrido`.
6. Se algo piorar: voltar a variável para `fluxo`.

## Riscos

- Cota gratuita do Gemini: com uso real o 429 aparece; o motor já trata com espera e mensagem própria, mas o TCC não deve depender de pico de uso na apresentação.
- Início frio do Render (12–15 s medidos): soma ao tempo de resposta na primeira pergunta.
- Hosting (frontend) não muda nesta integração; nenhum novo deploy do Firebase é necessário.
- Base de 44 registros ainda é pequena; ampliar a curadoria continua sendo o que mais melhora as respostas.

## Estimativa

Etapas 1–3: uma sessão de trabalho. Etapa 4: depende da cota. Etapa 5: curta, mas exige as autorizações listadas.
