# Preparação local da demonstração online

Base: c9c39615ed013169be3260be8ad7fe2f6d608ce4. Nenhum comando online foi executado nesta etapa.

## Importador específico

Executar na raiz, com Node 24 e dependências existentes em functions/node_modules.
Simulação padrão, sem SDK, credencial ou consulta online:

    node demo-academica/importar-fixtures.mjs --project tcc-ia-d8891 --database "(default)"

O relatório informa remotoVerificado=false: simulação offline não comprova ausência de colisões.
Manifesto completo possui SHA-256 fixado no importador; alterações exigem revisão explícita.
Somente três IDs são aceitos. Nenhum outro documento é lido, modificado ou excluído.
Modo conectado (--check-existing) lê apenas os três IDs, fecha o cliente e não grava.
Gravação exige --apply e --confirm "CRIAR_3_FIXTURES:tcc-ia-d8891:(default)".
Também exige --credentials-file com arquivo externo ao repositório de uma identidade operacional autorizada do projeto.
Não criar credenciais nem executar esses modos online sem autorização separada.
O backend de runtime não precisa receber permissão de criação para executar essa importação.
Não usar a sessão pessoal da CLI, ADC implícita ou uma chave incluída no repositório.

Primeiro verifica projeto e banco, manifesto e confirmação, depois o destino efetivo do cliente.
Consulta os três IDs antes de escrever. Qualquer documento existente aborta integralmente.
Um único batch.create com precondições exists=false impede overwrite inclusive em corrida.
Não há retry automático. Erros do CLI são genéricos e não exibem credenciais.
A criação online requer permissões de criação e leitura para o operador, previamente autorizadas.

## Testes locais

    node --test tests/importador-fixtures.test.mjs tests/conteudo-demo-publicacao.test.mjs
    node local-e2e/importador-run.mjs
    node local-e2e/auth-run.mjs --documental --academica

Runner separado testa somente Firestore Emulator em 127.0.0.1:8180 e demo-sylvinho-render-poc.
Requer Java 21, CLI existente e artefato oficial em cache; não baixa nem instala dependências.
Se necessário, SYLVINHO_EMULATOR_CACHE indica cache já existente.
O teste emulado cria dados efêmeros apenas nesse projeto demo. Rede externa é bloqueada.

## Endpoint

Não foi confirmada uma URL real do Render por fonte confiável acessível nesta etapa.
Endpoint online continua vazio. Token Firebase, messageId, recuperação e timeout de 120s foram preservados.
Após autorização e confirmação do painel, configurar URL HTTPS real terminando em /perguntarAssistente.
Não basta confirmar /health: testar token, CORS, fixture, resposta e histórico.

## Conteúdo das páginas

- public/index.html: aviso acadêmico na entrada real e descrição de protótipo.
- public/Logado/Avisos/avisos.html: data-demo-academica=true seleciona aviso fictício local.
- public/Logado/Avisos/avisos.js: interrompe antes de carregar SDK/consultar avisos/admin; modo habitual preservado sem o atributo.
- public/Logado/Serviços/servicos.html: troca alegações de WhatsApp/24h por chat web e limitações; não carrega servicos.js.
- public/Pagina-Inicial/pagina-in.html: remove promessas de dados oficiais atualizados e disponibilidade contínua.
- public/Sobre/sobre.html: mantém cartões da equipe, sem expor nomes/contatos pessoais nesta versão demonstrativa.

Nenhum aviso ou outro documento existente foi alterado no Firestore.
Os módulos de avisos administrativos, serviços e e-mail continuam preservados no repositório.
A indicação acadêmica não é autorização da escola. Termos/privacidade ainda exigem revisão antes de abrir cadastro público.
Credencial, IAM efetivo, Auth, domínios, CORS, versão implantada, regras e Hosting continuam pendentes de confirmação online.
Secret File pode disparar deploy; tratar essa operação em janela autorizada, mesmo com Auto-Deploy desligado.
