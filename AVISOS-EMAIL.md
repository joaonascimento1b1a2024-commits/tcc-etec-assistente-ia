# Avisos por e-mail com Resend

Ao criar um documento publicado em `avisos`, a função `enfileirarNotificacoesAviso`
cria uma entrega individual para cada perfil com `preferencias.avisosEmail === true`.
Alunos e administradores participam da mesma consulta, incluindo o autor do aviso
caso tenha ativado as notificações.

`enviarNotificacaoAviso` processa cada entrega, consulta novamente a preferência e
obtém o endereço de `Firebase Authentication`. O campo `email` do perfil editável
não é usado. Contas excluídas, desabilitadas ou sem e-mail são ignoradas. As contas
existentes com login por senha também são atendidas, sem exigir um novo fluxo de
verificação de e-mail. Rascunhos, edições e exclusões não disparam e-mails.
Ativar as notificações não envia os avisos antigos.

O e-mail contém título, categoria, descrição, link para o mural e instruções para
desativar as notificações em Configurações. Cada pedido ao Resend tem apenas um
destinatário; os endereços de outras pessoas não são compartilhados.

## Configuração para ativar

O código local não ativa o envio no site publicado. São necessários um projeto
Firebase habilitado para Cloud Functions e uma conta Resend com domínio de envio
verificado. O remetente de teste do Resend não atende o envio para todos os usuários.

1. No Resend, verifique o domínio que será usado no remetente e crie uma API key
   com permissão de envio para esse domínio.
2. Cadastre a chave diretamente no Secret Manager pelo terminal; não coloque a
   chave em HTML, JavaScript público, Git ou na conversa:

   ```sh
   firebase functions:secrets:set RESEND_API_KEY --project tcc-ia-d8891
   ```

3. Crie ou edite `functions/.env.tcc-ia-d8891`, preservando as outras configurações
   que já existirem. Substitua o remetente abaixo por um endereço do seu domínio
   verificado:

   ```dotenv
   AVISOS_EMAIL_FROM="Sylvinho <avisos@seu-dominio.com.br>"
   AVISOS_SITE_URL="https://tcc-ia-d8891.web.app"
   ```

   `functions/.env.example` fornece o modelo sem credenciais. O endereço do site
   deve usar HTTPS. O remetente vazio bloqueia o envio até ser configurado.

4. Valide o código e publique as duas funções e a interface atualizada:

   ```sh
   npm --prefix functions ci
   npm --prefix functions run lint
   npm --prefix functions run build
   node --test tests/avisos-email.test.mjs tests/assistente-producao.test.mjs tests/admin-routing.test.mjs tests/avisos-admin.test.mjs tests/avisos-access.test.mjs
   firebase deploy --only functions:enfileirarNotificacoesAviso,functions:enviarNotificacaoAviso,hosting --project tcc-ia-d8891
   ```

   O deploy não foi executado como parte da preparação local. Ele publica todos
   os arquivos presentes em `public`; revise as demais alterações antes de usar
   `hosting`. As regras atuais de `firestore.rules` já negam acesso de clientes à
   coleção interna `avisosEmails`, inclusive a administradores do site. Não crie
   uma regra que permita gravar nessa fila pelo navegador.

5. Ative Notificações nas configurações de uma conta de aluno e de uma conta
   administrativa. Publique um aviso novo e confira as caixas de entrada, o spam
   e o painel do Resend. Uma conta com notificações desativadas não deve receber.

## Fila, falhas e operação

O banco usado é o existente `(default)`, Standard, em `southamerica-east1`.
As duas funções ficam na mesma região. A consulta é paginada em grupos de 100
perfis e usa o índice automático de `preferencias.avisosEmail`.

Cada documento em `avisosEmails/{hash}` representa uma publicação e um UID.
O ID deriva do ID do aviso, de sua data de criação no Firestore e do UID.
Repetições do evento não recriam entregas já existentes. Falhas parciais na
criação da fila provocam nova tentativa, preservando o progresso anterior.

A entrega armazena `avisoId`, `uid`, `avisoCriadoEm`, `conteudo`, `criadoEm` e
`estado`. Antes da primeira chamada ao provedor, uma transação persiste
`mensagem` e `primeiraTentativaEm`. Esse conteúdo e a chave `aviso/{hash}` são
reutilizados nas tentativas, mesmo que o aviso ou remetente sejam alterados.

Estados:

- `pendente`: aguardando processamento ou nova tentativa após falha temporária;
- `enviado`: o Resend aceitou o envio; `resendId` permite acompanhá-lo no provedor;
- `ignorado`: notificações desativadas, conta indisponível, e-mail alterado durante
  uma tentativa pendente, ou aviso removido/despublicado/recriado;
- `falha`: passou a janela segura de tentativas; confira `motivo`.

Aceitação pelo Resend não garante entrega na caixa de entrada; consulte o provedor
para verificar rejeições ou devoluções. Falhas de rede, timeout, limite de envio e
erros do provedor são propagados para o retry da Cloud Function. Uma falha em um
destinatário não bloqueia as entregas dos demais.

Como as chaves de idempotência do Resend duram 24 horas, a aplicação interrompe
tentativas após 23 horas desde a preparação da mensagem. Isso evita reenvio se o
Resend aceitou o pedido, mas a confirmação não foi salva no Firestore. Não apague
entregas nem reinicie manualmente essa janela para reenviar: primeiro confira o
histórico no Resend. A retomada manual de entregas encerradas não está implementada.

O worker usa uma instância, concorrência 1 e espaçamento de 600 ms entre pedidos.
Volumes maiores podem formar uma fila; acompanhe os limites da conta Resend antes
de alterar essa configuração. Os documentos de entrega ficam retidos para manter
o registro de processamento; não há exclusão automática configurada.

## Validação local

Os testes simulam Firestore, Authentication e Resend; não enviam mensagens reais.
Cobrem alunos/administradores, preferência explícita, paginação, rascunhos,
desativação antes do envio, contas removidas, falhas parciais, chamadas simultâneas,
confirmação perdida, expiração, mudança de endereço e escape de HTML.

O adaptador Resend também bloqueia envio real quando detecta o emulador de
Functions ou Firestore. Não foi realizado um envio real nem um teste integrado
com os emuladores nesta preparação.

Referências: [gatilhos Firestore](https://firebase.google.com/docs/functions/firestore-events),
[envio de e-mail](https://resend.com/docs/api-reference/emails/send-email) e
[idempotência do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).
