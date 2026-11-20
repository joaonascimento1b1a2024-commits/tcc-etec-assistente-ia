# Operação e manutenção

Guia prático para publicar, configurar, atualizar a base da IA e preparar a apresentação. Para entender como a IA funciona, veja [RELATORIO-TECNICO-IA.md](RELATORIO-TECNICO-IA.md).

## 1. Onde cada parte roda

| Parte | Serviço | Como publicar |
| --- | --- | --- |
| Site (`public/`) | Firebase Hosting: `sylvinho.web.app` (também `sylvinho.firebaseapp.com` e os domínios `tcc-ia-d8891.*`) | `firebase deploy --only hosting --project tcc-ia-d8891` |
| Servidor da IA (`render-poc/` + `functions/src` compilado + `knowledge-local/`) | Render, serviço `sylvinho-backend-poc` | Push na `main` e, no painel do Render, Manual Deploy → Deploy latest commit |
| Regras do banco (`firestore.rules`) | Firestore | `firebase deploy --only firestore:rules --project tcc-ia-d8891` |
| Avisos por e-mail (`functions/src/index.ts`, `avisos/`) | Cloud Functions + extensão Trigger Email | `firebase deploy --only functions --project tcc-ia-d8891` |

**Conferências depois do deploy do Render:**
- `GET https://sylvinho-backend-poc.onrender.com/health` deve mostrar `"motor":"hibrido"` e `"revisao"` igual ao commit publicado;
- uma pergunta no chat de visitante deve ser respondida.

## 2. Variáveis de ambiente do Render

Os valores ficam só no painel do Render (Environment). Nunca vão para o código, o git ou o chat.

| Variável | Para quê |
| --- | --- |
| `SYLVINHO_POC_MODE=documental`, `SYLVINHO_DOCUMENTAL_ENABLED=true` | Modo de produção do servidor. |
| `SYLVINHO_MOTOR=hibrido` | Base curada primeiro e fluxo documental depois. Os outros valores são `fluxo` e `curado`. |
| `GEMINI_API_KEY` | Chave da Google AI (Gemini). |
| `SYLVINHO_GEMINI_MODEL`, `SYLVINHO_GEMINI_FALLBACK_MODEL` | Modelo principal e lista de reservas separada por vírgula. Cada modelo tem cota própria no plano gratuito; os valores ficam no painel do Render. |
| `SYLVINHO_EMBEDDING_MODEL` | Opcional. O padrão é `gemini-embedding-001`, e ele precisa ser o mesmo do índice. |
| `ASSISTENTE_CORS_ORIGINS` | Domínios oficiais do site, separados por vírgula, sem curinga. |
| `GCLOUD_PROJECT`, `FIRESTORE_DATABASE_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `SYLVINHO_SERVICE_ACCOUNT_EMAIL` | Acesso ao Firestore pela conta de serviço. A credencial é um *secret file* do Render. |
| `SYLVINHO_IA_*`, `OPENROUTER_*`, `OPENAI_*` | Configuração do fluxo documental e dos provedores alternativos. A produção usa o Gemini; o código dos outros provedores foi mantido e é testado. |

## 3. Administradores

O cargo vem só do documento `administradores/{UID}` com `ativo: true`. Campos editáveis do perfil (`users/{UID}`) não dão acesso.

**Primeiro administrador**, pelo console do Firebase:
1. A pessoa cria a conta no site e abre a Home.
2. Em Authentication → Users, copie o **User UID** dela.
3. Em Firestore → Data, crie `administradores/<UID>` com o campo `ativo` (boolean) igual a `true`.

**Promover pelo site:** Configurações do administrador → Promover a administrador. Informe o UID e confirme.

**Revogar:** mude `ativo` para `false` no console.

**O que um administrador pode fazer:** criar, editar e excluir avisos e promover contas. Ele não lê conversas de outras contas, porque as regras do Firestore não permitem.

## 4. Avisos por e-mail

Quando um aviso é criado com `publicado: true`:
1. a Cloud Function `enfileirarNotificacoesAviso` cria uma entrega em `avisosEmails` para cada perfil de `users`;
2. a função `enviarNotificacaoAviso` confere a conta no Authentication e grava a mensagem em `mail`;
3. a extensão **Trigger Email from Firestore** envia o e-mail por SMTP, com a conta `sylvinho582@gmail.com`.

**Requisitos:**
- plano Blaze no Firebase;
- extensão instalada com os parâmetros de `extensions/avisos-email.env.example`;
- **senha de app** do Gmail, informada só no campo secreto do instalador.

Editar ou excluir um aviso não dispara e-mail.

## 5. Base curada da IA

### Acrescentar ou corrigir uma informação

1. Ache a informação numa **fonte oficial**:
   - site da ETEC (`etecmatao.cps.sp.gov.br`);
   - PDFs publicados, como o Regimento e o Calendário;
   - portal do Vestibulinho;
   - avisos da Secretaria no NSA.
2. Em `knowledge-local/faq-curada.json`, crie ou edite a entrada:
   - `id`: letras minúsculas, números e hífens, único;
   - `pergunta` e `variacoes`: formas comuns de perguntar. As variações ficam em minúsculas e sem acento, e uma pergunta igual a uma delas responde na hora, sem o Gemini;
   - `resposta`: frase completa e curta, sem link `http`, sem pergunta e sem dado pessoal;
   - `fonte`: `url` (`https`), `evidencia` (o trecho **literal** que comprova), `sha256` (hash desse trecho) e `formaConferencia`;
   - `vigencia.fim`, se a informação vence, como datas de um processo seletivo;
   - `aplicaSe.cursos`, se vale só para alguns cursos;
   - ao corrigir, aumente `versao`.
3. Se for um contato novo (telefone ou e-mail), ele também precisa estar em `contatos-publicos.json` e na lista `permitidos` de `criarFiltroContatos` (`render-poc/motor-curado/curadoria-local.mjs`).
4. Rode `npm run indexar`.
5. Rode `npm test`. O teste "base versionada" confirma que o índice corresponde à base.
6. Publique (seção 1).

**Hash do trecho**, para o campo `sha256`:
```sh
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "trecho literal"
```

### Reindexar (`npm run indexar`)

- Gera o vetor de cada entrada (Gemini Embedding) e grava `knowledge-local/embeddings-curados.json` com o hash da base.
- A chave vem de `GEMINI_API_KEY` ou de `../sylvinho-backend/functions/.env`, e nunca é impressa.
- **Cota gratuita:** 1.000 embeddings por dia, e cada entrada conta 1. O script manda lotes de 5 com pausa e guarda o progresso em `.cache/embeddings-parciais.json`. Se a cota acabar, rode de novo mais tarde, e ele continua de onde parou.
- Se o servidor for publicado com o índice desatualizado, a busca semântica é desligada e só a busca por palavras funciona. Por isso, **não publique sem reindexar**.

### Pendências e divergências conhecidas

| Assunto | Situação |
| --- | --- |
| Gratuidade do curso, bolsa, merenda, entrada atrasada, calendário de 2027 | Sem fonte oficial na base. O Sylvinho indica a Secretaria. O cardápio do NSA está vazio. |
| Telefone | Base: (16) 3382-6878, da página de contato. O portal do Vestibulinho e o aviso do NSA trazem (16) 3383-9200, e o Regimento traz (16) 3382-1226. |
| Técnico em Mecânica | O site diz "três módulos" e cita um módulo IV, então ficou fora da resposta sobre duração. |
| Coordenadores de curso | A lista do site é de 2024. Entraram só o coordenador pedagógico e o orientador. |
| Horários por turma e infraestrutura | Os dados publicados são de 2024. As respostas mandam confirmar com a Secretaria. |
| Revisão humana | As entradas foram conferidas com as fontes, mas não confirmadas formalmente pela Secretaria. |
| Fontes do NSA | Exigem login, então quem não é aluno não consegue abrir o link. |

## 6. Avaliação do modo híbrido

```sh
npm run avaliar sem-gemini   # local; Gemini simulado fora do ar: o que responde mesmo sem ele
npm run avaliar local        # local; Gemini real (chave local)
npm run avaliar producao     # chat de visitante publicado; retoma de onde parou
```

- As perguntas ficam em `scripts/perguntas-avaliacao.json` e os resultados em `.cache/avaliacao-<modo>.json`.
- Cada pergunta que não é exata gasta 1 embedding e até 2 chamadas de geração. Não rode avaliações em massa no dia da apresentação.
- Para testar em produção com acentos, use esses scripts (Node). O `curl` do Git Bash no Windows estraga os acentos.

## 7. Checklist do dia da banca

1. **Na véspera:** publicar, rodar `npm run avaliar producao` uma vez e conferir as respostas.
2. **No dia, não rodar avaliações:** a cota diária do Gemini precisa sobrar para a apresentação.
3. **10 minutos antes:** abrir o site e mandar "Oi" no chat. O Render gratuito desliga o servidor sem uso, e a primeira resposta depois disso pode levar de 20 a 50 s.
4. **Começar pelas perguntas que respondem com texto aprovado**, que são instantâneas e não dependem do Gemini:
   - "Quem é você?";
   - "Como funciona o Vestibulinho?";
   - "Quantas faltas posso ter?";
   - "Qual o horário da Secretaria?";
   - "Como faço para renovar minha matrícula?";
   - "Posso trancar a matrícula?";
   - "Tem curso à noite?";
   - "Quais cursos a ETEC oferece?";
   - "O que acontece se eu reprovar?";
   - "Qual o telefone da escola?".
5. **Se uma resposta demorar,** é o Gemini gratuito sobrecarregado. A pergunta seguinte do roteiro responde normalmente.

## 8. Testes

| Comando | O que testa |
| --- | --- |
| `npm test` | Suíte principal: motor curado, classificador, rotas, histórico, telas, avisos e segurança, com Gemini e Firebase simulados. |
| `npm run test:servidor` | Configuração e inicialização do servidor Render. |
| `npm run test:regras` | Regras do Firestore nos emuladores (Firebase CLI + Java). |
| `node --test tests/com-dados-privados/*.test.mjs` | RAG documental com a amostra oficial `tests/dados/rag-original.json`, que fica fora do git porque contém o texto dos documentos. |

## 9. Código legado mantido

- **Provedores OpenAI e OpenRouter e modo demonstração:** caminhos alternativos do fluxo documental. A produção usa o Gemini, e o código fica porque é configurável por variável de ambiente e tem testes.
- **`functions/src/assistente/gemini.ts`:** cliente antigo do Gemini, usado só por um teste do fluxo documental.
- **`local-e2e/`:** testes ponta a ponta com emuladores.
- **Nome da pasta `render-poc`:** vem da prova de conceito. Renomear exigiria mudar o Root Directory no Render.

O histórico completo das etapas anteriores (fases 7.x, relatórios de interface, ativação de provedores, levantamento da base e questionário da Secretaria) está no histórico do git, antes do commit de organização final.
