# Landing local baseada no Figma

Referência: arquivo `o12zEQuWX9XfnKaOzhD3Dl`, frame `22:14` (Lange Page). Nenhum commit, deploy ou edição remota do Figma.

## Implementação

`public/index.html` contém a página completa. `public/Landing-Page/landing.css` é exclusivo dela; o CSS compartilhado anteriormente usado pela página Sobre não foi refeito. A navegação e os destinos de login, chat público, cadastro e equipe usam rotas existentes.

Composição em 1440 px:

| Bloco | Posição vertical | Altura |
| --- | ---: | ---: |
| Apresentação | 0 | 816 |
| Benefícios | 816 | 521 |
| Notebook | 1337 | 1024 |
| Três etapas | 2361 | 600 |
| Serviços e chamada final | 2961 | aproximadamente 776 |
| Rodapé | aproximadamente 3737 | 264 |

Esses valores foram medidos no navegador. A estrutura usa grid e fluxo normal, em vez de posicionar todos os textos absolutamente. Em celular/tablet, as colunas são reorganizadas e a página permanece rolável.

## Artes e fontes

- Hero, notebook, ondas e chamada final exportados pelo MCP do Figma e servidos em WebP sem perda. Os PNGs exportados também estão preservados em `public/Landing-Page/arquivos/figma/`.
- Círculos das etapas, divisor e marcas sociais são SVGs exportados do Figma.
- ETEC usa o arquivo oficial existente; o conjunto CPS/Governo usa a arte exportada, preservando proporção e recorte do frame. Nenhuma logo original foi editada.
- Ícones de serviços: SVGs oficiais da biblioteca Google Material Design Icons, equivalente à biblioteca vinculada no desenho. O projeto não tem os componentes React do kit. Licença incluída em `LICENSE-Material.txt`.
- Poppins local; peso 300 acrescentado para os textos leves. Licença já incluída em `Arquivos-Universais/fonts/OFL-Poppins.txt`.
- Não há URL temporária do Figma em referência de imagem/CSS em produção.

O MCP atingiu o limite de consultas do plano Starter durante a leitura dos ícones. O contexto de alta fidelidade da página, suas artes e o screenshot foram obtidos antes disso; a implementação não exige mudar o plano.

## Diferenças intencionais

- “em segundos” substitui o erro “sem segundos”.
- Terceira etapa usa “Receba a resposta”, evitando repetir “Digite sua dúvida”.
- Poppins é mantida também onde o desenho usa Inter, conforme a decisão de fonte padrão do projeto.
- Botões conservam o vermelho acessível adotado na revisão; textos do rodapé têm contraste maior que o cinza original do desenho.
- Ícones de redes sociais são elementos visuais, sem inventar endereços de perfis. O rodapé oferece acesso à página de equipe existente.
- O link “Ver como funciona” continua abrindo o chat público, preservando o fluxo anterior.

## Verificações

Passaram oito grupos de verificações no navegador: estrutura, ausência de overflow, carregamento de todas as imagens e destinos em seis viewports (1440×900, 1903×945, 1024×768, 768×800, 390×844 e 320×640), âncora Serviços e atalho de teclado para conteúdo. Nenhum erro de JavaScript ou recurso HTTP com falha. O teste existente de ligação entre landing e chat público também passou.

Screenshots e geometria: `.cache/landing-review/`. A conferência visual comparou desktop e adaptações mobile/tablet com o desenho. Não é uma promessa de equivalência pixel a pixel: as diferenças intencionais estão descritas acima.

Prévia: http://127.0.0.1:4173/

Cópia anterior à alteração da landing: `.cache/landing-before/`. O inventário geral de alterações locais permanece em `.cache/ui-review/manifest.json`.
