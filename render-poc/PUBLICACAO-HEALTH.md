# Primeira publicação — somente GET /health

Sprint 14. Não executar commit, push ou implantação sem autorização posterior.
O modo `health` responde 200 apenas a GET `/health`; outros caminhos e métodos retornam 404,
antes de ler corpo, autenticar ou inicializar dependências. Não precisa de chave, Secret File,
conta de serviço, acesso ao Firestore ou Gemini. Os demais modos continuam preservados.

## Seleção para commit

A lista exata de arquivos alterados/novos recomendados está no array `commitFiles` de
[commit-health.json](commit-health.json). Não usar `git add .`. Os cinco `existingPrerequisites`
já existem no HEAD e permanecem sem alteração; não são novas inclusões necessárias.
Arquivos fora da lista continuam preservados no projeto, sem descarte ou inclusão automática.
O backend documental é incluído apenas como dependência de compilação/importação do servidor
existente, permanecendo desconectado no modo health. O módulo Gemini legado já rastreado
continua compilável, porém não é importado pelo processo Node. Não enviar dados institucionais.

Para verificar a seleção, sem operações de escrita no Git:

```powershell
node scripts/verificar-segredos.mjs
node scripts/verificar-selecao-render.mjs
node --test tests/gitignore-publicacao.test.mjs
```

O verificador cria somente uma pasta nova em `.cache/`, copia os arquivos listados, compara
pré-requisitos com HEAD por leitura e compila/testa essa seleção. Usa uma junction para as
dependências já instaladas em `functions/node_modules`; não instala pacotes. O relatório contém
hashes SHA-256. Confirma integridade local da seleção, não uma instalação limpa no Linux do Render.

Manter fora deste commit: `knowledge-base/**`, mudanças de frontend, regras e runners de demo,
datasets fictícios, .env reais, chaves, backups, dependências, caches e compilados. Testes unitários
contêm somente sentinelas de teste, não uma base de demonstração. Os arquivos desses outros
trabalhos permanecem disponíveis para uma revisão futura específica.

As exclusões do `.gitignore` não removem arquivos já rastreados e não certificam histórico remoto.
O verificador de segredos é heurístico. Se surgir credencial rastreada, interromper e tratar o
incidente antes de qualquer sincronização; não remover do índice ou reescrever histórico automaticamente.

## Render, após a publicação autorizada da revisão validada

Repositório configurado: `joaonascimento1b1a2024-commits/tcc-etec-assistente-ia`, branch `main`.
Confirmar o hash real remoto antes de publicar; `origin/main` local pode estar desatualizado.
Se a consulta anônima for recusada, não usar credenciais sem autorização. Não fazer fetch/pull
ou resolver divergências automaticamente.

1. Autorizar separadamente seleção, commit e push; revisar o diff e confirmar o hash remoto.
2. No Render, New → Web Service, selecionar o repositório e a revisão validada de `main`.
3. Escolher Free, raiz vazia, Auto-Deploy Off e preencher os campos abaixo.
4. Não adicionar Secret File, credenciais Firebase, variáveis de emuladores ou ativação documental.
5. A criação inicia o primeiro build/deploy: requer autorização explícita. Se pedir cartão ou plano
   pago, interromper. Não habilitar Blaze.
6. Com a URL real fornecida, validar GET `/health` 200 e POST `/health`, GET/POST/OPTIONS
   `/perguntarAssistente` 404. Não conectar a Home ao backend nesta etapa.

| Campo | Valor |
| --- | --- |
| Build | `npm --prefix functions ci --include=dev && npm --prefix functions run build` |
| Start | `node render-poc/server.cjs` |
| Health Check | `/health` |
| NODE_VERSION | `24.22.0` |
| NODE_ENV | `production` |
| SYLVINHO_POC_MODE | `health` |
| ASSISTENTE_CORS_ORIGINS | omitir ou vazio |

Render fornece `PORT` e `RENDER=true`; servidor usa `0.0.0.0`. Não chamar `npm start` de
`functions`, que abre o shell Firebase. Não executar script de deploy nem importar documentos.
O Render Free pode suspender após inatividade; esta etapa comprova somente disponibilidade HTTP.

Fontes operacionais: [Web Services](https://render.com/docs/web-services),
[Free](https://render.com/docs/free), [deploy manual](https://render.com/docs/deploys).

## Integração isolada com origin/main

Branch `codex/render-health`, base `438b50f0e5c4ed44563fd525d64d160f90bb2b4c`.
Os 27 arquivos iniciais foram integrados. A seleção passou a 31 arquivos: template Functions
combinado, dois testes de entrypoint/avisos atualizados e `.gitattributes` para LF no backend.
Os módulos de avisos/e-mail e demais alterações dos colegas permanecem na base remota.
Gemini permanece desconectado do entrypoint; RESEND_API_KEY pertence somente ao worker de avisos.
O servidor Render health não importa esse entrypoint nem acessa Resend, Firebase ou secrets.
