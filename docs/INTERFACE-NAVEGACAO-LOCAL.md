# Navegação e cabeçalho do Sylvinho

Atualização posterior: [navegação desktop sem salto](NAVEGACAO-DESKTOP-SUAVE-LOCAL.md). Preferência da lateral restaurada antes da pintura, ícones estáticos e transição entre documentos no desktop; Voltar/Avançar e 12 combinações de primeira pintura verificados.

Atualização móvel posterior: corrigido conflito da altura mínima com a janela visual, incluindo toque na horizontal e texto multilinha. Ver [celular, resultados e limitações](CELULAR-E-VERIFICACOES-LOCAIS.md). Simulação não substitui aparelho físico.

Atualização posterior de 12/11/2026: o recolhimento desktop recebeu transição sincronizada de largura e espaço do conteúdo. Ver [entrega e verificações atuais](RECOLHIMENTO-DESKTOP-LOCAL.md). Os resultados abaixo permanecem como histórico da rodada original.

Entrega local de 12/11/2026. Sem commit, push ou deploy. Nenhuma consulta de código ou geração do 21st foi usada.

## Resultado

A interface usa a publicação como referência de escala, mantendo Poppins, os fundos existentes, as logos originais e a estrutura de páginas em HTML, CSS e JavaScript. Não houve migração para React ou instalação de componentes no projeto.

A lateral tem caixas distintas para item selecionado, hover e foco. O Novo chat tem tratamento próprio com borda, sombra vermelha discreta e um reflexo que passa uma vez ao receber hover ou foco. Não há brilho animado continuamente. O efeito de movimento é removido quando o usuário pede movimento reduzido.

No desktop, a lateral alterna entre 196 px e uma faixa de 76 px com ícones. Os links mantêm nome acessível e tooltip no modo compacto. A preferência é guardada localmente e não depende da conta ou de gravação no Firebase. O menu aceita rolagem quando sua altura não cabe na janela.

No celular, a navegação fica recolhida e abre como uma gaveta sobre a tela. O conteúdo de fundo fica inerte enquanto ela está aberta; o foco permanece dentro da navegação. Escape, clique fora e o botão Fechar menu encerram a gaveta e devolvem o foco ao botão que a abriu. Ao selecionar um destino, ela também fecha. Sem JavaScript, a navegação original continua visível.

O cabeçalho é uma faixa simples, sem caixa arredondada, cápsula de perfil ou seta de dropdown. Mostra Sylvinho e o nome do usuário. A foto existente continua sendo utilizada quando disponível; na ausência dela, há um ícone discreto de usuário, sem iniciais vermelhas. Nomes longos são acomodados no desktop; no celular, a identificação visual é compacta, mantendo o nome acessível definido pelo fluxo da conta. Não há indicador fictício de disponibilidade da IA.

O chat continua com histórico rolável e campo de escrita reservado no fim da janela. A altura da janela visual é considerada no celular para acompanhar a abertura de teclado, preservando o zoom nativo. O comportamento em aparelho físico, especialmente no Safari, ainda precisa de validação manual.

## Escala e diferenças intencionais

| Elemento | Referência hospedada medida | Resultado local |
| --- | --- | --- |
| Lateral expandida | 196 px | 196 px |
| Links da lateral | 14 px e área de 44 px | 14 px e área mínima de 44 px, com caixa e espaçamento interno |
| Novo chat | Fonte 16 px e altura 48 px | Fonte 16 px e altura mínima de 48 px no desktop |
| Logo da lateral | Largura 130 px | Largura 130 px |
| Espaço entre links da lateral | 20 px | 20 px |
| Cartões da Home | Altura mínima 108 px | Altura mínima 108 px no desktop e 72 px no celular |
| Campo de escrita | Cerca de 45 px | Área mínima de 48 px, preservando texto de entrada de 16 px no celular |
| Cabeçalho | Faixa de 44 px | Faixa simples de aproximadamente 49 px, com alvos de toque de pelo menos 44 px |

Não foi aplicado zoom global nem reduzido o tamanho raiz da fonte para encolher o site. As medidas acima são CSS pixels. Foi confirmada uma diferença de zoom nas abas usadas na comparação: `127.0.0.1` estava em 80%, enquanto o hospedado estava em 100%. A prévia em `localhost` foi aberta e medida em 100%, com lateral de 196 px, logo de 130 px e Novo chat de 48 px. Os testes de navegador usam viewport controlado, independente do zoom da aba pessoal.

## Figma

As capturas atuais do cabeçalho simplificado e das proporções revisadas foram confirmadas no arquivo TCC Front:

- [Desktop atual](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=344-63).
- [Mobile atual](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=345-63).

As cinco capturas da versão anterior permanecem disponíveis como histórico; não são a referência atual do cabeçalho e da escala da lateral:

- [Desktop expandido](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=339-63).
- [Desktop recolhido](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=340-63).
- [Home mobile](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=341-63).
- [Menu mobile aberto](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=342-63).
- [Mobile claro](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=343-63).

As capturas foram feitas a partir da prévia local com dados fictícios. Não foram enviadas conversas reais, credenciais ou documentos da escola. Os quadros são importações do layout, não uma biblioteca de componentes com variantes e prototipagem pronta.

O plano Starter bloqueou as chamadas de biblioteca, busca e edição direta. Por isso, a componentização, a organização refinada dos quadros, a criação de conexões de protótipo e a verificação estrutural/visual posterior dentro do Figma ficaram pendentes. O fluxo separado de captura conseguiu adicionar as telas e confirmou seus links. Não é correto apresentar isso como uma homologação completa do arquivo de design.

A ponte de captura existe somente em `scripts/preview-figma-local.mjs`, fora de `public/`. Ela foi encerrada após a transferência. O script de captura não foi incluído no site ou na prévia normal.

## Arquivos

- `public/Logado/shell.css`: novo arquivo para a navegação e o cabeçalho, carregado após o layout compartilhado.
- `public/Arquivos-Universais/ui.js`: recolhimento, gaveta, foco, rótulos, ícone de perfil, altura visual e sincronização de `aria-current` com a seleção do chat. As funções anteriores de copiar resposta, mostrar senha e processamento foram preservadas.
- `public/Logado/Home/home.html`: identificação do Sylvinho, link para pular ao conteúdo e carregamento do estilo compartilhado.
- As outras cinco páginas logadas: inclusão de `shell.css`, preservando seu conteúdo e seus fluxos.
- `public/Chat/chat.css`: uso da altura visual também no chat público.
- `scripts/verificar-shell-local.mjs`: verificações de páginas públicas, telas logadas e interações do menu.
- `scripts/verificar-chat-responsivo.mjs`: adaptação do teste ao novo comportamento modal da gaveta.
- `tests/session-navigation.test.mjs`: inclusão dos temporizadores do navegador no contexto simulado do teste. Não modifica a autenticação da aplicação.
- `scripts/reverter-shell-local.mjs`: reversão protegida das alterações de interface desta entrega.

## Verificação

A execução inicial dos quatro arquivos de testes selecionados teve 93 aprovações e 6 falhas. Cinco falhas eram causadas por temporizadores ausentes no contexto simulado de sessão; foram corrigidas no teste. A outra depende de `tests/dados/rag-original.json`, que já estava ausente e não foi inventado ou substituído nesta entrega.

- Regressão selecionada final: 98 testes passaram. O caso dependente dessa fixture foi excluído explicitamente pelo nome.
- Chat público e autenticado na prévia: 51 cenários passaram, incluindo janela baixa, textos multilinha, histórico longo e fechamento da gaveta antes de voltar a escrever.
- Interface: 69 verificações de layout em 13 páginas, incluindo larguras 320, 390, 768 e 1440, além de cenários específicos.
- Interações verificadas: recolher e expandir, persistência, retorno após redimensionamento, gaveta modal, Tab/Shift+Tab, Escape, clique fora, seleção ativa, hover, rolagem da lateral, nome extenso, tema claro e movimento reduzido.
- Foco inicial visível também em janela baixa; campo de escrita permaneceu dentro da janela nas verificações.
- Nenhum erro de JavaScript ou pedido externo foi registrado na execução da prévia isolada.
- Capturas locais de desktop, modo recolhido, mobile, gaveta e tema claro foram inspecionadas.

As verificações usam `scripts/preview-ui.mjs`, que substitui os serviços reais por fixtures. Não certificam Gemini/RAG, envio de e-mails, login ou permissões de produção. Não foi feita auditoria completa com leitor de tela ou teste em aparelho físico. O problema antigo de WhatsApp não foi ativado nem alterado nesta tarefa.

Comandos executados:

```powershell
node --test --test-skip-pattern="formato real gerado" tests/home-assistente.test.mjs tests/assistente-client.test.mjs tests/resposta-documental-view.test.mjs tests/session-navigation.test.mjs
node scripts/verificar-chat-responsivo.mjs
node scripts/verificar-shell-local.mjs
```

Evidências em `.cache/shell-review/`, `.cache/ui-review/responsive/` e `.cache/interface-shell-before-2026-11-12/`.

## Conferir localmente

A prévia visual está em http://localhost:4173/Logado/Home/home.html. O endereço `127.0.0.1:4173` também responde, mas pode manter outro zoom salvo pelo Chrome. Para comparar nessa aba, usar Ctrl+0 manualmente. Se precisar reiniciar a prévia:

```powershell
node scripts/preview-ui.mjs
```

Ela usa dados fictícios e não conversa com a IA. Os arquivos de interface alterados são os mesmos que serão servidos quando o ambiente real da aplicação for executado. Nenhum backend foi iniciado ou reconfigurado para esta tarefa.

## Reverter a interface

O backup guarda os arquivos da interface como estavam no começo desta tarefa, incluindo as melhorias locais anteriores. A reversão não usa `git reset`, `git clean` ou checkout do repositório.

Para conferir o que será restaurado, sem alterar nada:

```powershell
node scripts/reverter-shell-local.mjs
```

Para aplicar a reversão da interface:

```powershell
node scripts/reverter-shell-local.mjs --aplicar
```

O script verifica os hashes e aborta se houver alterações posteriores, evitando sobrescrever trabalho novo. Restaura os oito arquivos públicos modificados e remove somente o novo CSS da navegação. Não altera dados, Figma, testes ou documentação.

Antes de um futuro commit no branch de teste, revisar a interface com o usuário, validar o celular real e conferir a lista completa de alterações já existentes no workspace. Nenhum branch, commit, push ou deploy foi criado nesta entrega.
