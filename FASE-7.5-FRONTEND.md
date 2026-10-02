# Fase 7.5 - Preparacao local Frontend -> Function

Nenhum deploy, configuracao remota, chamada Gemini ou acesso Firebase real foi
executado nesta etapa. As suites usam mocks locais, nao emuladores ou producao.
RAG V1, handler, gateway Gemini, politica CORS e conversation-store.js preservados.

## Fluxo

1. A Home confirma `conversationStore.append()` da mensagem user e recebe o ID.
2. Limpa o input confirmado e rele a conversa para apresentar o user salvo.
3. Importa cliente/configuracao isolados; chama `user.getIdToken()` do Firebase Auth.
4. Envia POST com Authorization Bearer e somente `{ pergunta, conversationId }`.
5. Valida HTTP 2xx e JSON com `resposta` string nao vazia.
6. Rele a conversa do servidor e renderiza as mensagens confirmadas pelo banco.

O cliente nao conhece Firestore, nao grava bot, nao transmite usuarioId e nao usa
o texto HTTP para fabricar uma mensagem. Nao ha geracao de titulo ou retry.
`sending` bloqueia composer, atalhos e novo chat durante o processamento.

## Configuracao do endpoint

Arquivo: `public/Logado/Home/assistente-config.js`.

`endpoint` esta vazio por seguranca: nao ha URL de producao ou fallback inventado.
Preencher futuramente somente com a URL exata confirmada pelo Functions Emulator
ou pelo deploy autorizado. O cliente aceita HTTPS ou HTTP restrito a loopback,
rejeita credenciais, query e fragmento, omite cookies e nao segue redirecionamentos.
O projeto ainda nao declara Functions Emulator em firebase.json, portanto nao
derivamos uma URL/porta automaticamente. Nenhuma configuracao Firebase foi alterada.

`timeoutMs` vale 30000 e inclui obtencao de token, HTTP e leitura JSON.
Abort/timeout nao garantem cancelar processamento ou escrita ja iniciados no servidor.

IMPORTANTE: abrir a Home atual no Hosting Emulator nao redireciona automaticamente
Firebase Auth/Firestore para emuladores. A autenticacao/persistencia preexistentes
nao foram modificadas. Nesta fase testamos somente com mocks; nao abrimos a Home
contra servicos reais. Teste ponta a ponta local exige confirmar separadamente o
roteamento de TODOS os servicos para emuladores, nao apenas o endpoint HTTP.

## CORS

Politica restrita da Fase 7.4 inalterada, sem wildcard.
Origens de Hosting Emulator previstas: `http://localhost:5000` e
`http://127.0.0.1:5000`, conforme porta declarada em firebase.json.
Ao usar outro hostname/porta, confirmar e permitir exatamente essa origem.
Origens reais do Hosting e URL da Function devem ser verificadas antes de configurar
`ASSISTENTE_CORS_ORIGINS` ou realizar deploy. Nenhuma variavel/secret remota foi
configurada. A disponibilidade de GEMINI_API_KEY no emulador tambem fica pendente,
sem leitura ou configuracao de segredo nesta etapa.

## Falhas e concorrencia

Se append falhar, input permanece para conferencia. Se append confirmar e qualquer
etapa seguinte falhar, a pergunta continua salva, input fica vazio e a interface
avisa que nao foi possivel confirmar a resposta; orienta conferir o historico ou
recarregar antes de reenviar e iniciar novo chat se a conversa tiver sido excluida.
Nao ha exclusao, append adicional ou retry automatico. Composer e novo chat sao
liberados quando a sessao/historico ainda permitem envio.

Troca/perda de sessao aborta a requisicao local, impede iniciar HTTP com token
obtido tardiamente e descarta conclusoes da sessao antiga. UID continua exclusivo
do token no servidor. Uma requisicao ja recebida pode concluir na conta original.
Erros HTTP, JSON, contrato, token, rede e timeout nao exibem detalhes remotos.

Sem requestId/messageId: reenvio manual pode gerar outra pergunta/resposta; duas
abas podem intercalar mensagens; conclusoes podem chegar fora de ordem; bot pode
ter sido salvo mesmo se o HTTP falhar. Releitura confirma estado, mas nao prova
correlacao exata entre pergunta e bot. Nenhum schema foi alterado nesta fase.

## Validacao offline

Executar na raiz do projeto:

```powershell
node --test tests/assistente-client.test.mjs tests/home-assistente.test.mjs tests/assistente-producao.test.mjs tests/assistente-handler.test.mjs tests/rag-v1-paridade.test.mjs tests/admin-routing.test.mjs tests/avisos-access.test.mjs tests/avisos-admin.test.mjs
npm --prefix functions run lint
npm --prefix functions run build
git diff --check
git status --short
```

O teste de Rules requer emulador e fica fora desta bateria puramente offline.
Os testes de paridade leem apenas o modulo RAG original, sem executar seu backend.

## Bloqueio preexistente do predeploy

Somente CRLF de functions/src/index.ts foi convertido para LF, sem mudanca logica.
Build passa. Lint global ainda falha exclusivamente em functions/.eslintrc.js:
34 erros linebreak-style (linhas 1-34) e dois quote-props (linhas 30 e 32).
Nao corrigimos esse arquivo ou outros problemas preexistentes. Portanto o
predeploy global ainda nao esta desbloqueado; requer autorizacao futura especifica.
