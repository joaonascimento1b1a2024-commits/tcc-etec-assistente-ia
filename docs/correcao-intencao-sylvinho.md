# Interpretação, continuidade e prevenção de esclarecimentos repetidos

## Diagnóstico

A frase “Sobre qual procedimento você quer saber?” existe em `ESCLARECER_ESCOPO`
e `ESCLARECER_CONTEXTO`. As duas perguntas completas do caso relatado passam
pela classificação institucional. Entretanto, no gateway, uma proposta do tipo
`esclarecimento` aprovada pelo revisor era convertida nessa frase constante,
mesmo quando a pergunta já dizia qual era o procedimento. Esse caminho foi
reproduzido com transporte simulado; não foi inspecionada uma chamada de produção.

Havia também problemas anteriores à geração:

- A busca exigia os termos da reformulação “não faço ideia de como faz isso”,
  além do assunto. Isso podia eliminar documentos pertinentes.
- “Renovo” não era normalizado como renovação; “continuar estudando no próximo
  ano” não era reconhecido como assunto institucional. A palavra “próximo”
  também acionava a recusa de vigência na seleção de citações.
- “Não sei como fazer isso” não estava entre os complementos reconhecidos pelo
  contexto conversacional, reiniciando a classificação sem o assunto anterior.

## Correção

`rag/assuntos.ts` centraliza equivalências lexicais e remove apenas expressões
fechadas de desconhecimento do procedimento, para consulta. Negação substantiva,
condições e qualificadores permanecem. A pergunta original e as fontes não são
reescritas. `assistente/intencao.ts` identifica rótulos locais de procedimentos;
matrícula inicial e renovação continuam distintas.

O contexto da conversa autenticada reconhece os novos complementos e recupera
somente um assunto de vocabulário fechado. Não envia texto livre do histórico
ao provedor. Mudanças de assunto ou condições desconhecidas interrompem a herança.

Geração e revisão recebem o assunto identificado junto da pergunta. As instruções
distinguem falta de documentação de falta de assunto. O revisor pode corrigir
um esclarecimento para uma resposta documental sustentada. Se ainda aprovar um
esclarecimento redundante, o gateway retorna orientação local que reconhece o
procedimento e registra `ESCLARECIMENTO_DESNECESSARIO`, sem publicar afirmações
que a revisão não sustentou. A revisão continua obrigatória.

A expressão fechada “continuar estudando no próximo ano” identifica renovação,
sem comprovar calendário vigente. Perguntas explícitas sobre datas atuais
continuam sujeitas à validação de vigência.

## Exemplos

| Entrada | Comportamento corrigido |
| --- | --- |
| Como faço para renovar minha matrícula? | Reconhece renovação; busca fontes e responde apenas o que elas sustentam. |
| de como renovar a matrícula, não faço ideia de como faz isso | Mantém renovação, sem exigir os termos da expressão de desconhecimento na busca. |
| Não sei como fazer isso. | Com assunto anterior seguro, consulta como solicitar renovação; sem contexto, pede esclarecimento. |
| Como faço minha matrícula? | Busca matrícula inicial, sem convertê-la em renovação. |
| Crie um jogo em Python | Mantém a restrição de escopo, sem iniciar RAG ou geração. |

Antes, as duas primeiras mensagens podiam receber a mesma pergunta genérica.
Agora, mesmo que o modelo repita a classificação inadequada, a resposta local é:

> Sobre renovação de matrícula, não encontrei orientações completas e confirmadas
> nos documentos disponíveis. Recomendo consultar a Secretaria Acadêmica para
> confirmar as informações sobre esse procedimento.

Com evidências e revisão válidas, a resposta documental continua acompanhada de
fontes e citações. Não foram acrescentadas regras escolares, datas ou exigências.

## Validação local

- Build do backend Render e TypeScript: aprovado.
- Lint de Functions: aprovado.
- Regressão selecionada: 687 testes aprovados, sem falhas ou testes ignorados.
- Novo teste `intencao-renovacao.test.mjs`: equivalências, matrícula inicial,
  ambiguidade, reformulação, contexto, falta de documentação, escopo, revisão,
  citações e prevenção de repetição, inclusive pelo handler com persistência simulada.
- Testes existentes de autenticação, propriedade, histórico, duplicidade,
  provedores e renderização incluídos na regressão.
- As respostas e os documentos dos novos testes são sintéticos. O transporte
  OpenRouter é simulado e falha se houver seleção de Gemini direto ou OpenAI.
- Expectativas antigas de esclarecimento redundante e de quarta chamada para
  resposta local sem base foram alinhadas ao comportamento atual. A geração
  documental mantém quatro chamadas; não foi acrescentada uma nova chamada.

## Logo nos chats

Os avatares de respostas em `public/Chat/chat.js` e
`public/Logado/Home/home.js` usam a imagem existente `Logo s_fundo.png`.
O estilo compartilhado de `home.css` mantém a proporção dentro do avatar.
Os testes dos dois chats verificam o elemento de imagem, incluindo respostas
carregadas do histórico. Não houve redesenho da interface.

## Publicação e limites

Nenhum commit, push, deploy ou chamada real ao provedor foi executado.
Para disponibilizar, o operador deve publicar a versão revisada do backend e
do Firebase Hosting pelos processos já existentes. Não há nova variável de ambiente.
O backend identifica este fluxo com `conversa-v10-intencao`.

Após publicar, testar uma nova conversa com as duas mensagens do caso e o
complemento “Não sei como fazer isso”. Respostas já salvas e reenvios do mesmo
identificador continuam preservados pela proteção contra duplicidade.
Verificar fontes nas respostas documentais e o diagnóstico seguro nos logs.

O reconhecimento local tem vocabulário limitado e não resolve toda ambiguidade
de linguagem natural. O contexto preserva os limites existentes de janela e só
usa a conversa autenticada validada pelo handler. O visitante continua com o
contrato atual, sem histórico persistido enviado ao backend. A qualidade das
orientações depende dos documentos disponíveis; revisão reprovada, dados
bloqueados e indisponibilidade do provedor continuam produzindo fallback.
Esta entrega foi testada com simulação, não validada com chamada real ao OpenRouter.
