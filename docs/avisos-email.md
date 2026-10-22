# Avisos por e-mail com Firebase e Gmail

## Funcionamento

Ao criar um aviso com `publicado: true`, a Cloud Function
`enfileirarNotificacoesAviso` percorre **todos os perfis em `users`**, em páginas
de 100, e cria uma entrega em `avisosEmails` por UID. Inclui alunos,
administradores e contas antigas, independentemente de `preferencias.avisosEmail`.
O seletor antigo de notificações foi substituído por uma explicação nas configurações.

`enviarNotificacaoAviso` confere o perfil, a publicação e a conta no Firebase
Authentication. Usa o e-mail atual do Auth, nunca o campo editável do perfil.
Contas removidas, desabilitadas ou sem e-mail são ignoradas. Uma conta apenas no
Auth, sem perfil em `users`, não é incluída; o cadastro do site cria esse perfil.

O worker grava uma mensagem individual em `mail` e marca a entrega como
`enfileirado` na mesma transação. A extensão oficial **Trigger Email from
Firestore** (`firebase/firestore-send-email@0.2.10`) lê `mail` e envia por SMTP
com a conta **sylvinho582@gmail.com**. Os destinatários não veem outros endereços.

Só a criação dispara o processo: editar/excluir avisos, ou publicar depois um
documento criado como rascunho, não dispara e-mails. O formulário atual já cria
avisos publicados. O conteúdo é o da criação. Se o aviso for removido antes do
worker, a entrega é ignorada; após entrar em `mail`, ela já está a cargo da extensão.

## Ativação no projeto tcc-ia-d8891

O código local não instala a extensão nem envia mensagens sozinho. Na consulta
de 22/10/2026, o banco `(default)` era Standard em `southamerica-east1` e o projeto
não tinha Cloud Functions nem extensões instaladas.

1. O projeto precisa estar no plano **Blaze**, requisito de Cloud Functions e
   da extensão. Confira o faturamento no console antes de instalar.
2. Na conta Google **sylvinho582@gmail.com**, ative a verificação em duas etapas
   e crie uma [senha de app](https://myaccount.google.com/apppasswords) chamada
   “Sylvinho Firebase”. Se a conta não permitir senhas de app, configure OAuth2
   conforme a documentação da extensão. Não use a senha normal da conta.
3. Instale [Trigger Email no projeto](https://console.firebase.google.com/project/tcc-ia-d8891/extensions/install?ref=firebase/firestore-send-email)
   com os parâmetros abaixo. Informe a senha de app **somente no campo secreto
   SMTP password** do instalador, nunca no código, no Git ou no chat.

| Campo | Valor |
| --- | --- |
| Firestore Instance ID | `(default)` |
| Firestore Instance Location | `southamerica-east1` |
| Localização da função, se solicitada | `southamerica-east1` |
| Authentication Type | `UsernamePassword` |
| SMTP connection URI | `smtps://sylvinho582%40gmail.com@smtp.gmail.com:465` |
| SMTP password | Senha de app da conta remetente |
| Email documents collection | `mail` |
| Default FROM address | `Sylvinho <sylvinho582@gmail.com>` |
| Default REPLY-TO address | `sylvinho582@gmail.com` |
| Users collection / Templates collection | Deixar vazios |
| Firestore TTL type | `never` |

Os parâmetros públicos também estão em
[`extensions/avisos-email.env.example`](../extensions/avisos-email.env.example).
Como alternativa ao console, em um terminal interativo na raiz:

```powershell
firebase ext:install firebase/firestore-send-email@0.2.10 --project tcc-ia-d8891 --params extensions/avisos-email.env.example
```

Não deixe o campo SMTP password vazio. O instalador salva a credencial no Secret
Manager. Não é necessário `RESEND_API_KEY` nem `AVISOS_EMAIL_FROM` na aplicação.
O Gmail usa a conta autenticada como remetente.

4. Valide o backend e publique apenas as duas funções de avisos:

```powershell
npm --prefix functions ci
npm --prefix functions run lint
npm --prefix functions run build
node --test tests/avisos-email.test.mjs tests/admin-routing.test.mjs tests/avisos-admin.test.mjs tests/avisos-access.test.mjs
firebase deploy --only functions:enfileirarNotificacoesAviso,functions:enviarNotificacaoAviso --project tcc-ia-d8891
```

`AVISOS_SITE_URL` já tem o padrão `https://tcc-ia-d8891.web.app`. Se o endereço
mudar, configure-o no ambiente das funções. Publique também as alterações das
páginas de configurações no próximo deploy do Hosting, após revisar as demais
alterações locais que esse deploy incluirá.

As regras atuais já negam qualquer acesso de clientes às coleções `mail` e
`avisosEmails`, inclusive administradores do site. Só o backend com Admin SDK e
a extensão acessam essas filas. Não abra escrita pública em `mail`.

## Validação e acompanhamento

Para testar a entrega sem notificar toda a escola, antes de publicar as funções,
crie pelo console um documento de teste em `mail` dirigido **apenas ao remetente**:

```json
{
  "to": ["sylvinho582@gmail.com"],
  "message": {
    "subject": "Teste de configuração do Sylvinho",
    "text": "O envio de e-mails pelo Firebase está funcionando."
  }
}
```

Confira o recebimento e `mail/{id}.delivery.state`. Criar um aviso publicado
depois da ativação notificará todas as contas elegíveis; use um comunicado real.
Avisos antigos não são reenviados automaticamente.

- `avisosEmails.estado = enfileirado`: mensagem gravada para a extensão, ainda
  não é confirmação de envio.
- `mail.delivery.state = SUCCESS`: o servidor SMTP aceitou a mensagem; não
  garante chegada à caixa de entrada (confira também spam).
- `mail.delivery.state = ERROR`: examine `delivery.error` e corrija a causa.
  A extensão não repete automaticamente esses erros. Após corrigir, altere
  **somente** `delivery.state` para `RETRY` no console para tentar novamente.

Falhas na criação da fila ou na transação são repetidas pelo Firebase. O ID
derivado de aviso, data de criação e UID impede novas mensagens em eventos
repetidos. O código nunca sobrescreve `delivery` de uma mensagem existente.
SMTP não oferece garantia absoluta de entrega exatamente uma vez; uma falha
após aceitação pelo servidor pode deixar resultado incerto.

Os testes locais simulam Auth/Firestore e não enviam e-mails. Ao usar o emulador
de Extensions, utilize SMTP de teste local: a extensão pode acessar servidores
SMTP reais mesmo em um emulador.

## Limites e manutenção

O Gmail pessoal pode bloquear envios acima de **500 e-mails/dia**. Como cada
aviso gera uma mensagem por conta, dimensione pelo total de usuários vezes os
avisos publicados, somando os demais envios dessa conta. Destinatários Gmail
também estão sujeitos a esse limite. Para volumes maiores, troque o SMTP da
extensão por um serviço apropriado e reconfigure o remetente.

O Firebase anunciou o encerramento da gestão de Extensions em **31/03/2027**:
depois dessa data não será possível instalar ou editar extensões. Planeje migrar
o envio para funções gerenciadas pelo projeto antes desse prazo; a fila `mail`
pode continuar como contrato da aplicação.

Fontes oficiais:

- [Trigger Email: instalação e formato](https://firebase.google.com/docs/extensions/official/firestore-send-email)
- [Estados de entrega e retentativas](https://firebase.google.com/docs/extensions/official/firestore-send-email/delivery-status)
- [Parâmetros, plano Blaze e aviso de encerramento](https://extensions.dev/extensions/firebase/firestore-send-email)
- [Senhas de app do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR)
- [Limites do Gmail](https://support.google.com/mail/answer/22839?hl=pt-BR)
