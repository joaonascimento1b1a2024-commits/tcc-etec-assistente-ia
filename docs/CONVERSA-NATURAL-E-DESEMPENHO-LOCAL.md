# Linguagem, conversa e desempenho — revisão local

11/11/2026. Orientação: linguagem acolhedora, direta e simples proposta no PDF do usuário, com resposta direta primeiro, detalhes úteis e próximo passo somente quando sustentado. Sem commit, push, deploy ou modificação do Firebase real.

Atualização posterior: migrado localmente para Gemini 3 Flash Preview por solicitação do usuário. A temperatura 0,3 descrita abaixo corresponde à rodada do 2.5; no 3 é preservado o padrão do modelo. O teste real após a troca passou, com quatro HTTP 200 e cerca de 6,6 segundos de geração validada. O relato de 429 abaixo permanece como histórico do 2.5. Ver detalhes em `CHAT-RAG-GEMINI-LOCAL.md`.

## Implementado

- Prompt local incorpora persona de atendente atencioso, concisão, texto corrido por padrão, listas somente para passos/documentos, referências separadas e exemplos de comportamento que não constituem fontes de fatos. Temperatura 0,3 somente na proposta. Revisão e classificação de segurança preservadas; não há texto bruto exibido antes de validação.
- Saudações comuns e alguns erros curtos de digitação recebem resposta acolhedora. A pergunta genérica sobre matrícula distingue inicial de renovação; a resposta curta “renovar” é compreendida após esse esclarecimento.
- Continuações de prazo, documentos, assinatura, local e atendimento online herdam somente um assunto reconhecido na janela autenticada da própria conversa. Histórico integral não é enviado ao modelo; assunto desconhecido ou mudança externa exige esclarecimento.
- Atendimento humano recebe orientação clara, sem simular transferência ou alterar WhatsApp.
- Cursos oferecidos atualmente e horário da secretaria não são deduzidos de norma geral. A falta dessas fontes recebe explicação específica.
- Busca local em memória combina equivalências lexicais, termos exatos e BM25. Recupera até 15 candidatos, seleciona até cinco contextos e limita as evidências citáveis a duas para caber na resposta. Pontuação de busca não é anunciada como probabilidade de confiança. Não usa embeddings ou reranker externo nesta rodada.
- PDF integral do Regimento Comum processado com o extrator e o segmentador por artigo já existentes no backend irmão. Após retirar linhas identificáveis de cabeçalho/rodapé, são 286 chunks do regimento e quatro trechos institucionais preservados: 290 ao todo. Páginas e intervalos são preservados. Snapshot original e hash não foram alterados. A base não certifica vigência nem substitui validação de conteúdo pela equipe.
- Diagnóstico registra código HTTP, etapa, duração e contagem de trechos, sem chave, token ou pergunta nos eventos. Falha de rede, prazo excedido, 429 e reprovação têm tratamento distinto.
- Prazo total de 30 segundos, mesmo se o transporte ignorar cancelamento; uma geração por vez, limite local e pausa após 429, sem retry automático. Consultas repetidas durante a pausa não geram novas chamadas externas.

## Verificação

Build TypeScript aprovado. Testes de contexto, segurança, referências, números, histórico, cancelamento e apresentação foram executados. A rodada final e seu resultado ficam em `.cache/chat-rag/regressao-final.txt`. Um teste antigo de apresentação dependente de `tests/dados/rag-original.json`, ausente, fica excluído por nome, como nas rodadas anteriores.

Avaliação inicial de recuperação com 24 perguntas em `.cache/chat-rag/avaliacao-busca.json`. Uma rodada com o corpus ampliado levou aproximadamente 1,9 ms por consulta em média nesta máquina. Isso mede somente busca local, não o tempo do Gemini, nem comprova a correção das respostas. Ajustes posteriores passaram a tratar matrícula ambígua e atendimento humano sem chamar a busca.

Quatro fluxos passaram no navegador sem erro JavaScript: “oir”, matrícula ambígua, cursos disponíveis sem fonte confirmada e atendimento humano. Evidência em `.cache/chat-rag/conversa-natural-navegador.json` e `conversa-natural.png`.

O teste de geração real após estas alterações recebeu HTTP 429 do Gemini. A resposta não foi aprovada como sucesso e nenhuma resposta artificial foi inserida para substituí-la. A geração com o novo prompt/corpus deve ser revalidada quando o provedor permitir. A execução anterior com o corpus pequeno havia passado; essa evidência não aprova automaticamente a versão atual.

## Arquivos e execução

- `local-e2e/conversa-natural.mjs`: linguagem de esclarecimento, saudações e contexto local.
- `local-e2e/busca-local.mjs`: ranking em memória.
- `local-e2e/rag-gemini-real.mjs`: prompt, transporte, geração validada, diagnóstico e limites.
- `functions/src/assistente/handler.ts`: dois hooks opcionais para a composição local; os comportamentos padrão continuam usando as funções anteriores. Token, persistência e deduplicação não foram substituídos.
- `scripts/ampliar-regimento-local.mjs`: ampliação a partir do PDF com hash conferido, sem alterar o stash.
- `scripts/avaliar-busca-local.mjs`: avaliação de recuperação/tempo.
- `scripts/iniciar-rag-gemini-local.mjs`: ativa os hooks apenas no servidor local.
- `scripts/verificar-conversa-natural-navegador.mjs` e testes relacionados: evidências desta rodada.

Ao reiniciar, preparar a base antes dos servidores:

```powershell
node scripts/preparar-rag-real-local.mjs
node scripts/ampliar-regimento-local.mjs
node local-e2e/history-run.mjs --keep-open --gemini-local
```

Depois, em outro terminal, `node scripts/iniciar-rag-gemini-local.mjs`. Chat: http://127.0.0.1:5000/Logado/Home/home.html. Preparar novamente a base sem ampliar volta aos oito trechos originais. Os emuladores ativos não devem ser duplicados; encerrar os processos anteriores nos terminais antes de reiniciar.

## Limites e próximos passos

A cota externa não foi alterada. Não foram contratados serviços, trocadas chaves ou alterado faturamento. Continuam pendentes a revalidação real da redação, a avaliação humana das 24 respostas ideais e a ampliação com documentos operacionais da unidade (cursos atuais, horários e procedimentos locais).

Embeddings, reranking externo e streaming de conteúdo permanecem experimentos posteriores. BM25 foi incorporado sem acrescentar chamadas de rede; percentuais de overlap não foram aplicados indiscriminadamente a artigos. Conflitos de vigência não são decididos apenas pela data. A revisão semântica é uma proteção adicional, não uma garantia de ausência de erro.

Para reverter, encerrar o servidor local, recuperar `.cache/chat-rag/base-antes-ampliacao.json` para a base, retirar os hooks da composição local e reverter somente os arquivos desta rodada. Preservar trabalho anterior e alterações da equipe; não usar reset/clean global nem aplicar o stash inteiro.
