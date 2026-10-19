# Demonstração acadêmica local

Demonstração acadêmica — dados fictícios — não é atendimento oficial da escola.

Base: 7df68fcbbc3e590d9a6954dbdf0c482aefa86aaa. Nenhuma publicação faz parte desta etapa.

## Fixtures e isolamento
fixtures.json contém três documentos inventados. Não é uma base institucional.
Não existe script de importação online. E2Es carregam cópias efêmeras somente no Firestore Emulator.
SYLVINHO_DEMO_ACADEMICA=true ativa a seleção fechada no Render, somente em modo documental ou documental-emulator.
São feitas leituras individuais dos IDs do manifesto; nenhuma consulta geral.
Conteúdo e metadados devem corresponder ao manifesto. Ausentes, inativos ou alterados são excluídos.
Sem evidência, o gerador retorna insuficiência; não há fallback geral.
Sem a flag, o comportamento anterior permanece preservado. Health continua sendo o padrão.

## Frontend
O endpoint publicado permanece vazio e o timeout publicado está preparado para 120 segundos.
Após autorização futura, preencher somente a URL HTTPS confirmada terminando em /perguntarAssistente.
O demo emulado continua usando o endpoint local e timeout de 30 segundos.
Nenhum segredo ou credencial deve ser colocado no frontend.

## Validação emulada
Node 24, Java 21, Firebase CLI 15.33/15.34, dependências locais de functions e Playwright/Edge existentes.
Compilar: npm --prefix functions run build
Executar: node local-e2e/auth-run.mjs --documental
Executar seleção acadêmica: node local-e2e/auth-run.mjs --documental --academica
Se necessário, SYLVINHO_EMULATOR_CACHE aponta para um cache local existente.

## Publicação futura, não autorizada
Confirmar endpoint real, CORS, conta dedicada, IAM e Secret File sem expor credenciais.
Ativação documental e importação online das fixtures exigem autorização específica.
Publicar regras e Hosting em janela coordenada; preservar avisos/e-mail e não implantar Functions no Spark.
Validar duas contas fictícias, isolamento documental, insuficiência, messageId, exclusão e recuperação.

## Arquivos desta etapa

- `demo-academica/README.md`
- `demo-academica/fixtures.json`
- `functions/src/assistente/handler.ts`
- `local-e2e/auth-run.mjs`
- `local-e2e/documental-scenarios.mjs`
- `local-e2e/function.cjs`
- `local-e2e/prepare-history.mjs`
- `public/Arquivos-Universais/theme.css`
- `public/Criar-Conta/cadastro.html`
- `public/Logado/Avisos/avisos.html`
- `public/Logado/Configurações Administrador/configAdmin.html`
- `public/Logado/Configurações Aluno/configAl.html`
- `public/Logado/Conversas/conversas.html`
- `public/Logado/Home/assistente-config.js`
- `public/Logado/Home/home.html`
- `public/Logado/Serviços/servicos.html`
- `public/Login/login.html`
- `public/Pagina-Inicial/pagina-in.html`
- `public/Sobre/sobre.html`
- `render-poc/config.cjs`
- `render-poc/demonstracao.cjs`
- `render-poc/dependencias.cjs`
- `render-poc/documental.cjs`
- `render-poc/producao.cjs`
- `tests/demo-academica.test.mjs`
- `tests/home-assistente.test.mjs`
- `tests/predeploy-local.test.mjs`

O teste legado de paridade RAG depende de referência externa em D: e não foi executado nem substituído.
Credenciais, importação online, URLs publicadas e implantação continuam pendentes de autorização.
