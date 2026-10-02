# Fase 7.6.1 - End-to-end local aprovado

## Resultado

Executado com Temurin 21.0.12.1 e Firebase CLI 15.28.1, em tcc-ia-d8891,
banco (default), exclusivamente emulado. Java foi selecionado somente no processo;
nenhuma configuracao global Windows foi alterada. O PATH inicial do Codex ainda
apontava para Java 8. Nao reinstalamos Java nem instalamos dependencias npm.
Binarios oficiais dos emuladores foram disponibilizados pelo downloader do CLI.

Portas confirmadas no Emulator Hub e na inicializacao:
Auth 9099, Firestore 8080, Functions 5001, Hosting 5000, UI 4000.
Hub/logging/websocket tambem usam portas auxiliares locais 4400/4500/9150.
Nenhum processo preexistente foi encerrado. O runner encerra sua propria arvore
de emuladores e navegador depois da verificacao; os dados emulados sao efemeros.

URL confirmada no log do Functions Emulator e utilizada no POST:
http://127.0.0.1:5001/tcc-ia-d8891/southamerica-east1/perguntarAssistente

## Separacao de producao

Arquivos novos exclusivamente administrativos/de teste:

- local-e2e/prepare.mjs: gera .cache/local-e2e, ja ignorado pelo Git existente.
- local-e2e/bootstrap.js: ativa ambos os emuladores antes de autenticar/importar Home.
- local-e2e/function.cjs: exporta somente o endpoint mock da copia local.
- local-e2e/network-guard.cjs: bloqueia rede Node externa ao loopback.
- local-e2e/run.mjs: inicia, valida, testa com Playwright e encerra seus processos.
- tests/local-e2e-isolation.test.mjs: cinco testes novos de isolamento.

Nenhum arquivo existente de public/, functions/src/, Rules, firebase.json,
.firebaserc, conversation-store ou RAG foi alterado nesta fase.
Hosting normal continua servindo public/, nao o staging. O endpoint normal continua
vazio. HTML/CSS sao copiados automaticamente para staging, sem alterar originais.
Somente a copia HTML troca o carregamento da Home pelo bootstrap local.
A URL local e escrita na configuracao da copia somente apos confirmacao do CLI.

Bootstrap exige origem exata http://127.0.0.1:5000. Inicializa a app Web de teste,
conecta Auth 9099 e Firestore 8080 antes de qualquer operacao, usa persistencia
em memoria e signInAnonymously no Auth Emulator. A Home real e carregada depois.
O SDK e obtido do CDN estatico gstatic na mesma versao 10.12.5 existente no projeto.

O harness exige marcador local e caminho de staging. Antes de inicializar Admin,
valida GCLOUD_PROJECT e ambos os *_EMULATOR_HOST. Usa app Admin nomeada, gerador
deterministico e o mesmo handler/adapter/RAG V1 compilados, sem importar index.js,
gemini.js, defineSecret ou SDK GenAI. HOME/configuracao do CLI ficam isolados;
GOOGLE_APPLICATION_CREDENTIALS aponta a arquivo inexistente. Variaveis de chaves
e FIREBASE_TOKEN nao sao repassadas. Nao carregamos credencial ou segredo real.

NODE_OPTIONS propaga o bloqueio de rede ao CLI e aos workers; a descoberta usa
uma whitelist de ambiente, portanto o marcador/preload tambem sao fornecidos por
.env.local gerado apenas no staging. Nenhum .env do projeto foi lido ou alterado.
O downloader separado permite somente os caminhos oficiais de binarios Firestore/UI
em storage.googleapis.com; o processo de teste nao tem essa excecao.
Tentativas do CLI de obter configuracao remota do projeto foram bloqueadas e
geraram avisos esperados. Nenhuma API Firebase/Gemini de producao foi acessada.

No navegador, CSP local e roteamento Playwright impedem acesso externo a APIs.
Permitidos apenas loopback e modulos estaticos Firebase 10.12.5 do gstatic.
Uma tentativa preexistente de stylesheet Google Fonts foi abortada antes da rede;
HTML/CSS originais foram preservados, com fonte alternativa no teste.

## Evidencias efetivas do ultimo cenario aprovado

- Conta anonima ficticia: UID zWIiPeL92LJ1AyKhptSXjUFajEHf, sem senha.
- Perfil minimo criado pela Home real em users/{uid}, usando a logica existente.
- Dois chunks locais: conhecimento/teste-ativo e conhecimento/teste-inativo.
- Schema ficticio: documentoId documento-ficticio, versaoDocumento teste-local,
  tipoConteudo procedimento, titulo/categoria/termosBusca de matricula e pagina 1.
- Ativo: conteudo com MARCADOR_ATIVO_MATRICULA, ativo=true.
- Inativo: conteudo com MARCADOR_INATIVO_PROIBIDO, ativo=false.
- Conversa Lwz1brsmcmDtRKgZzEFw, com ID gerado por conversationStore.append().
- POST unico, HTTP 200; body tem somente pergunta e conversationId; Bearer presente,
  token nao registrado. Firebase Admin validou o token emitido pelo Auth Emulator.
- Handler leu a conversa emulada, executou RAG V1 e chamou o mock uma vez.
- ativoNoContexto=true; inativoNoContexto=false, conferidos no prompt recebido.
- Firestore local e bolhas da Home confirmaram exatamente duas mensagens:
  user: Como faco minha matricula? (texto real conserva os acentos).
  bot: Resposta local de teste baseada no contexto recuperado.
- Nenhum erro JavaScript; composer voltou a ficar disponivel.

Auditoria de requests do navegador: Hosting local 10, Function local 1,
Firestore local 12, Auth local 2, SDKs gstatic 3, Google Fonts bloqueado 1.
Zero chamadas Gemini. Zero leitura/escrita Auth ou Firestore de producao.
Os 514 chunks reais nao foram consultados, copiados ou modificados.
Busca nos logs locais nao encontrou API keys ou JWTs completos.

Arquivos de evidencia ignorados pelo Git:
.cache/local-e2e/result.json (ultimo sucesso), function-evidence.json e home-e2e.png.
failure.json e emulators-sanitized.log registram tentativas anteriores, nao o
resultado final. Nao contem tokens completos ou segredos. A captura de tela foi
inspecionada e mostra as duas mensagens e status 'Conversa atualizada.'.

## Diagnosticos corrigidos apenas no harness

1. Caminho Windows no NODE_OPTIONS: barras normalizadas para o parser do Node.
2. Whitelist do CLI na descoberta: marcador/preload via .env.local do staging.
3. Hosts nao disponiveis na descoberta: verificacao e inicializacao Admin lazy.
4. Credencial artesanal rejeitada por Firestore Admin: app nomeada com projeto
   explicito e inicializacao emulada suportada, sob guardas e isolamento de ADC.
5. Auditoria distingue Google Fonts bloqueado de destino externo inesperado,
   sem permitir o request ou mudar HTML/CSS para esconder a ocorrencia.

## Reproducao e validacao

Na raiz, depois de confirmar portas livres, Java e caminhos locais do runner:

```powershell
npm --prefix functions run lint
npm --prefix functions run build
node local-e2e/run.mjs
node --test tests/local-e2e-isolation.test.mjs tests/predeploy-local.test.mjs tests/assistente-client.test.mjs tests/home-assistente.test.mjs tests/assistente-producao.test.mjs tests/assistente-handler.test.mjs tests/rag-v1-paridade.test.mjs tests/admin-routing.test.mjs tests/avisos-access.test.mjs tests/avisos-admin.test.mjs
git diff --check
git status --short
```

122 testes offline aprovados, zero falhos; mais um cenario E2E real com emuladores
e navegador aprovado separadamente. Lint/build passam. Nenhuma suite anterior
foi enfraquecida. O teste antigo de Rules usa outro projeto/portas, portanto nao
foi executado nesta fase, que exige exclusivamente tcc-ia-d8891.

Limitacoes: teste cobre conta anonima, um envio e gerador mock, nao Gemini real,
OAuth Google, concorrencia, idempotencia ou qualidade da base oficial. Caminhos
de JDK/CLI/Playwright/Edge sao especificos desta maquina; guardas de rede sao
de desenvolvimento, nao um sandbox de seguranca para codigo arbitrario.
Sem deploy, commit/push, configuracao remota ou alteracao de sylvinho-backend.
