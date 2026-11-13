# Navegação desktop sem salto — 12/11/2026

Revisão solicitada para o efeito de a tela avançar e voltar rapidamente ao trocar páginas ou usar Voltar, com a lateral expandida ou recolhida. Alterações locais; sem commit, publicação ou escrita remota. Skills aplicadas: `ecc:change-impact` e princípios de `ecc:motion-foundations`, adaptados ao HTML/CSS/JS existente. Inspeção com Chrome DevTools MCP e ensaios isolados com Playwright.

## Diagnóstico reproduzido

A aplicação usa navegação normal entre documentos HTML. O estado recolhido era restaurado por `ui.js`, executado com defer. Antes dele, cada documento podia aparecer com 196 px; depois passava aos 76 px salvos, deslocando o conteúdo em 120 px. A medição com atraso controlado de 250 ms no `ui.js` registrou larguras e margens `[196,76]`. Evidência: `.cache/navigation-review/before.json`.

A barra também recebia ícones e rótulos somente durante essa inicialização, e `visual.css` aplicava uma animação de entrada independente ao conteúdo de cada página. Isso acrescentava uma nova variação de opacidade a cada troca. Não foi diagnosticado um loop de recarga automática: o problema reproduzido foi a reconstrução visual durante a navegação normal. Uma amostra sem loop não exclui falhas em outras condições.

## Resultado implementado

- Novo `public/Logado/shell-init.js` síncrono no head das seis páginas logadas. Restaura a preferência antes da primeira pintura; não muda autenticação ou histórico de conversas.
- Os ícones SVG e rótulos laterais já estão no HTML. `ui.js` reaproveita os rótulos existentes. Os destinos, IDs e nomes acessíveis foram preservados.
- As dimensões intrínsecas da logo ETEC foram declaradas no HTML, reservando o espaço antes do download da imagem, sem modificar o arquivo original.
- Largura da barra e espaço do conteúdo usam o mesmo estado desde o início. No `pageshow`, a preferência atual é reaplicada sem disparar a animação de recolhimento herdada de uma página anterior.
- Desktop recebe transição nativa entre documentos, de 280 ms, com a lateral separada da dissolução do conteúdo. Não há deslocamento de entrada, zoom ou espera artificial para clicar.
- A autorização da transição é CSS crítico no head, antes dos arquivos externos. Colocá-la apenas no stylesheet tardio provocou cancelamentos no ensaio inicial; o opt-in antecipado eliminou os erros no ensaio final.
- A animação de entrada antiga foi desativada apenas no desktop da área logada, evitando duas animações sobrepostas. A transição de troca de página está limitada a larguras acima de 720 px e a quem não solicita movimento reduzido; o efeito móvel anterior foi preservado.
- Sem suporte à transição, continuam os links nativos. Não há fetch de páginas, roteador próprio ou interceptação de autenticação, popstate ou cliques. Voltar, Avançar, links em outra aba e formulários mantêm a semântica original.
- Sem JavaScript, a navegação HTML continua visível. Se o script principal da interface falhar, o inicializador devolve o menu HTML original ao carregar a página.

Referência técnica: [transições entre documentos — Chrome Developers](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document) e [Chrome: orientação de implementação](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/cross-document-transitions). É um aprimoramento progressivo; a disponibilidade depende do navegador.

## Verificação e evidências

`node scripts/verificar-navegacao-local.mjs`:

- 12 combinações: seis páginas, barra expandida/recolhida, JavaScript de interface atrasado 250 ms.
- Todos os frames medidos mantiveram largura e margem em 196 ou 76 px; nenhum salto vertical nos links da barra.
- Transição nativa realmente iniciada no clique entre documentos.
- Voltar e Avançar nativos passaram; mudar a preferência na segunda página e voltar preservou o estado atual.
- Movimento reduzido, navegação sem JS e fallback com `ui.js` bloqueado passaram.
- Zero erros JavaScript no ensaio final. Não foram omitidos os erros intermediários: a posição do CSS crítico foi corrigida antes da aprovação.

Também passaram: 98 testes selecionados, oito cenários móveis de teclado/gaveta simulados, ensaio de recolhimento com cliques rápidos e movimento reduzido, 69 verificações de layout em 13 páginas e regressão responsiva de 51 cenários. Os números são conjuntos sobrepostos, não devem ser somados como cobertura independente.

Inspeção adicional com Chrome DevTools MCP na prévia `localhost:4173`: Home e Conversas com lateral/margem em 196 px, animação antiga desativada e token de navegação em 280 ms. Usada uma aba isolada, preservando a aba móvel anterior do usuário.

Evidências específicas em `.cache/navigation-review/`: diagnóstico anterior, `result.json`, `regressao.log` e capturas. Ensaios sobre prévia com fixtures; não certificam Firebase, IA, permissões de produção ou latência de carregamento na internet. Não houve teste em aparelho físico/Safari nem aprovação visual final do usuário.

## Impacto e limites

Escopo: `shell-init.js`, `shell.css`, `ui.js`, as seis páginas HTML logadas, novo verificador e registros de continuidade. Sem mudança de API, banco, token, regras, cache de respostas, conteúdo aprovado, imagens, login ou endpoints de IA. Nenhuma dependência instalada e nenhuma consulta paga de componentes.

O site continua com páginas distintas e seu carregamento nativo. O que foi corrigido é a oscilação da barra, com transição visual progressiva entre documentos compatíveis. Se uma página demorar a responder, a transição não elimina essa demora. Serviços externos carregados no head, como VLibras, continuam presentes e não foram alterados nesta tarefa.

Backups dos oito arquivos existentes anteriores à rodada em `.cache/navigation-review/before/public/`. Para reverter, comparar somente esses arquivos e preservar alterações posteriores. `shell-init.js` e o verificador são novos. Não aplicar os reversores amplos de rodadas anteriores nem usar reset/clean.

Alinhamento de impacto: implementação ficou na navegação compartilhada prevista e nos seis consumidores que carregam `shell.css`; sem mudança de dados ou serviços. A avaliação visual do usuário continua necessária para julgar a sensação de fluidez.
