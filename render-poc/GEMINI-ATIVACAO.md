# Gemini: adaptador offline e publicacao controlada

## Estado e menor alteracao

O gateway existente seleciona `openai` ou `gemini` por
`SYLVINHO_IA_PROVIDER`. Ambos implementam `ProvedorGeracao`; o caminho OpenAI
nao foi substituido. O adaptador novo e `functions/src/assistente/geracao/gemini.ts`.
Nao reutiliza o gerador Gemini legado, que nao tem este contrato de seguranca.
Nenhum frontend, endpoint HTTP, autenticacao, persistencia ou RAG foi alterado.

A criacao e lazy, sem rede, SDK novo ou dependencia adicional. Gemini utiliza
REST `v1beta/models/{modelo}:generateContent`, chave no header `x-goog-api-key`
(nunca query string), `systemInstruction` separado dos dados e
`generationConfig.responseMimeType=application/json` com `responseJsonSchema`.
Nao envia historico, UID, IDs de conversa/mensagem, tokens Firebase ou metadados
internos de documentos. Envia pergunta, evidencias locais E1/E2/E3 e os contextos
necessarios para verificar condicoes e excecoes. Heuristicas de privacidade nao
sao anonimização garantida; evitar dados pessoais mesmo nos testes autorizados.

## Bloqueio de modalidade e termos

Os termos Gemini API consultados em 22/10/2026 proíbem clientes destinados ou
provavelmente acessados por menores de 18 anos. O Sylvinho e um produto escolar
com menores: NAO ha liberacao automatica para ativa-lo nesse produto, mesmo com
allowlist de um professor, filtros ou faturamento pago. Desenvolvimento offline
nao comprova elegibilidade. Qualquer modalidade alternativa (por exemplo Vertex
AI) exige avaliacao propria de termos, privacidade e autenticacao; este adaptador
NAO implementa Vertex AI.

`SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA` apenas atesta uma avaliacao documentada;
nao muda termos, publico, contrato ou permissões. Nao marcar true sem prova de
compatibilidade do uso concreto. As demais flags existentes, inclusive ZDR,
continuam obrigatorias. Uma aprovacao ZDR para OpenAI NAO comprova retencao zero
no Google. Ausencia de envio de historico ou de cache explicito NAO controla
retencao pelo provedor. A retencao efetiva deste ambiente Google NAO foi verificada.

## Configuracao futura (nenhuma variavel online foi alterada)

| Nome | Uso |
| --- | --- |
| SYLVINHO_IA_ENABLED | Ausente/false: apenas documental. Manter false na publicacao inicial. |
| SYLVINHO_IA_PROVIDER | openai ou gemini; ausente/desconhecido: documental. |
| GEMINI_MODEL | ID exato autorizado e disponivel, com JSON Schema. Sem default. |
| GEMINI_API_KEY | Segredo exclusivo do servidor, cadastrado pelo painel seguro, nunca no chat/Git/frontend. |
| SYLVINHO_IA_UID_ALLOWLIST | CSV privado de ate 20 UIDs Firebase autorizados. Vazio bloqueia todos. |
| SYLVINHO_IA_GEMINI_MODALIDADE_APROVADA | Exige prova de compatibilidade do uso concreto com termos. |
| SYLVINHO_IA_INSTITUCIONAL_APROVADA | Autorizacao institucional documentada. |
| SYLVINHO_IA_PRIVACIDADE_APROVADA | Revisao efetiva de minimizacao, avisos, retencao e consentimentos. |
| SYLVINHO_IA_MENORES_APROVADA | Revisao do publico e salvaguardas; nao supera proibicao dos termos. |
| SYLVINHO_IA_ZDR_APROVADO | Evidencia efetiva de retencao zero para o provedor selecionado e endpoints usados. Nao reutilizar aprovacao de outro provedor. |
| SYLVINHO_IA_TIMEOUT_MS | Padrao 20000, inteiro 1..30000; prazo total, com AbortSignal. |
| SYLVINHO_IA_MAX_POR_MINUTO | Padrao 5, inteiro 1..20; limite por instancia, nao global. |

Nao ha fallback de chave ou modelo OpenAI para Gemini, nem troca automatica de
provedor. Variaveis OpenAI existentes permanecem intactas. Sem todas as aprovacoes,
allowlist e configuracao validas, o gateway nem cria o cliente Gemini.

## Validacao e limitacoes

Mantem as quatro etapas do contrato: classificar entrada, gerar proposta,
revisar fundamentacao e classificar saida. No Gemini as classificacoes usam o
mesmo modelo configurado com schema booleano estrito e filtros nativos em todas
as chamadas, quatro categorias em BLOCK_LOW_AND_ABOVE. NAO e equivalente ao
endpoint dedicado de moderacao da OpenAI, nem classificacao independente do
modelo gerador. Uma revisao pelo mesmo modelo pode repetir erros. Nao garante
adequacao a menores ou ausencia de alucinacoes.

O validador existente verifica IDs, citacoes literais, numeros e marcadores;
a resposta final conserva integralmente o baseline documental e suas fontes.
Propostas invalidas, recusa de seguranca, HTTP de erro, timeout, formato
inesperado, tools, resposta truncada ou excessiva retornam documental.
Mantem limite final de 2400 caracteres. Erros sao sanitizados, sem body, chave,
pergunta ou logs de identidade. Nao ha retries automaticos.

Uma geracao bem-sucedida usa quatro chamadas Gemini, inclusive classificacoes e
revisao; todas podem ter custo. Nao houve chamadas reais, verificacao de modelo,
cota, disponibilidade da conta ou estimativa monetaria confirmada. O parser aceita somente text, thought booleano e thoughtSignature textual
nao vazia nas partes. Assinaturas sao opacas e descartadas; partes thought=true
nao integram o JSON final. Campos desconhecidos, tools e ausencia de JSON final
continuam recusados. As chamadas sao independentes, sem reenvio de assinaturas
ou historico. Compatibilidade real do modelo ainda exige validacao autorizada.

## Roteiro Render: publicar inicialmente com IA desligada

1. Revisar o diff destes quatro arquivos, executar build/lint/testes offline e
   scanner. Solicitar autorizacao separada para commit, push, PR e merge.
2. Confirmar commit integrado e configuracao REAL de build no painel Render.
   O codigo local mostra que `render-poc/documental.cjs` carrega
   `functions/lib/assistente/geracao/gateway.js`; `render-poc/package.json`
   compila `../functions` e inicia `node server.cjs`. O tsc inclui o adaptador.
   Nao e necessario modificar o servidor. Nao afirmar que o painel foi consultado.
3. Antes do deploy autorizado, preservar release/commit atual para rollback e
   confirmar `SYLVINHO_POC_MODE=documental`. Manter IA desligada, allowlist vazia,
   aprovacoes nao comprovadas ausentes e nao cadastrar chave para esta publicacao.
4. Somente com autorizacao, executar deploy manual do commit aprovado no Render.
   Nao alterar Firebase Hosting, Firestore, regras ou IAM.
5. Verificar GET /health. Testes autenticados com gravacoes exigem autorizacao
   especifica. A publicacao desligada deve continuar retornando documental.

## Antes de uma demonstracao real

Resolver primeiro o bloqueio de termos/publico, retencao e autorizacoes. Confirmar
modelo com suporte aos schemas, conta, chave, cota, custo e limites. Somente depois
de autorizacao expressa cadastrar segredo seguro e flags comprovadas, configurar
provider/modelo e UID de teste. Nunca colar segredos ou UIDs no relatorio publico.

Com autorizacao de gasto e gravacao, utilizar conta de demonstracao e novos IDs
para uma conversa exclusiva; testar resposta com fontes, falta de evidencia e
replay do mesmo messageId. Replays existentes devolvem resposta persistida sem
regerar, portanto nao servem para demonstrar a troca de provedor. Nao excluir
conversas automaticamente. Em erro, interromper; nao tentar mudar provedor ou
repetir gravações. Desativacao futura por flag/rollback requer autorizacao propria.

Referencias oficiais:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/terms
