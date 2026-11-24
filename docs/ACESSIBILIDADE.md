# Acessibilidade: alto contraste e tamanho da fonte

Este documento explica os recursos de acessibilidade do Sylvinho: o que a pessoa vê, como o código funciona, quais arquivos mudaram e como manter.

## O que a pessoa vê

Nas telas **Configurações** (aluno e administrador) há uma seção **Acessibilidade** com dois controles:

| Controle | O que faz |
| --- | --- |
| **Alto contraste** (interruptor) | Troca as cores do site inteiro por cores fortes. Funciona no tema escuro e no claro. |
| **Tamanho da fonte** (A−, A+, Padrão) | Aumenta o texto de todas as páginas, em seis tamanhos: 100%, 115%, 130%, 150%, 175% e 200%. |

As escolhas:

- valem em **todas as páginas**, inclusive nas que não pedem login (início, login, cadastro, chat de visitante, Sobre, termos e política de privacidade);
- ficam **salvas no navegador**, então continuam valendo depois de fechar o site;
- aparecem **desde a primeira tela**, sem o site "piscar" no visual padrão;
- aparecem mesmo quando a conta não carrega (sem internet, por exemplo). A seção fica fora da parte que depende do Firebase.

### As duas paletas de alto contraste

| Tema | Fundo | Texto | Links e foco | Página atual e mouse em cima |
| --- | --- | --- | --- | --- |
| Escuro | preto `#000` | branco `#fff` | amarelo `#ff0` | fundo amarelo, texto preto |
| Claro | branco `#fff` | preto `#000` | vermelho-escuro `#a00000` | fundo preto, texto branco |

O contraste entre texto e fundo fica acima de 7:1 (nível AAA da WCAG). Fora isso:

- os links ficam sublinhados, para não depender só da cor;
- botões e campos ganham borda;
- botões desativados ficam com borda tracejada;
- o foco do teclado tem um contorno de 3 px.

O widget do **VLibras** fica de fora e mantém o visual do governo federal.

## Como funciona

```text
localStorage                 acessibilidade.js             acessibilidade.css
(preferência salva)  ──►  coloca atributos no <html>  ──►  troca cores e tamanho
                          data-contraste="alto"
                          data-fonte="130"
```

1. **[acessibilidade.js](../public/Arquivos-Universais/acessibilidade.js)** roda no `<head>` de cada página, antes de a página ser desenhada.
   - Lê a preferência salva no `localStorage`.
   - Coloca dois atributos na tag `<html>`: `data-contraste` e `data-fonte`.
2. **[acessibilidade.css](../public/Arquivos-Universais/acessibilidade.css)** reage a esses atributos:
   - **fonte:** muda o tamanho base do site (`font-size` da raiz). Como todas as fontes do site estão em `rem`, todo o texto cresce na mesma proporção;
   - **contraste:** troca as variáveis de cor das páginas (`--background`, `--text`, `--accent`…) pelas cores da paleta. Também aplica regras com `!important`, que vencem as cores escritas em cada página.
3. **Tela de Configurações** ([configAl.js](../public/Logado/Configurações%20Aluno/configAl.js), seção 5): os botões chamam as funções de `window.etecAcessibilidade` e se atualizam quando a preferência muda.

### Por que no navegador, e não no Firebase?

- Precisa funcionar **antes do login**, nas páginas públicas.
- Acessibilidade depende de quem está usando o aparelho, não da conta.
- Não exige mudar o banco nem as regras de segurança do Firestore.

### Chaves salvas no `localStorage`

| Chave | Valores aceitos | Ausente significa |
| --- | --- | --- |
| `etec:acessibilidade:contraste` | `alto` | contraste normal |
| `etec:acessibilidade:fonte` | `115`, `130`, `150`, `175`, `200` | 100% (tamanho original) |

Valores desconhecidos são ignorados e o site volta ao padrão. Se o `localStorage` estiver bloqueado (modo privado, por exemplo), a mudança vale só na página aberta, sem erro.

### Funções disponíveis (`window.etecAcessibilidade`)

| Função | O que faz |
| --- | --- |
| `estado()` | Devolve `{ contrasteAlto, fonte, podeDiminuir, podeAumentar }`. |
| `definirContraste(true/false)` | Liga ou desliga o alto contraste. |
| `aumentarFonte()` / `diminuirFonte()` | Sobe ou desce um nível, sem passar de 100% ou de 200%. |
| `restaurarFonte()` | Volta para 100%. |
| `aoMudar(funcao)` | Chama a função agora e a cada mudança, inclusive quando a mudança foi feita em outra aba. |

## Acessibilidade dos próprios controles

- O interruptor usa `role="switch"` e `aria-checked`, e o leitor de tela anuncia "ligado" ou "desligado".
- O valor da fonte (`<output aria-live="polite">`) é anunciado a cada mudança.
- No limite (100% ou 200%), os botões ficam com `aria-disabled="true"` em vez de `disabled`, para o foco do teclado não sumir.
- Os botões têm pelo menos 44 px de altura, para facilitar o toque.
- Tudo funciona pelo teclado: Tab chega ao interruptor, Espaço liga ou desliga, e Enter aciona A+ e A−.

## Arquivos que mudaram

### Novos

| Arquivo | Conteúdo |
| --- | --- |
| [public/Arquivos-Universais/acessibilidade.js](../public/Arquivos-Universais/acessibilidade.js) | Lê, salva e aplica as preferências. |
| [public/Arquivos-Universais/acessibilidade.css](../public/Arquivos-Universais/acessibilidade.css) | Tamanhos de fonte e paletas de alto contraste. |
| [tests/acessibilidade.test.mjs](../tests/acessibilidade.test.mjs) | 9 testes automáticos. |

### Telas de Configurações

| Arquivo | Mudança |
| --- | --- |
| `Logado/Configurações Aluno/configAl.html` | Nova seção "Acessibilidade". |
| `Logado/Configurações Administrador/configAdmin.html` | A mesma seção. |
| `Logado/Configurações Aluno/configAl.css` | Visual do interruptor e dos botões de fonte. Este CSS vale para as duas telas. |
| `Logado/Configurações Aluno/configAl.js` | Liga os botões às funções (seção 5). |

### Todas as 13 páginas

Cada página carrega os dois arquivos no `<head>`, logo depois do `theme.js`:

```html
<link rel="stylesheet" href="…/Arquivos-Universais/acessibilidade.css" />
<script src="…/Arquivos-Universais/acessibilidade.js"></script>
```

Páginas: `index.html`, `Login/login.html`, `Criar-Conta/cadastro.html`, `Criar-Conta/termos.html`, `Criar-Conta/políticaPriv.html`, `Sobre/sobre.html`, `Chat/chat.html`, `Logado/Home/home.html`, `Logado/Conversas/conversas.html`, `Logado/Avisos/avisos.html`, `Logado/Serviços/servicos.html` e as duas telas de Configurações.

### Fontes em `rem` e layout que se adapta

Para o A+ funcionar, todo `font-size` em `px` virou `rem` (16 px = 1 rem), nos arquivos:

- `chat.css`, `landing.css`, `avisos.css`, `conversas.css`, `home.css`, `servicos.css`;
- `configAl.css`, `configAdmin.css`;
- `layout.css`, `shell.css`.

Com a fonte grande, alguns elementos saíam da tela. Agora eles mudam de coluna ou passam para a linha de baixo:

| Arquivo | Ajuste |
| --- | --- |
| `Landing-Page/landing.css` | Cartões de recursos e menu do topo. |
| `Logado/layout.css` | Cartões do Início. |
| `Logado/Conversas/conversas.css` | Título do histórico. |
| `Arquivos-Universais/visual.css` | Campo de busca de Conversas. |
| `acessibilidade.css` | O menu lateral fica mais largo conforme a fonte. Recolhido, continua estreito, só com os ícones. |

No tamanho 100%, o visual do site continua igual ao de antes.

### Correções de bugs antigos encontrados nos testes

| Arquivo | Bug | Correção |
| --- | --- | --- |
| `Arquivos-Universais/ui.js` | O menu lateral não destacava a página atual em Avisos, Serviços e Configurações. | A marca de página atual é mantida. |
| `Logado/Serviços/servicos.html` | Erro de JavaScript na página, e o botão do WhatsApp não explicava por que estava desativado. | O aviso "disponível em breve" agora aparece. |
| `Arquivos-Universais/theme.js` | — | Ajuste interno; a troca de logo de cada tema continua igual. |

## Testes

```bash
npm test
```

Os testes de [tests/acessibilidade.test.mjs](../tests/acessibilidade.test.mjs) conferem:

- o site abre no visual padrão quando não há preferência salva;
- uma preferência salva é aplicada ao abrir a página;
- valores inválidos no armazenamento voltam ao padrão;
- o contraste liga, desliga e fica salvo;
- a fonte sobe e desce sem passar de 100% nem de 200%;
- a tela de Configurações é avisada a cada mudança;
- um `localStorage` bloqueado não quebra a página;
- **toda página** carrega o CSS e o script no `<head>`, depois do tema;
- **nenhum CSS** usa `font-size` em `px`.

Os dois últimos protegem o futuro: se alguém criar uma página nova sem os arquivos de acessibilidade, ou escrever uma fonte em `px`, o teste falha.

### Teste visual feito antes da entrega (24/11/2026)

- **1368 combinações** checadas automaticamente. Resultado: nenhum texto saindo da tela ou cortado. As combinações foram:
  - as 13 páginas;
  - larguras de 360, 390, 768, 1024, 1280 e 1920 px;
  - tema escuro e claro;
  - alto contraste ligado e desligado;
  - os 6 tamanhos de fonte.
- **Teclado:** passou no teste com Tab, Espaço e Enter, e o foco ficou visível.
- **`npm test`:** 1352 testes passaram, nenhum falhou.
- **Ainda não testado:** uso logado no site publicado, porque o teste local não conecta ao Firebase real.

## Como manter

- **Página nova:** copie as duas linhas do `<head>` (CSS e script), com o caminho certo até `Arquivos-Universais/`. O teste avisa se faltar.
- **Fonte nova no CSS:** use `rem`, não `px` (por exemplo, `14px` vira `0.875rem`).
- **Cor nova numa página:** prefira as variáveis existentes (`--text`, `--background`, `--accent`…). Elas já mudam sozinhas no alto contraste.
- **Grades de cartões:** use `repeat(auto-fit, minmax(min(100%, 9rem), 1fr))`. Assim as colunas se reorganizam quando a fonte cresce.
- **Mudar os tamanhos de fonte:** altere `NIVEIS_FONTE` em `acessibilidade.js` e as regras `:root[data-fonte='…']` em `acessibilidade.css`.

## Referências

- WCAG 2.2, critério 1.4.3 (Contraste mínimo) e 1.4.6 (Contraste melhorado, AAA).
- WCAG 2.2, critério 1.4.4 (Redimensionar texto até 200%).
- WCAG 2.2, critério 2.4.7 (Foco visível) e 2.5.8 (Tamanho do alvo).
