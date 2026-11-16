# Celular e verificações locais — 12/11/2026

Atualização posterior: [fechamento móvel e validação local](FECHAMENTO-MOBILE-E-VALIDACAO-LOCAL.md). A gaveta também foi corrigida para a altura visual; regras administrativas reais, build e lint passaram usando o JAR local encontrado. O ensaio de contas no navegador ficou inconclusivo por bloqueio do SDK Firebase na rede. O relato abaixo preserva o estado da rodada anterior.

Imagens adiadas conforme pedido. Continuidade focada em celular e verificações locais de conta, histórico e curadoria. Sem publicação, commit, push, alteração no Figma, envio de e-mails ou chamadas Gemini.

## Problema reproduzido e correções

O teste novo separou a janela visual da janela de layout: simulou redução de `visualViewport.height` mantendo `innerHeight`. As verificações anteriores apenas redimensionavam a janela inteira e não detectavam o conflito de altura mínima.

Antes da correção, oito cenários falharam: mesmo com a variável de altura visual atualizada, a altura mínima herdada mantinha a página alta e deixava o campo abaixo do teclado simulado.

- Home e chat visitante agora permitem altura menor que a janela de layout, removendo a altura mínima conflitante somente nos corpos dessas telas.
- A sincronização considera dispositivos com ponteiro de toque também na horizontal, acima de 720 px; o desktop convencional mantém seu comportamento.
- Texto multilinha é limitado pela altura visual disponível, preservando rolagem interna do campo.
- No visitante com menos de 360 px úteis, o cabeçalho superior fica temporariamente oculto e os espaços verticais são reduzidos. O botão Novo chat e o aviso de privacidade permanecem; o cabeçalho retorna quando a altura aumenta.
- Pinch zoom remove a altura forçada e mantém o comportamento nativo. O rascunho não é apagado durante a mudança de altura/zoom.

Arquivos alterados: `public/Arquivos-Universais/ui.js`, `visual.css`, `public/Logado/shell.css` e `public/Chat/chat.css`. Nenhuma regra de autenticação ou conhecimento aprovado foi alterada.

## Evidências e resultados

Novo verificador: `node scripts/verificar-celular-local.mjs`.

Oito combinações de chat autenticado/visitante em 320×568, 390×844, 430×932 e 844×390, com alturas visuais simuladas de 280, 360, 400 e 240 px. Verifica campo dentro da área útil, texto de pelo menos 16 px, envio com área mínima de 44 px, ausência de overflow horizontal, texto multilinha, preservação do rascunho, zoom e retorno do cabeçalho. Oito passaram, sem erros JavaScript. Capturas e `result.json` em `.cache/mobile-continuacao-2026-11-12/`; `result-before.json` preserva as oito falhas iniciais.

Também executados nesta rodada:

- 180 testes selecionados de autenticação, sessão, histórico, pendência de envio, acesso aos avisos, chat visitante e curadoria: zero falhas. Evidência em `regressao.log` na mesma pasta. São testes locais com simulações, não certificação de produção.
- 56/56 cenários offline de política/recuperação, zero falhas e zero casos de jargão não solicitado. Resultado atualizado em `docs/curadoria-local/avaliacao-offline.json`; não representa 56 respostas Gemini.
- 51 cenários responsivos e 69 verificações de layout em 13 páginas passaram após a correção principal; repetidos após os ajustes finais de espaçamento.
- Ensaio do recolhimento desktop passou nos dois modos de movimento, cliques rápidos e gaveta móvel após a correção principal.
- Sintaxe dos dois arquivos JavaScript conferida; diff dos CSS rastreados sem erros de whitespace.

## Tentativa das regras administrativas

A primeira execução ampliada teve 180 aprovações e uma falha de infraestrutura: `admin-rules.test.mjs` tentou acessar o emulador desligado em 19099. Foi separado explicitamente do conjunto offline, que então passou 180/180.

Tentada execução real com `firebase.admin.test.json`, projeto `demo-etec-rbac` e emuladores Auth/Firestore nas portas 19099/18080. A CLI inicialmente não pôde acessar sua configuração de usuário; foi fornecido diretório de configuração vazio dentro do workspace, sem ler credenciais. Depois ela precisou obter o JAR do Firestore Emulator e falhou ao criar o cache externo (`EPERM`), com falha de rede na consulta inicial de configuração pública. Os emuladores foram encerrados pela CLI; o teste real de regras não chegou a executar. Não houve rejeição de auto-review nem pedido de escalonamento.

As regras foram preservadas. Essa pendência exige disponibilizar o emulador em um caminho permitido; não significa falha funcional confirmada de autorização.

## Limites e continuidade

Foi usado Chrome instalado, com emulação de toque e contrato sintético de VisualViewport. WebKit não está instalado; não houve instalação adicional. Não foram usados Android ou iPhone físicos, Safari real, teclado do sistema, leitor de tela ou medição de desempenho representativa. O teste de zoom valida o tratamento do evento/escala simulado, não certifica gestos nativos. A homologação visual sem baseline comparativo e em aparelho físico permanece inconclusiva.

A avaliação das 50 respostas reais continua parcial: duas respostas anteriores e 48 pendentes. Não foi retomada, pois orçamento/cota de geração não foi definido nesta rodada. Não foram confirmadas respostas da Secretaria nem ampliado o índice com suposições. Não foi iniciada a composição real do chat ou feito acesso a contas de produção.

Próximos passos dependentes de condições externas: teste em aparelho físico/Safari; disponibilizar emulador para regras e fluxos reais isolados; definir teto de chamadas para avaliação Gemini; receber confirmações institucionais. Imagens seguem adiadas. Não há aprovação visual do usuário registrada para as alterações desta rodada.

## Reversão

Backups dos quatro arquivos públicos anteriores à rodada estão em `.cache/mobile-continuacao-2026-11-12/`: `ui.before.js`, `visual.before.css`, `shell.before.css`, `chat.before.css`. Comparar antes de restaurar para preservar trabalho posterior e o recolhimento desktop da rodada anterior. Não usar reset, clean ou reversão ampla.

## Autoavaliação

Precisão 4/5: há reprodução antes/depois, mas o teclado é simulado. Completude 4/5: correções e verificações locais concluídas, regras reais e aparelho físico pendentes por infraestrutura. Clareza 4/5: separação explícita entre simulação e produção; relatório extenso para rastreabilidade. Utilidade 4/5: verificador reproduzível e backups, sem homologação Safari. Concisão 4/5: detalhes necessários de falhas e limites. Média 4,0/5. Prioridades para melhorar: aparelho físico e ensaio real das regras em ambiente isolado.
