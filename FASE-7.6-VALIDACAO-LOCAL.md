# Fase 7.6 - Predeploy desbloqueado; end-to-end bloqueado

## Resultado efetivo

- Corrigidos somente LF e aspas de quotes/indent em functions/.eslintrc.js.
- A configuracao ESLint resultante e semanticamente identica a do HEAD.
- Lint e build equivalentes ao predeploy passam.
- Nenhum emulador foi iniciado, nenhum usuario/conversa/chunk foi criado.
- End-to-end com Auth/Firestore/Functions/Hosting reais emulados NAO executado.
- Nenhuma chamada Firebase/Gemini de producao, deploy, secret, ingestao ou commit.

Bloqueio confirmado: Java selecionado pelo PATH e 1.8.0_401. Firebase CLI 15.28.1
esta instalado em AppData/Roaming/npm/node_modules/firebase-tools, mas nao possui
comando firebase disponivel no PATH desta sessao. O CLI pode ser chamado pelo seu
entrypoint lib/bin/firebase.js; nao o executamos nesta fase. Seu codigo instalado
lib/emulator/commandUtils.js define MIN_SUPPORTED_JAVA_MAJOR_VERSION = 21, e
controller.js verifica essa constante antes de iniciar emuladores Java.
Precisamos disponibilizar JDK 21+ e confirmar java/JAVA_HOME antes de prosseguir.
Nao instalamos Java, CLI, SDK, dependencias ou binarios de emulador.
O cache padrao consultado contem apenas a UI, nao o binario Firestore.

## Portas e URL esperadas, nao portas de processos iniciados

firebase.json permanece intacto:

| Servico | Porta | Origem |
| --- | --- | --- |
| Auth | 9099 | Configuracao existente |
| Firestore | 8080 | Configuracao existente |
| Functions | 5001 | Padrao documentado, nao declarado |
| Hosting | 5000 | Configuracao existente |
| UI | 4000 | Configuracao existente |

Nao e indispensavel alterar firebase.json para declarar a porta padrao Functions.
Uma configuracao separada sera necessaria para apontar o emulador a um entrypoint
mock, sem carregar functions/lib/index.js e seus parametros/segredo reais.
A porta efetivamente utilizada deve ser confirmada nos logs/Hub ao iniciar a suite;
se estiver indisponivel, parar ou atualizar apenas a configuracao local explicita.

URL esperada com o projeto/regiao atuais e a porta padrao:
http://127.0.0.1:5001/tcc-ia-d8891/southamerica-east1/perguntarAssistente

Nao foi configurada em assistente-config.js: endpoint continua vazio. Usar o ID
do projeto real no emulador exige impedir qualquer fallback de produto nao emulado.
Uma variante demo oferece isolamento adicional, mas nao substituimos o ID pedido.

## O que falta no frontend para isolamento seguro

Nao basta abrir a Home pelo Hosting Emulator. Firebase Web SDK continua usando
a configuracao existente de tcc-ia-d8891. Nenhuma pagina foi aberta contra ela.

Implementacao local futura deve conectar ambos os SDKs antes de qualquer operacao:

- Login/login.js: logo depois de getAuth(app), antes de observar sessao/signIn,
  executar connectAuthEmulator(auth, 'http://127.0.0.1:9099').
- Home/home.js: antes de onAuthStateChanged, configurar Auth local. Antes de
  verificarAdministrador, setDoc de perfil e createConversationStore, conectar
  o mesmo getFirestore(app) com connectFirestoreEmulator(db, '127.0.0.1', 8080).
- Logado/acesso.js consulta cargo via getFirestore(getApp()); deve receber a
  instancia ja conectada, sem uma primeira leitura anterior ao isolamento.
- conversation-store.js nao precisa mudar: recebe o app com banco ja conectado.
- Outras paginas devem ter o mesmo isolamento se forem usadas no cenario local.

Preferencia: bootstrap/entrypoint exclusivo de desenvolvimento, servido somente
por harness local, com app/sessao separados dos persistidos em producao. Ativacao
exige origem loopback exata, modo local explicito e confirmacao da suite; nao usar
apenas querystring/localStorage ou ativar automaticamente por qualquer hostname.
Falhar fechado quando emuladores estiverem ausentes, sem fallback para producao.
Somente depois disso habilitar a URL local no cliente nessa variante local.
Nenhum redirecionamento de Auth/Firestore ou configuracao de URL foi implementado
enquanto o pre-requisito de Java impede validar essa separacao.

## Entrypoint local e gerador planejados, nao implementados/executados

Criar harness separado do bundle de producao que reutilize criarEndpointAssistente
e perguntarAssistenteHandler compilados, sem importar index.js ou gemini.js.
Injetar gerarResposta deterministico, por exemplo 'Resposta ficticia: matricula
local na secretaria simulada', e conferir que recebeu contexto RAG ficticio.
Nao usar defineSecret, chave falsa, SDK Gemini ou fallback ao gerador real.

Antes de inicializar Admin, exigir explicitamente:

- FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
- FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
- projeto tcc-ia-d8891 e banco (default) somente emulados
- CORS apenas http://localhost:5000 e http://127.0.0.1:5000

Esses valores sao plano, nao configuracoes aplicadas. Ausencia/divergencia deve
encerrar antes de initializeApp/qualquer acesso. Nao carregar ADC ou secrets.
Admin verifica o token emitido pelo Auth Emulator usando sua configuracao local.
O cliente entra com conta local sintetica; nunca reutilizar token/sessao de producao.

## Conhecimento ficticio planejado

Nao copiamos os 514 chunks. Fixture minima, exclusivamente no banco emulado:

- conhecimento/teste-matricula: documentoId='documento-ficticio', ativo=true,
  tipoConteudo='procedimento', titulo='Matricula local ficticia',
  categoria='matricula', termosBusca=['matricula'], secao='Teste local',
  paginaInicial=1, paginaFinal=1,
  conteudo='No cenario ficticio, a matricula ocorre na secretaria simulada.'
- conhecimento/teste-inativo: mesmo tema, ativo=false, para confirmar o filtro V1.

Nenhuma fixture foi persistida. Cenario futuro deve verificar: user salvo uma vez,
token local validado, chunk ativo recuperado, inativo ignorado, gerador mock chamado
uma vez, bot salvo somente pelo handler, releitura Home com exatamente user + bot.
Rules reais do repositorio preservadas, sem permissao extra para facilitar teste.

## Validacao executavel offline

Na raiz do projeto:

```powershell
npm --prefix functions run lint
npm --prefix functions run build
node --test tests/predeploy-local.test.mjs tests/assistente-client.test.mjs tests/home-assistente.test.mjs tests/assistente-producao.test.mjs tests/assistente-handler.test.mjs tests/rag-v1-paridade.test.mjs tests/admin-routing.test.mjs tests/avisos-access.test.mjs tests/avisos-admin.test.mjs
git diff --check
git status --short
```

As cinco verificacoes novas protegem a equivalencia ESLint, LF, configuracao
Firebase/predeploy, Rules/conversation-store intactos e endpoint ainda vazio.
Nao comprovam um end-to-end com emuladores. O teste admin-rules requer emuladores
e permanece fora desta bateria offline.

## Referencias consultadas

- https://firebase.google.com/docs/emulator-suite/install_and_configure
- https://firebase.google.com/docs/emulator-suite/connect_auth
- https://firebase.google.com/docs/emulator-suite/connect_firestore

A documentacao geral menciona Java 11+, e a do Firestore alerta para Java 21;
o requisito efetivo desta instalacao foi confirmado no codigo local do CLI: 21.
As variaveis *_EMULATOR_HOST nao incluem protocolo e nunca devem ir para producao.
