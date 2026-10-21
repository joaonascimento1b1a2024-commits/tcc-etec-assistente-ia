# Validacao local com os documentos originais

Executar na raiz do worktree isolado:

```powershell
npm.cmd --prefix functions run lint
npm.cmd --prefix functions run build
node local-e2e/auth-run.mjs --documental --original
```

Requer Node 24, Java 21, Firebase CLI 15.33/15.34, Microsoft Edge e Playwright ja
instalados. O runner descobre as ferramentas; nao instala pacotes nem altera PATH
permanente. Requer o JAR local do Firestore 1.22.0 e portas livres 5000, 5001, 8080,
9099, 4400, 4500 e 9150. O perfil de CLI e isolado e a rede do backend aceita apenas
loopback. O navegador utiliza somente os SDKs Firebase do CDN, alem dos emuladores.

O snapshot integral `.cache/rag-original-auditoria.json` deve conter os 514 chunks
originais. O leitor verifica SHA-256 fixado, IDs unicos, atividade e as tres fontes
aprovadas. Se faltar ou divergir, interrompe: nao consulta producao, nao reimporta e
nao utiliza as fixtures academicas nem a amostra reduzida como fallback.

Auth, Firestore (usuarios e conversas), Functions e Hosting sao emulados no projeto
`demo-sylvinho-render-poc`. A recuperacao documental usa o snapshot em memoria:
nao ha gravacoes na colecao conhecimento. A Function usa o handler, RAG e gerador
compilados dos Lotes 1 e 2. Isto nao valida o processo publicado no Render.

A copia servida em `.cache/local-e2e/public` recebe aviso de documentos de referencia
e continua informando que nao e atendimento oficial. `public/`, endpoints e demais
configuracoes de publicacao ficam intactos. Nao publicar o staging nem seu bootstrap.

O runner encerra os processos que iniciou. Evidencias ficam em `.cache/local-e2e`:

- `auth-result.json`: sucesso, cenarios, erros de pagina, origens e isolamento.
- `function-evidence.json`: token validado, fontes, status e quantidade de geracoes.
- `layout-*.png`: Home, Conversas e Configuracoes em 1280 e 390 pixels.
- `auth-emulators-sanitized.log`: log filtrado do emulador.

Validado no Edge: cadastro/login/logout e restauracao, sete perguntas obrigatorias,
respostas visiveis, persistencia/reabertura/reload sem duplicacao, recuperacao com
mesmo messageId, falha de backend, exclusao entre abas e isolamento bidirecional.
Nao ha Gemini. Os tokens e contas usados pelo teste sao exclusivos do emulador.

Para repetir as verificacoes do leitor local:

```powershell
node --test tests/original-e2e-isolation.test.mjs
```

O site remoto nao e consultado nem alterado. A futura ativacao online depende de
revisao/versionamento autorizados, ajuste definitivo dos avisos de demonstracao,
credenciais/identidade e permissoes do backend Render, CORS, endpoint, publicacao e
validacao online separados. O snapshot ignorado nao acompanha automaticamente o Git;
nao copiar credenciais para suprir sua ausencia.
