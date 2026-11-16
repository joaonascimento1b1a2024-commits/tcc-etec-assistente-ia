# Revisão local de interface — Sylvinho

Base: `156c88a`. Trabalho sem commit, push, deploy ou modificação remota do Figma.

## Abrir na máquina

```powershell
node scripts/preview-ui.mjs
```

Endereço: http://127.0.0.1:4173

A prévia serve os HTMLs, estilos e imagens do projeto com dados fictícios identificados na tela. Ela substitui apenas durante a resposta HTTP os scripts de autenticação e dados por fixtures locais. Não valida login real, entrega de e-mail, geração de IA ou persistência. O servidor escuta somente em loopback e bloqueia conexões a serviços externos por CSP. A fonte Poppins é local.

Os arquivos de produção conservam a lógica original de autenticação, recuperação e armazenamento. A busca atua sobre os títulos da lista completa observada de conversas; o filtro de avisos atua somente nas categorias existentes. Nenhum índice ou contrato de banco foi alterado.

## Alterações

- Ícones SVG locais e consistentes no menu e cartões, com identificação acessível.
- Poppins 400/500/600/700 em WOFF2 local, licença incluída; retirada das requisições de fonte ao Google.
- Tema da conta restrito à área `/Logado/`; páginas públicas permanecem escuras.
- Largura comum para conversa e formulário, foco visível, campo multilinha, Enter para enviar e Shift+Enter para nova linha.
- Remoção do botão de anexo sem implementação.
- Copiar resposta preservando o texto original e referências; falha de permissão não mostra sucesso.
- Mostrar/ocultar senha mantendo valor e autocomplete.
- Indicador de processamento ligado ao estado da requisição, sem alterar identificadores nem repetir envios.
- Busca por título sem distinguir acentos; filtro por categoria de avisos.
- Moldura de leitura, idioma e navegação dos termos e privacidade; conteúdo original preservado.
- Textos de notificações alinhados ao backend: publicação gera fila para perfis existentes; contas removidas, desabilitadas ou sem e-mail não recebem entrega.
- Fundos PNG convertidos para WebP sem perda, com comparação dos pixels decodificados; originais mantidos.

## Limites preservados

- WhatsApp: número, destino e lógica não alterados. A pendência conhecida continua fora desta rodada.
- Logos oficiais, mascote original, documentos de referência e regras do banco não modificados.
- Sem dependência de framework ou mudança de pastas existentes.
- Sem links inventados para documentos: a apresentação de fontes existente foi preservada. Abrir um documento requer identificador/URL confiável fornecido pelo backend; não foi adicionado um link inferido a partir do texto.

## Fundo: tamanho transferido

| Imagem | PNG original | WebP sem perda |
| --- | ---: | ---: |
| Landing | 1.498.222 bytes | 920.006 bytes |
| Área logada | 1.298.493 bytes | 997.344 bytes |
| Login/cadastro | 1.198.956 bytes | 871.748 bytes |

Total: 3.995.671 → 2.789.098 bytes, redução aproximada de 30,2%. Os originais permanecem no repositório; a redução refere-se aos arquivos solicitados pelo CSS, não ao tamanho total da pasta.

## Controle visual para Figma

Nenhuma edição foi enviada ao Figma por esta rodada ser exclusivamente local. A referência continua sendo TCC - Front (`o12zEQuWX9XfnKaOzhD3Dl`). Para uma atualização posterior, manter os frames existentes e adicionar uma página de revisão com:

1. Componentes: botões primário/secundário/discreto, campo com senha, campo de mensagem, cartões, menu, busca e filtro.
2. Área pública escura e área logada em escuro/claro; manter marcas oficiais intactas.
3. Layouts de 1440×900 e 390×844; rótulos móveis sempre legíveis.
4. Estados: aguardando resposta, erro recuperável, vazio, sucesso, fonte parcial e falta de permissão.
5. Resposta documental: texto, referências expansíveis e copiar original; abertura de documento somente com destino confiável.

Os screenshots de revisão e resultados automatizados ficam em `.cache/ui-review/` e não são publicados.

## Cópia de segurança

Antes de alterar: `C:\Programação\Backups\sylvinho-ui-20261111\public`.
Commit base registrado em `base-commit.txt`. O inventário local das mudanças fica em `.cache/ui-review/manifest.json`.

Para desfazer, comparar primeiro o inventário com o estado atual, recuperar somente os arquivos desta rodada a partir do backup e remover somente os novos arquivos indicados no inventário. Não usar reset/clean global nem reaplicar o stash como mecanismo de retorno. Alterações feitas por outra pessoa depois desta rodada devem ser preservadas.

## Validação

- Build TypeScript das Functions concluído; nenhuma fonte do backend modificada.
- 84 testes selecionados de visitante, transporte, pendências, apresentação documental e notificações passaram. Dois casos preexistentes foram excluídos da rodada: fixture local `tests/dados/rag-original.json` ausente e mock do entrypoint incompatível com os imports atuais. A primeira execução que os incluiu registrou essas falhas; não foram ocultadas por mudança de teste.
- 14 verificações de navegador locais: tema público/logado, senha, copiar com sucesso/falha, múltiplas linhas, larguras, busca real por título, filtro real por categoria, movimento reduzido e ausência de overflow em desktop/celular.
- O teste integrado iniciou Auth, Firestore, Functions e Hosting no projeto demo, autenticou uma conta fictícia e validou o token. A primeira pergunta foi recusada pelo backend com HTTP 403 (demonstração não autorizada); o roteiro legado esperava 200. Não se alteraram as permissões nem o backend para forçar aprovação. Portanto o fluxo integrado de resposta/persistência não está aprovado por esta rodada.
- O controlador real do chat visitante também foi exercitado com adapters locais simulados, separado das fixtures da prévia: sucesso, timeout, reset e resposta tardia.

As verificações não substituem sua aprovação visual nem validam serviços publicados.

## Correção da barra de escrita

Após avaliação no navegador do usuário, a faixa de prévia foi removida. O chat passou a usar a altura dinâmica da janela, com rolagem restrita ao conteúdo central e compositor sempre fora dessa rolagem. Isso foi aplicado à Home autenticada e ao chat público.

No celular, a navegação pode ser aberta pelo botão Menu sem aumentar a altura do documento. O campo cresce até o limite de 24% da altura disponível ou 160 px, o menor deles. A identificação de conteúdo fictício continua nas respostas da prévia.

Foram verificadas 51 condições de posição e clique do campo em oito tamanhos de viewport (1903×945, 1440×900, 1366×650, 1280×600, 768×600, 390×700, 320×480 e 390×360): tela inicial, 30 mensagens, digitação multilinha e menu aberto. Não houve erro JavaScript. O viewport baixo aproxima redução da área útil; não substitui teste de teclado virtual em aparelho físico.

Para repetir com a prévia ligada:

```powershell
node scripts/verificar-chat-responsivo.mjs
```

Os 61 testes selecionados de visitante, transporte e pendências e as 14 verificações gerais de navegador também passaram após a correção. Evidências em `.cache/ui-review/responsive/`.
