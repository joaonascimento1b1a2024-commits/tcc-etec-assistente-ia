# Chat sem login

O botão **Ver como funciona** da Landing Page abre `public/Chat/chat.html`.
A página aguarda a restauração da sessão do Firebase: uma conta conectada segue
para `Logado/Home/home.html`; sem sessão, o visitante fica no chat temporário.
Um login antigo seguido de logout não conta como sessão ativa.

As mensagens existem somente no DOM. Novo chat, recarregamento e saída da
página descartam a conversa e cancelam pedidos pendentes, inclusive ao usar o
cache de voltar/avançar do navegador. Não há conta anônima, histórico no
Firestore ou mensagens em localStorage/sessionStorage.

## Servidor

`POST /perguntarVisitante` recebe apenas `{ "pergunta": "..." }` (até 700
caracteres) e devolve `{ "resposta": "..." }`. A rota é independente de
`/perguntarAssistente`, que continua exigindo autenticação e histórico.

A rota pública consulta a base documental existente sem ler nem gravar
conversas. No Render usa o gerador existente sem UID, preservando sua resposta
documental e a restrição de geração externa a usuários autorizados. Não habilita
Gemini/OpenAI para visitantes nem encaminha perguntas a esses provedores.

CORS usa a lista existente de origens. Respostas usam `Cache-Control: no-store`.
Há limites em memória de 30 pedidos por minuto e quatro pedidos simultâneos
por instância; não são limites globais entre instâncias. Os contadores não
armazenam perguntas, respostas ou IPs.

## Publicação e teste

É necessário publicar **backend e frontend** para a funcionalidade ficar
disponível online. No ambiente atual o frontend usa o Render; publique o
backend com a nova rota antes do Firebase Hosting. A alternativa de Cloud
Functions também exporta `perguntarVisitante`. Esta alteração não faz deploy.

Preview em localhost sem emuladores permite inspecionar a tela, mas mantém a
API de produção desabilitada. Os testes usam dependências e sessões simuladas:

```powershell
npm --prefix functions run build
node --test tests/chat-visitante.test.mjs tests/session-navigation.test.mjs tests/home-assistente.test.mjs
```
