# IA local: concorrência e diagnóstico

Continuação da etapa de escopo e intenção de 16/11/2026. Alterações exclusivamente locais na branch `feat/ia-confiabilidade-local`, sem commit, push, merge ou deploy, conforme orientação do usuário.

## Comportamento

- Até dois atendimentos simultâneos por instância, com fila FIFO de até quatro solicitações e espera máxima de três segundos. Uma conta só pode ter um atendimento ativo ou em espera. Solicitações sem namespace compartilham um grupo conservador.
- Fila cheia, conta ocupada e espera excedida retornam códigos próprios e indicação de nova tentativa. Liberação da vaga é idempotente e ocorre também nas falhas.
- O prazo total inclui a espera na fila. Cancelamento chega à busca, aos embeddings e ao transporte do modelo; respostas tardias não continuam a revisão nem entram no cache. Os limites existentes por chamada continuam aplicáveis.
- A busca registra modo de recuperação, quantidade de candidatos e selecionados, duração e estado dos embeddings. Os novos registros não incluem perguntas, identificadores de conta ou mensagens brutas de exceções.
- Se embeddings falham, uma recuperação lexical suficiente continua válida. Sem resultado suficiente, uma indisponibilidade de busca retorna falha temporária, em vez de ser tratada como ausência de informação e encaminhada à Secretaria.

Os limites são locais a cada instância/processo. Não constituem controle distribuído de produção. As opções do controlador podem ser configuradas em código; não foi criada uma tela de configuração.

## Verificação

- Vinte testes novos de concorrência, fila, expiração, cancelamento, recuperação e privacidade dos registros. Os primeiros doze falharam antes da implementação e passaram depois.
- Regressão selecionada: 395 testes passaram, nenhuma falha.
- Avaliação offline de recuperação e política: 61/61 cenários. Não mede qualidade factual ou latência real do Gemini.
- Cobertura dos quatro módulos desta etapa: 99,70% de linhas, 87,27% de ramos e 95,97% de funções. Controlador: 100% de linhas e 97,87% de ramos. Esses números não representam cobertura do produto inteiro.
- Sintaxe dos quatro módulos e `git diff --check` verificados.

Evidências locais ignoradas pelo Git em `.cache/ia-concorrencia-2026-11-16/`: `red.log`, `green.log`, `cobertura.log` e `regressao.log`.

O adaptador foi reiniciado com o código atualizado para teste manual em `http://127.0.0.1:5000/Logado/Home/home.html`. Nenhuma consulta paga ao Gemini foi disparada automaticamente nesta etapa; os testes de falha e concorrência usam transportes simulados. A configuração pública de produção permanece fora desta alteração.
