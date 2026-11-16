# Avaliação real — fluxo publicado x modo híbrido

Data: 16/11/2026. Execução autorizada pelo usuário. Branch `feat/motor-curado-render`, sem commit ou deploy.

## Método

- **Fluxo:** respostas reais do chat visitante publicado (`sylvinho-backend-poc.onrender.com/perguntarVisitante`), que hoje roda o fluxo documental. A rota visitante não grava conversas. Usa a cota do provedor configurado no Render, separada do limite abaixo.
- **Híbrido:** adaptador novo (`render-poc/motor-curado.cjs`, modo `hibrido`) rodando localmente com Gemini real. Teto de 40 chamadas, embeddings incluídos. Quando o híbrido devolve a vez, a resposta final é a do fluxo publicado.
- Comando: `node scripts/avaliar-motor-hibrido.mjs`. Resultado bruto em `.cache/avaliacao-motor-2026-11-16/resultado.json`, ignorado pelo Git.
- Avaliação factual: comparação manual de cada resposta com o registro aprovado em `knowledge-local/faq-curada.json`. Não substitui a revisão humana do grupo ou da Secretaria.

## Resultado nas 12 perguntas com as duas respostas

Foram usadas 39 de 40 chamadas. As oito perguntas restantes ficaram sem medição do híbrido.

| # | Pergunta | Fluxo publicado | Híbrido |
| --- | --- | --- | --- |
| 1 | Trancar matrícula | ❌ "Sobre matrícula, não encontrei…" | ✅ condições, decisão e retorno |
| 2 | Frequência mínima | ✅ 75%, mas com citação técnica bruta (IDs de documento e trecho) | ✅ 75% e boas notas não compensam |
| 3 | Compensar faltas com notas | ❌ não encontrei | ✅ não compensa; 75% |
| 4 | Renovar matrícula | ❌ não consegui concluir | ⚠️ erro do provedor (tempo excedido) |
| 5 | Perdi o prazo da renovação | ❌ "Sobre qual procedimento…?" | ✅ procurar a Secretaria. Nuance: diz "não há previsão de prazo extra"; o fato diz "não há prazo extra confirmado" |
| 6 | Documentos para matrícula | ❌ "Sobre qual procedimento…?" | ✅ lista de 2027 fiel ao registro |
| 7 | 15 anos, matrícula sozinho | ❌ não encontrei | ✅ responsável legal abaixo de 16 |
| 8 | Estágio | ❌ não encontrei | ✅ obrigatório se previsto; exceção da Enfermagem |
| 9 | Celular na aula | ❌ "Sobre qual procedimento…?" | ✅ autorização do professor |
| 10 | Sair mais cedo | ❌ "Sobre qual procedimento…?" | ⚠️ erro do provedor (429/503) |
| 11 | Progressão parcial | ❌ "Sobre qual procedimento…?" | ⚠️ erro do provedor (429/503) |
| 12 | Se eu reprovar | ❌ "Sobre qual procedimento…?" | ✅ recuperação, promoção, retenção e recurso |

**Placar:** o fluxo publicado respondeu 1 de 12. O híbrido respondeu 9 de 12 corretamente; as 3 restantes falharam no provedor, sem resposta errada.

Nenhuma resposta do híbrido foi reprovada pela revisão automática. Nenhuma pergunta precisou do fluxo antigo, porque a busca vetorial encontrou fatos em todas.

**Tempo:**

| | Respostas corretas | Faixa geral |
| --- | --- | --- |
| Híbrido | 1,9 s a 16,5 s (mediana cerca de 5,4 s) | — |
| Fluxo publicado | 6,8 s (a única correta) | 0,2 s a 12,4 s, pós-aquecimento |

O primeiro acesso ao Render levou 22,5 s (início frio).

### Oito perguntas restantes, sem chamadas

Estas foram classificadas sem chamar a IA, com a rede bloqueada:

- **Respondidas só pelas regras do motor:**
  - horários da Secretaria e preço da camiseta → "a Secretaria confirma", com o WhatsApp oficial;
  - presidente do Brasil → fora de escopo.
- **Não medidas:** dois cursos, revisão de nota, transferência, WhatsApp da Secretaria e CPF do diretor. Sem a busca vetorial, iriam ao fluxo antigo; com ela podem encontrar fatos.
- **Fluxo publicado nessas oito:** respondeu de forma útil a nenhuma (não encontrei, não consegui concluir ou saudação genérica). Em nenhum caso, porém, expôs dado pessoal.

## Causa das falhas do híbrido

Eventos do motor:

- O modelo principal `gemini-3-flash-preview` excedeu o limite de 8 s por chamada em 3 das primeiras 8 perguntas. Depois passou a responder 429, limite por minuto do plano gratuito.
- A reserva `gemini-2.5-flash` respondeu 503 (sobrecarga) em dois momentos.
- Quando a reserva respondeu, a resposta inteira levou 1,9 a 2,5 s.

O motor tratou tudo como erro recuperável, com pedido de nova tentativa e sem inventar resposta. São limites do provedor e do plano, não da lógica da integração.

## Conclusões

1. O modo híbrido melhora muito o atendimento atual. O fluxo publicado falha na maioria das perguntas comuns: pede esclarecimento desnecessário ("Sobre qual procedimento você quer saber?") ou diz que não encontrou.
2. O gargalo agora é o provedor: modelo em preview lento e limites por minuto do plano gratuito. Com vários alunos ao mesmo tempo, o 429 tende a aparecer.
3. As 44 entradas cobrem bem as perguntas centrais. Ampliar a curadoria continua sendo o que mais aumenta a cobertura.

## Recomendações antes de publicar

- **Modelo:** testar `SYLVINHO_GEMINI_MODEL=gemini-2.5-flash` como principal, porque foi mais rápido quando disponível. Isso é configuração, não código, e precisa de uma rodada curta para confirmar.
- **Cota:** decidir se o projeto continua no plano gratuito ou ativa faturamento para a apresentação. A decisão é do grupo.
- **Publicação em degraus:** primeiro `fluxo` (igual ao atual), depois `hibrido`, como no plano.
- **Achado do fluxo publicado:** a resposta de frequência mostra IDs internos de documento e trecho ao usuário. O híbrido evita isso nas perguntas cobertas.

## Rodada curta — `gemini-2.5-flash` como principal

Configuração: `SYLVINHO_GEMINI_MODEL=gemini-2.5-flash`, sem reserva, teto de 15 chamadas e sem consultar o Render. Comando:

```text
SYLVINHO_GEMINI_MODEL=gemini-2.5-flash SYLVINHO_GEMINI_FALLBACK_MODEL= LIMITE_GEMINI=15 SEM_PUBLICADO=1 SAIDA=.cache/avaliacao-motor-2026-11-16/flash-2.5 PERGUNTAS='...' node scripts/avaliar-motor-hibrido.mjs
```

Foram usadas 12 chamadas.

| Pergunta | Antes (`gemini-3-flash-preview`) | Agora (`gemini-2.5-flash`) |
| --- | --- | --- |
| Renovar matrícula | erro (tempo) | ✅ 2,2 s. Período do calendário, sem matrícula condicional, procurar a Secretaria se perdeu o prazo. Não traz o passo a passo, que a base também não tem. |
| Sair mais cedo | erro (429/503) | ✅ 2,0 s, condições fiéis. Ressalva: abre com "Sim, você pode sair mais cedo", mais permissivo que a regra condicional. Entrada ainda em revisão humana. |
| Progressão parcial | erro (429/503) | ✅ 2,3 s. Até 3 matérias, exceto etapa final. Omitiu "não é aprovação automática". |
| WhatsApp da Secretaria | não medido | ⚠️ 429 (limite por minuto) |
| Trancamento | ✅ 7,9 s | ⚠️ 429 (limite por minuto) |

Conclusões:

- Quando disponível, `gemini-2.5-flash` é cerca de três vezes mais rápido que o preview: 2,0 a 2,3 s contra 4 a 8 s. Nesta amostra não houve tempo excedido.
- **Capacidade do plano gratuito:** o 429 veio na 10ª chamada, cerca de um minuto após o início. Cada pergunta usa 3 chamadas (busca, resposta e revisão), então o plano gratuito sustenta só **cerca de 3 perguntas por minuto** neste modelo.
- Usar o outro modelo como reserva soma uma segunda cota, porque o motor muda de modelo em 429, 5xx e tempo excedido. Configuração sugerida, com os dois modelos já testados: `SYLVINHO_GEMINI_MODEL=gemini-2.5-flash` e `SYLVINHO_GEMINI_FALLBACK_MODEL=gemini-3-flash-preview`.
- Para uso com turma ou na apresentação, o limite gratuito continua sendo o gargalo. Ativar faturamento é decisão do grupo.
