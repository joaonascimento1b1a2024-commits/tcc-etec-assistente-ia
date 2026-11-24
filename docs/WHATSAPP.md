# Sylvinho no WhatsApp

O Sylvinho também responde no WhatsApp, com as **mesmas respostas do chat de visitante** do site:
- usa a base curada primeiro e a busca documental depois;
- não guarda histórico;
- não grava nada no banco.

A integração usa a **WhatsApp Cloud API**, a API oficial da Meta, com o **número de teste gratuito** que a Meta oferece.

> **Limite do número de teste:** ele só conversa com até **5 celulares cadastrados** no painel da Meta. Serve para demonstrar na banca. Para abrir ao público é preciso um número próprio, que não esteja em uso no WhatsApp comum, e a verificação da empresa na Meta. Esse processo leva semanas e precisa da escola.

## Como funciona

```text
Celular ──► WhatsApp ──► Meta ──POST /whatsapp/webhook──► Servidor no Render
                                                                │ confere a assinatura da Meta
                                                                │ responde 200 na hora
                                                                ▼
                                                  fluxo do chat de visitante
                                                                │
Celular ◄── WhatsApp ◄── Meta ◄──── Graph API /messages ────────┘
```

O código está em [render-poc/whatsapp.cjs](../render-poc/whatsapp.cjs). A rota é ligada em [render-poc/server.cjs](../render-poc/server.cjs).

| Cuidado | Como foi feito |
| --- | --- |
| Mensagem falsa, que não veio da Meta | Toda mensagem precisa da assinatura `X-Hub-Signature-256`, feita com a chave secreta do app. Sem ela, o servidor responde 401. |
| A Meta reenviar a mesma mensagem | O servidor responde 200 antes de gerar a resposta e guarda o id das mensagens recentes, para não responder duas vezes. |
| Servidor "dormindo" no plano gratuito | Mensagens com mais de 15 minutos não são respondidas, para não chegarem respostas atrasadas e fora de contexto. |
| Abuso | Máximo de 8 mensagens por minuto por número, além dos limites que já existem no chat de visitante. |
| Privacidade | Telefone e texto não são gravados nem aparecem nos logs. Em memória ficam só o id das mensagens e um contador por número, guardado como hash. |
| Áudio, foto e figurinha | O Sylvinho pede que a pessoa escreva a dúvida. |
| Resposta demorada | Aparece "digitando…" enquanto o Sylvinho prepara a resposta. |
| Fontes oficiais | Os links das fontes da resposta vão no fim da mensagem. |
| Erro no motor da IA | A pessoa recebe uma mensagem amigável, sem detalhes internos. |

Sem as variáveis `WHATSAPP_*`, a integração fica desligada e a rota nem existe. Se alguma variável estiver errada, a integração também desliga e aparece o aviso `WHATSAPP_CONFIG_INVALIDA` no log. O site continua funcionando normalmente.

## Passo a passo da configuração

A ordem importa: **a Meta testa o webhook na hora em que ele é cadastrado**. Por isso, o servidor precisa estar publicado e com as variáveis antes do passo 5.

### 1. Criar o app na Meta

1. Entre em [developers.facebook.com](https://developers.facebook.com) com uma conta do Facebook e abra **Meus apps → Criar app**.
2. No caso de uso, escolha a opção de **conectar com clientes pelo WhatsApp**.
3. Crie ou escolha um **portfólio empresarial**. Ele pode ser só do grupo do TCC.
4. No menu do app, abra **WhatsApp → Configuração da API**. A Meta já mostra um **número de teste** no campo "De".

### 2. Anotar os dados

| Dado no painel da Meta | Onde fica | Vira a variável |
| --- | --- | --- |
| **Identificação do número de telefone** (Phone number ID) | WhatsApp → Configuração da API, abaixo do número de teste | `WHATSAPP_PHONE_NUMBER_ID` |
| **Chave secreta do app** (App Secret) | Configurações do app → Básico → "Mostrar" | `WHATSAPP_APP_SECRET` |
| **Token de acesso** | Veja o item 3 | `WHATSAPP_TOKEN` |
| **Token de verificação**: uma frase que o grupo inventa, com pelo menos 16 caracteres e sem espaços | Gere no seu computador com `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` | `WHATSAPP_VERIFY_TOKEN` |

O token de acesso, a chave secreta e o token de verificação são **segredos**. Não podem ir para o código, o git, prints de slides ou o chat.

### 3. Gerar o token de acesso

- **Para testar rápido:** a Configuração da API tem um botão para gerar um **token temporário**. Ele vale 24 horas.
- **Para a banca:** use um token que não expira.
  1. Abra **Configurações do negócio → Usuários → Usuários do sistema**.
  2. Crie um usuário do sistema "Admin".
  3. Atribua a ele o app e a conta do WhatsApp.
  4. Clique em **Gerar token**, com as permissões `whatsapp_business_messaging` e `whatsapp_business_management` e validade "Nunca".

### 4. Cadastrar os celulares e colocar as variáveis no Render

1. Na Configuração da API, no campo **"Para"**, cadastre os celulares do grupo (até 5). Cada um recebe um código pelo WhatsApp para confirmar.
2. No painel do Render, serviço `sylvinho-backend-poc`, abra **Environment** e adicione as quatro variáveis: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET`.
3. Salve e faça o **Manual Deploy**, com o commit que contém `render-poc/whatsapp.cjs` já na `main`.

### 5. Cadastrar o webhook na Meta

1. Abra **WhatsApp → Configuração → Webhook → Editar**.
2. Preencha os dois campos:
   - **URL de retorno de chamada:** `https://sylvinho-backend-poc.onrender.com/whatsapp/webhook`;
   - **Token de verificação:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN`.
3. Clique em **Verificar e salvar**. Se o servidor estiver dormindo, abra antes `https://sylvinho-backend-poc.onrender.com/health`, espere responder e tente de novo.
4. Em **Campos do webhook**, assine o campo **`messages`**.

### 6. Testar

1. De um celular cadastrado, mande para o número de teste, por exemplo: "Quando é a rematrícula?"
2. O Sylvinho marca a mensagem como lida, mostra "digitando…" e responde.
3. No log do Render, procure as linhas `SYLVINHO_WHATSAPP`:
   - `WHATSAPP_RESPOSTA_ENVIADA` indica que deu certo;
   - os outros códigos estão na tabela abaixo.

Depois de testar, o botão da página **Serviços** do site recebe o número de teste, em `WHATSAPP_NUMBER` no arquivo [servicos.js](../public/Logado/Serviços/servicos.js).

## Quando algo dá errado

| Sintoma ou log | Causa provável | O que fazer |
| --- | --- | --- |
| "Verificar e salvar" falha | O servidor está dormindo, ainda não foi publicado, ou o token de verificação é diferente | Abra `/health`, confira o valor no Render e tente de novo. |
| Nenhuma linha `SYLVINHO_WHATSAPP` no log | O webhook não está assinando `messages`, ou o app não entrega webhooks em modo de desenvolvimento | Confira os Campos do webhook. Se precisar, publique o app (modo Ativo) usando a política de privacidade do site. |
| `WHATSAPP_ASSINATURA_INVALIDA` | `WHATSAPP_APP_SECRET` é de outro app ou foi copiado errado | Copie de novo a chave secreta do app. |
| `WHATSAPP_ENVIO_FALHOU` com `codigo` 190 | O token expirou (o temporário dura 24 h) | Gere um token de usuário do sistema que não expira. |
| `WHATSAPP_ENVIO_FALHOU` com `codigo` 131030 | O celular não está na lista "Para" do número de teste | Cadastre o celular. O servidor já tenta de novo com o nono dígito, porque às vezes a Meta entrega números brasileiros sem ele. |
| `WHATSAPP_ENTREGA_FALHOU` | A Meta aceitou a resposta, mas não conseguiu entregar no celular. O `codigo` diz o motivo: 131026 costuma ser WhatsApp desatualizado ou termos novos não aceitos no celular, e 131047 é conversa parada há mais de 24 horas | Atualize o WhatsApp do celular e mande uma mensagem nova. |
| `WHATSAPP_CONFIG_INVALIDA` | Falta uma variável ou o formato está errado | Confira as quatro variáveis. O App Secret tem 32 caracteres e o Phone number ID só tem números. |
| Primeira resposta demora cerca de 1 minuto | O plano gratuito do Render dorme quando fica parado | Antes da demonstração, abra `/health` ou mande uma mensagem de aquecimento. |

## Custos

As conversas iniciadas pela pessoa e respondidas dentro de 24 horas são gratuitas na API da Meta. O Sylvinho só responde, nunca inicia conversas, então a demonstração não gera cobrança. A IA continua usando a mesma cota do Gemini que o site.

## Testes

```bash
npm --prefix render-poc test
```

O arquivo [render-poc/test/whatsapp.test.cjs](../render-poc/test/whatsapp.test.cjs) tem 14 testes. Eles conferem:

- a verificação da Meta;
- a assinatura;
- a resposta normal;
- mensagens repetidas, antigas e de outro número;
- áudio e textos longos;
- o limite por número;
- falhas do motor;
- o nono dígito;
- a formatação das fontes;
- que nenhum log contém telefone, pergunta ou token.

Nenhum teste fala com a Meta: o envio é simulado.
