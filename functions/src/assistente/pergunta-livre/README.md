# Perguntas livres: composicao local, sem ativacao

`interpretarPerguntaLivre` valida texto e extrai os termos do seletor existente.
Nao e interpretacao semantica por IA: nao reescreve a pergunta nem promete
compreender qualquer parafrase. `criarBuscaDocumental` consulta conhecimento,
ativo=true, e reutiliza integralmente o filtro das tres fontes e o ranking.
`criarFluxoPerguntaLivre` compoe busca e geracao; responder executa o fluxo
completo. Fonte, modelo e respostas dos testes sao sinteticos, em memoria.

A interface independente de provedor e ProvedorGeracao, em geracao/contrato.ts:
moderar, propor e verificar. Nao foi criada outra interface concorrente. O gateway
existente preserva contratos, citacoes literais, revisao, limites, timeout e
fallback documental nos provedores legados. No OpenRouter, o contrato tambem
oferece conversar/revisarConversa (verificarConversa para compatibilidade):
admite resposta com fonte, esclarecimento,
orientacao geral, saudacao ou explicacao da falta de base. Falhas apos os gates
retornam uma mensagem local, sem listar trechos possivelmente desconexos.
Visitantes e IA desativada continuam documentais. Essas verificacoes nao provam
implicacao semantica; simulacoes nao demonstram qualidade de um modelo real.

Por padrao esta composicao usa ambiente vazio, mesmo com flags no processo.
Sem configuracao explicita nenhum cliente externo e criado. Os testes injetam
fabricas simuladas e valores
ficticios de gates somente em memoria; nao constituem aprovacoes reais.

A fabrica Render render-poc/documental.cjs agora compoe o fluxo e fornece
recuperarConhecimento e gerarResposta ao handler existente. Ela repassa
lerAmbiente explicitamente; os gates do gateway original continuam integrais.
Nao ha novo endpoint, dependencia ou mudanca no frontend. IA false continua
documental. Esta ligacao so existe localmente, sem publicacao.
responder NAO substitui Auth, controle de acesso,
replay ou transacao. Nunca chamar responder diretamente a partir do corpo HTTP
ignorando o handler. UID vem exclusivamente do token verificado pelo handler e
nao integra o pedido do modelo. Falha da busca e erro controlado, nao uma
resposta inventada ou afirmacao de que os documentos nao contem a informacao.

Para conectar um provedor real faltam: compatibilidade comprovada com o publico
efetivo da demonstracao privada adulta e termos, revisao institucional/privacidade/retencao e dos dados enviados,
acesso/modelo/cota e autorizacao especifica de chamadas e publicacao. Entao a
composicao do servidor pode fornecer lerAmbiente com configuracao aprovada e um
adaptador ProvedorGeracao. Nenhum bloqueio Gemini gratuito foi relaxado; texto
livre continua bloqueado nessa modalidade. Regex nao garante anonimizacao.
Autenticacao, persistencia, messageId, conversationId e idempotencia continuam
responsabilidade do handler existente, exercitado nos testes com mocks.

## Demonstracao privada adulta: pendencias reais

Termos oficiais consultados em 22/10/2026: https://ai.google.dev/gemini-api/terms .
A clausula etaria veda clientes destinados ou provavelmente acessados por
menores. O contexto informado agora e uma demonstracao privada para professores
adultos, sem acesso de alunos: isso deve ser conferido no acesso efetivo, nao
inferido de uma flag. Os termos tambem limitam o uso a desenvolvimento para
finalidades profissionais/empresariais; nao trazem uma excecao automatica para TCC.
A autorizacao institucional e separada dessa avaliacao contratual.

No gratuito, entradas e saidas podem ser usadas para melhoria e revisao humana;
nao enviar informacoes pessoais, sensiveis ou confidenciais. Documentos publicos
nao sao automaticamente nao pessoais. Regex nao garante essa propriedade em
perguntas livres. Por isso esta composicao NAO libera demonstracao_publica para
texto livre. O gate ZDR do caminho original tambem permanece intacto, como
politica existente do projeto, nao como exigencia universal dos termos Google.
Falta avaliar e autorizar uma politica de dados/retencao compativel com o envio
de texto livre e trechos efetivamente usados; aprovar apenas o catalogo fechado
nao aprova esse envio. Nao declarar ZDR inexistente para passar nesse gate.

Apos comprovacao e autorizacao especifica, validar modelo/schema/cota, usar conta
adulta autorizada e novos IDs, enviar uma vez e conferir evento GERADA e consumo
Gemini correspondente. FALLBACK, HTTP 200 e replay nao provam geracao nova.
Nenhuma chamada real, mudanca de flags ou publicacao foi executada.


A referencia operacional do fluxo OpenRouter e o guia de ativacao do Render.
As pendencias Gemini descritas acima pertencem ao caminho legado separado;
nao substituem as condicoes OpenRouter. A revisao conversa-v6 nao precisa de
nova variavel de ambiente, nao envia historico e nao libera IA para visitantes.


Diagnostico operacional opcional: `geracao.registrarDiagnostico` recebe somente
codigos e contagens de busca, contexto preparado, proposta e revisao. A fabrica
Render escreve esses eventos como `SYLVINHO_DIAGNOSTICO`. A consulta continua
unica e nao registra dados; falha do logger e ignorada. Consultar a secao
“Comprovar leitura e envio dos documentos” no guia OpenRouter para interpretar
as etapas sem confundir busca bem-sucedida com resposta aprovada.

Na conversa-v5, validacao local aceita parafrases e omissao de numeros alheios
ao resumo, preservando citacoes literais e bloqueando numeros novos. A revisao
semantica continua obrigatoria: verifica condicoes/negacoes relevantes e pode
aprovar, corrigir a resposta ou recusar por problema concreto. Uma correcao
passa pela mesma validacao local e pela moderacao final, sem quinta chamada.
O diagnostico inclui `REVISAO_CORRIGIDA` e `motivoRevisao` com codigos seguros;
nao registra o texto da proposta nem a justificativa do modelo. O modo literal
dos provedores legados permanece inalterado.

A conversa-v6 filtra fontes antes do envio e registra `CONTEXTO_FILTRADO` com
contagens e categorias seguras. Um bloqueio exclui todos os chunks selecionados
da mesma fonte, preservando os outros documentos. Citacoes sao refeitas com as
fontes permitidas; nao se recortam frases privadas dentro de um chunk. Rotulos
documentais genericos nao sao confundidos com identificacao preenchida. Se
houver exclusoes, proposta/revisor recebem `fontes_parciais` e a resposta com
fonte recebe aviso dessa limitacao. Bloqueio de todas as fontes continua sem
envio de documentos; `GERADA` e revisao aprovada, isoladamente, nao provam RAG.
