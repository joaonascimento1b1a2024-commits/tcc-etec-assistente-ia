# Motor curado no Render

Data: 16/11/2026. Branch `feat/motor-curado-render`. Etapas 1 e 2 do [plano](PLANO-MOTOR-CURADO-RENDER-2026-11-16.md): código e testes locais. Sem commit, push, deploy, alteração no Render ou chamada paga.

## O que mudou

| Arquivo | Mudança |
| --- | --- |
| `render-poc/motor-curado/*.mjs` | Os seis módulos do motor saíram de `local-e2e/` (pasta de ensaio) para o servidor. `local-e2e/` mantém atalhos `export *`, então scripts e testes antigos continuam iguais. |
| `render-poc/motor-curado/gemini-curado.mjs` | Novo parâmetro `chaveFila`: separa a vez na fila do cache. Visitantes dividem o cache público, mas não se bloqueiam como se fossem uma única conta. |
| `knowledge-local/embeddings-curados.json` | Índice vetorial versionado (cópia de `.cache/curadoria-sylvinho/embeddings.json`, hash idêntico ao das 44 entradas aprovadas). |
| `render-poc/motor-curado.cjs` | Adaptador: lê `SYLVINHO_MOTOR`, carrega a base, chama o motor e traduz o resultado para o contrato do servidor. |
| `render-poc/documental.cjs` | Com `hibrido`/`curado`, acrescenta `responderConversa` e `responderVisitante`. Com `fluxo` (padrão), as dependências continuam idênticas. Valor inválido impede a subida. |
| `render-poc/server.cjs` | Rota visitante repassa o gancho; `/health` do modo documental informa `motor` e `revisao` (commit curto do Render). |
| `functions/src/assistente/handler.ts` | `responderConversa` pode devolver `null` = sem evidência; o fluxo documental continua a partir daí. |
| `functions/src/assistente/visitante.ts` | Gancho opcional `responderVisitante`; erros recuperáveis viram 429/503 com `Retry-After`, como na rota da conta. Antes eram 500. |

## Modos

| `SYLVINHO_MOTOR` | Comportamento |
| --- | --- |
| ausente ou `fluxo` | Igual à versão anterior. |
| `hibrido` (recomendado) | Motor curado primeiro. Sem evidência nas 44 entradas, o fluxo documental responde. |
| `curado` | Só o motor curado; sem evidência, orienta procurar a Secretaria. |

`hibrido`/`curado` exigem `GEMINI_API_KEY`. Sem ela, o servidor registra `GEMINI_API_KEY_AUSENTE`, usa `fluxo` e o `/health` mostra `motor: "fluxo"` com `motorSolicitado`.

Regras do modo híbrido:

- Vai ao fluxo antigo: `sem_evidencia` e `BUSCA_INDISPONIVEL` (busca vetorial fora e nenhum resultado por palavras), além de falha ao carregar o motor.
- **Não** vai ao fluxo antigo: respostas pendentes deliberadas (preço da camiseta, horário da Secretaria etc.), fora de escopo, saudações e esclarecimentos. Assim o fluxo antigo não tenta preencher o que a curadoria marcou como não confirmado.
- **Lista de modelos (16/11):** `SYLVINHO_GEMINI_FALLBACK_MODEL` aceita vários modelos separados por vírgula. Geração e revisão tentam a lista em ordem quando um modelo responde 429, 5xx, falha de rede ou passa de 8 s; o modelo que deu 429 fica em espera (30 s ou o `Retry-After`) e é pulado nas perguntas seguintes. No plano gratuito cada modelo tem cota própria, então a lista soma capacidade.
- **Limite em todos os modelos:** no híbrido, se todos derem 429 ou falha do provedor (5xx/rede), o fluxo antigo responde. Essas recusas são rápidas (menos de 2 s), então cabe o tempo do fluxo. No modo `curado`, continua erro recuperável (`LIMITE_USO`).
- Tempo excedido (`TIMEOUT` geral ou `PROVEDOR_TIMEOUT`) e resposta reprovada na validação viram erro recuperável com nova tentativa. Não caem no fluxo antigo, para não somar dois tempos de espera.
- **Chat visitante, perguntas sem palavra-chave (16/11):** a classificação local por palavras-chave (`classificarEscopo`) não reconhece assuntos como "técnico junto com o ensino médio" e devolvia "Sobre qual procedimento…" antes de consultar o motor. Agora fora de escopo e saudação continuam locais, e as ambíguas passam pelo motor curado (busca semântica). Sem fato aprovado, o esclarecimento se mantém, sem acionar o fluxo antigo. A rota da conta já consultava o motor antes da classificação.
- **Regimento com moderação (16/11):** a resposta pode citar o Regimento uma vez, e só quando o fato aprovado já o menciona. "Artigo", "trecho", "fonte", links e saudações continuam barrados (`LINGUAGEM`). Referências completas só quando o aluno pede a fonte.
- O motor tem limite de 20 s, abaixo dos 30 s do cliente e do servidor.
- Visitante sem histórico: esclarecimentos ganham o aviso de reenviar a pergunta completa.

Modelos conferidos em 16/11 com a chave local (uma chamada mínima cada, com o mesmo JSON e configuração do motor):

| Modelo | Situação |
| --- | --- |
| `gemini-2.5-flash` | usado na avaliação; principal recomendado |
| `gemini-3.1-flash-lite`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.6-flash` | respondem no plano gratuito; rodada de 3 perguntas com respostas fiéis aos fatos. `3.6-flash` bateu no limite por minuto após 4 chamadas; `3.5-flash` teve uma revisão acima de 8 s. |
| `gemini-3-flash-preview` | funciona; limite gratuito de 20 pedidos/dia |
| `gemini-3.7-flash`, `gemini-3.8-flash` | recusam `thinkingLevel: minimal`; fora da lista |
| `gemini-2.5-flash-lite` | indisponível para chaves novas |

Ordem sugerida: `SYLVINHO_GEMINI_MODEL=gemini-2.5-flash` e `SYLVINHO_GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3-flash-preview`. A chave do Render pode ter cotas diferentes da local.

Logs `SYLVINHO_MOTOR` registram tipo, modo de busca, código e tempo; nunca a pergunta, a resposta ou a chave.

## Verificação

- Linha de base antes das mudanças: 1.315 testes, 1.296 aprovados, 17 falhas pré-existentes (fixtures ausentes, emuladores desligados, página antiga, quebras de linha).
- Depois: 1.333 testes, 1.314 aprovados, **as mesmas 17 falhas e nenhuma nova**. Os 18 testes novos passam.
- Filtro usado: `--test-skip-pattern="formato real gerado|Node HTTP -> fabrica Render -> RAG original"`.
- `render-poc` `npm test`: 32/32. Build e lint das Functions aprovados. `git diff --check` limpo.
- Testes novos (`tests/motor-curado-render.test.mjs` e dois no handler):
  - modos e chave ausente;
  - integridade do índice;
  - trancamento usando o fato correto;
  - sem evidência → fluxo;
  - pendência sem fluxo;
  - 429 e validação;
  - cache por conta;
  - visitantes simultâneos;
  - aviso de esclarecimento;
  - logs sem dados;
  - falha de carga;
  - rota visitante;
  - servidor documental completo via HTTP com health.

Sondagem sem IA: o roteamento real de 15 perguntas foi conferido com o provedor simulado. Trancamento, renovação, documentos, idade, celular e WhatsApp vão para o motor curado. Preço e horário da Secretaria ficam como pendentes. Estágio, progressão parcial, dois cursos e revisão de nota caem no fluxo. Sem a busca vetorial, "frequência mínima" também cai no fluxo, que a responde corretamente.

## Limites e próximos passos

- Nenhuma resposta real foi gerada nesta etapa; qualidade factual depende da etapa 4 (comparação com orçamento de chamadas).
- "Como faço minha matrícula" não aciona o esclarecimento da política (a regra cobre "a matrícula"); segue para resposta gerada. Ajuste de política é melhoria futura.
- As quatro revisões humanas pendentes (celular em aula, saída antecipada, uniforme, calçado) continuam valendo para o conteúdo dessas entradas.
- Ao alterar `knowledge-local/faq-curada.json`, reindexar e copiar o índice; o teste de integridade falha se o hash divergir.
