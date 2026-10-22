# Demonstracao com IA real — preparacao sem ativacao (22/10/2026)

O sistema publicado permanece documental. Nenhum mock ou eco literal pode ser
apresentado como inferencia real de IA. Este roteiro NAO autoriza chamadas,
credenciais, faturamento, publicacao ou uso de servicos externos.

## Situacao verificada

GET /health do Render retornou 200; GET /perguntarAssistente retornou 405.
Isto confirma a rota, nao autentica a conta nem comprova uma consulta Firestore.
O contrato do handler ja injeta gerarResposta(pergunta, chunks): Promise<string>
depois de autenticacao, verificacao de replay e recuperacao documental. Um adaptador
pode ocupar esse ponto sem mudar HTTP, historico, IDs ou o RAG.

A Fase A valida eco literal; nao e validador de respostas naturais. Liberar
parafrases apenas afrouxando essa igualdade eliminaria a garantia existente.
O cliente legado gemini.ts mistura instrucoes/pergunta e nao possui essas
barreiras completas. Nao liga-lo diretamente ao runtime como atalho.

## Bloqueio de modalidade

Fontes oficiais consultadas em 22/10/2026:
- https://ai.google.dev/gemini-api/terms — Age Requirements.
- https://cloud.google.com/terms/service-terms — Generative AI Services,
  Age Restrictions (secao 20(d) na versao consultada).

Ambas restringem uso em aplicacoes direcionadas ou provavelmente acessadas por
menores de 18 anos. O destino escolar informado inclui menores. Restringir a
sessao ao professor nao foi comprovado como excecao contratual; pagar pelo servico
ou trocar Developer API por Vertex AI nao elimina automaticamente essa restricao.
Exigir confirmacao formal aplicavel ou escolher outra modalidade com termos
explicitamente compativeis, analisando tambem privacidade e responsabilidade.
Nao usar uma conta do professor para contornar o bloqueio.

Uma alternativa a avaliar e inferencia local de um modelo de pesos abertos, desde
que sua licenca e politica permitam o uso pretendido e haja hardware adequado.
Nao foi verificada disponibilidade de runtime/modelo/hardware local. Isso seria
inferencia real, nao resposta fixa, mas exigiria um novo adaptador e validacao.
Nao pressupor viabilidade em Render Free nem acesso do Render ao computador local.

## Modelo e autenticacao, somente depois da modalidade aprovada

O modulo legado aponta para gemini-2.5-flash. A tabela oficial Cloud consultada
marca a aposentadoria desse modelo em 20/10/2026. Nao depender desse identificador.
Referencia: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions

Se houver autorizacao contratual aplicavel para Google, um candidato listado na
tabela atual e gemini-3.5-flash-lite. Antes de utiliza-lo, verificar acesso do
projeto, endpoint, regiao, suporte do SDK instalado, quota e precos. Nenhum modelo
foi listado pela API ou chamado nesta etapa.

Developer API normalmente usa chave de API de projeto apropriado. Cloud usa
identidade/autenticacao Cloud (preferir identidade federada quando viavel),
permissao de invocacao, API habilitada e faturamento/quota aprovados. A conta
Firestore atual nao implica acesso de IA; nao ampliar seu papel silenciosamente.
Chaves/tokens apenas no backend e nunca em frontend, Git ou logs. Inferencia local
normalmente nao exige chave de nuvem; ainda pode precisar de controle de acesso.

## Menor implementacao depois da decisao

1. Adaptador separado, desligado por padrao, injetado somente em gerarResposta.
2. Enviar somente pergunta minimizada e evidencias necessarias; nenhuma identidade,
   token ou historico completo. Regex nao anonimiza texto livre.
3. Separar sistema/dados; ferramentas, busca externa e execucao de codigo desligadas.
4. Receber proposta estruturada com afirmacoes e vinculos literais a fontes internas.
   Metadados/citacoes finais sao reconstruidos pelo servidor, nunca pelo provedor.
5. Definir uma politica nova para validar suporte e contexto de parafrases. Numeros,
   condicoes, excecoes, negacoes e remissoes nao podem depender apenas de prompt.
   Persistir resposta generativa somente depois das validacoes. Na duvida, baseline.
6. Timeout, cancelamento cooperativo, limite de tokens/custo/concorrencia, sem retry
   automatico. Replay persistido precede geracao; deduplicar gravacao nao garante
   uma unica chamada faturavel entre instancias.
7. Tornar explicito ao professor quando a resposta foi gerada e quando houve
   fallback documental. Nao rotular fallback como geracao real bem-sucedida.

## Testes

A matriz offline fundamentacao-perguntas-livres.test.mjs usa exclusivamente
fixtures sinteticas, exercitando o RAG existente e o cliente SIMULADO. Ela demonstra
isolamento/recusa, NAO qualidade generativa, semantica ou compatibilidade com Gemini.

Um ensaio real posterior deve incluir perguntas livres de frequencia, declaracao,
matricula, sinonimos, multiplos assuntos, horarios sem evidencia, assunto
inesperado e injecao PT/EN. Conferir fontes e todas as afirmacoes com revisao
humana; testar indisponibilidade, timeout e replay sem nova resposta persistida.
Autorizar separadamente as chamadas faturaveis e qualquer conversa/gravação
real no Firestore. Nao prometer zero alucinacoes.

## Autorizacoes pendentes

- Modalidade/provedor permitido para o uso escolar, inclusive menores.
- Modelo disponivel e mecanismo seguro de autenticacao.
- Limites de custo, tratamento de dados e chamadas reais.
- Implementacao/revisao da geracao natural e do seu validador.
- Teste real controlado; deploy/configuracao somente com autorizacao separada.

Estimativas de engenharia, nao promessas: avaliar modalidade depende de resposta
externa sem prazo garantido; adaptador/politicas/testes demandam algumas horas e
complexidade media/alta. Uma chamada real com credenciais, modalidade e infraestrutura
ja aprovadas e simples, mas nao substitui a validacao do produto escolar.
