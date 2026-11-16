# Rodada controlada com Gemini real — 16/11/2026

Execução autorizada pelo usuário, exclusivamente local. Sem commit, push, merge ou deploy. Perguntas sintéticas e fatos públicos aprovados; nenhuma chave foi incluída no relatório.

## Amostra

O comando `node scripts/avaliar-rodada-controlada-local.mjs` limita o total a 20 requisições externas, incluindo embeddings e tentativas de reserva. Nesta execução foram 17: seis de embeddings e onze de geração/revisão, incluindo uma tentativa com timeout. Não foi usado cache de respostas.

| Caso | Resultado | Tempo |
| --- | --- | --- |
| Frequência | Preservou 75%, total das aulas e impossibilidade de compensar com boas notas | 2.822 ms |
| Matrícula, idade informada de 15 anos | Exigiu responsável legal para menores de 16 | 3.237 ms |
| Estágio, curso Enfermagem | Preservou condição do plano/matriz e exceção de dispensa por experiência | 2.761 ms |
| Trancamento | Preservou limite por série/módulo, decisão e condições de retorno | 10.059 ms |
| Renovação após informar Logística | Retomou pergunta original e datas do calendário de 2026 | 3.360 ms |
| Pedido de fonte após frequência | Retornou referências cadastradas dos artigos 83 e 87, com páginas e URL; sem geração | 314 ms |
| Renovação sem curso | Pediu o curso antes de responder; nenhuma requisição externa | 12 ms |

As cinco respostas geradas passaram pela revisão automática. A comparação técnica assistida com os fatos citados não encontrou divergências nesta amostra. Isso não substitui revisão humana independente nem certifica precisão geral. A média dos cinco atendimentos com geração foi 4.447,8 ms.

## Pontos de atenção

- No trancamento, o modelo principal excedeu o limite de uma chamada. A reserva `gemini-2.5-flash` concluiu geração e revisão; o atendimento levou aproximadamente dez segundos.
- Na renovação, a resposta apresentou também o período já passado do meio do ano sob a expressão geral “ocorre”. As datas estão de acordo com o registro, mas a apresentação pode distinguir melhor períodos passados e futuros. Não houve alteração factual nem segunda rodada paga para tentar melhorar essa redação.
- A referência foi comparada ao cadastro local; os links e a vigência das regras não foram revalidados na internet nesta rodada.
- Permanecem pendentes as revisões humanas de celular em aula, saída antecipada, uniforme e calçado.

## Navegador

`node scripts/verificar-rodada-controlada-navegador.mjs` executou o Chrome local com acesso restrito a loopback. Envio, esclarecimento, encaminhamento de informação não confirmada, persistência após recarga e disposição do compositor em 1440×900 e 390×844 passaram, sem erros JavaScript detectados. Essas perguntas usam política determinística e não geram novas chamadas ao Gemini.

A primeira checagem da recarga conferia o DOM antes de a restauração terminar. Após aguardar o estado explícito de histórico carregado, a verificação passou; não foi necessário alterar o código do produto. A geração real foi exercitada no motor separadamente, e não dentro desse fluxo de navegador. A recuperação visual de uma falha temporária no navegador não foi exercitada nesta rodada.

## Evidências

Resultados completos e eventos seguros: `.cache/ia-real-2026-11-16/rodada.json`. Resultado do navegador: `navegador.json`, com captura `navegador-mobile.png` no mesmo diretório. São arquivos locais ignorados pelo Git.

Os dois scripts tiveram sintaxe verificada. A regressão anterior continua em 433 testes e 66 cenários offline; não foi repetida porque esta rodada adicionou somente scripts de avaliação e documentação.
