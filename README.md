# Projeto Sylvinho

Assistente virtual com inteligência artificial para a **Secretaria Acadêmica da ETEC Sylvio de Mattos Carvalho** (Matão/SP). É o Trabalho de Conclusão de Curso de cinco alunos do Ensino Médio com Técnico em Informática para Internet.

- **Site:** https://sylvinho.web.app (Firebase Hosting)
- **Servidor da IA:** https://sylvinho-backend-poc.onrender.com (Render)
- **Banco e contas:** Firebase (Authentication e Cloud Firestore), projeto `tcc-ia-d8891`

O Sylvinho responde dúvidas sobre matrícula, rematrícula, Vestibulinho, cursos, frequência, avaliação, documentos, regras e serviços da escola. As respostas vêm de **fatos aprovados**, conferidos em fontes oficiais. A IA (Google Gemini) ajuda a escrever a resposta, mas não inventa dados. Quando falta confirmação, o Sylvinho indica a Secretaria.

## Documentação

| Documento | Para quê |
| --- | --- |
| Este README | Visão geral, estrutura de pastas, testes e publicação. |
| [docs/RELATORIO-TECNICO-IA.md](docs/RELATORIO-TECNICO-IA.md) | Como a IA funciona (modo híbrido), segurança, avaliação e os trechos de código para o relatório técnico e os slides. |
| [docs/OPERACAO-E-MANUTENCAO.md](docs/OPERACAO-E-MANUTENCAO.md) | Variáveis de ambiente, publicação, administradores, avisos por e-mail, curadoria da base, avaliação e checklist da banca. |
| [docs/ACESSIBILIDADE.md](docs/ACESSIBILIDADE.md) | Alto contraste e tamanho da fonte: como funciona, arquivos que mudaram, testes e como manter. |
| [docs/WHATSAPP.md](docs/WHATSAPP.md) | Sylvinho no WhatsApp (API oficial da Meta): como funciona, passo a passo da configuração e problemas comuns. |

## Funcionalidades

- **Chat sem login (visitante):** responde na hora e não guarda histórico.
- **Chat com login:** histórico de conversas por conta, salvo no Firestore. Entende perguntas de acompanhamento, como "e o prazo?".
- **Cadastro e login:** por e-mail e senha ou com Google, com recuperação de senha.
- **Mural de avisos:** os administradores publicam, e cada aviso novo gera um e-mail para as contas.
- **Configurações:** perfil, tema claro ou escuro e, para administradores, publicação de avisos e promoção de outros administradores.
- **Acessibilidade:** alto contraste (no tema escuro e no claro) e fonte até 200%, em todas as páginas e antes do login. Detalhes em [docs/ACESSIBILIDADE.md](docs/ACESSIBILIDADE.md).
- **WhatsApp (demonstração):** o Sylvinho responde no WhatsApp com as mesmas respostas do chat de visitante, pela API oficial da Meta. Detalhes em [docs/WHATSAPP.md](docs/WHATSAPP.md).
- **Página Sobre e landing page.**

## Como a IA responde (modo híbrido)

```text
Pergunta
  │
  ├─ Classificador local (functions/src/assistente/escopo.ts)
  │     saudação, "quem é você?", fora do escopo ou tentativa de manipular o bot -> resposta fixa
  │
  ├─ Motor curado (render-poc/motor-curado/)  ← base de fatos aprovados (knowledge-local/)
  │     1. bloqueia dados pessoais (CPF, RA, nomes) antes de qualquer chamada externa
  │     2. busca os fatos mais próximos: palavras (BM25) + significado (embeddings)
  │     3. pergunta igual a uma pergunta aprovada -> texto aprovado na hora (sem Gemini)
  │     4. senão: o Gemini escreve com os fatos -> validação por código -> revisão pelo Gemini
  │     5. Gemini fora do ar -> mostra o texto aprovado do fato mais seguro (reserva)
  │
  └─ Sem fato aprovado -> fluxo documental (RAG sobre o Regimento e os documentos no Firestore)
```

Detalhes em [docs/RELATORIO-TECNICO-IA.md](docs/RELATORIO-TECNICO-IA.md).

## Estrutura de pastas

| Pasta / arquivo | O que tem |
| --- | --- |
| `public/` | O site (HTML, CSS e JavaScript), publicado no Firebase Hosting. `Logado/` tem as telas com login (Home/chat, Conversas, Avisos, Serviços e Configurações); `Chat/` é o chat de visitante. |
| `render-poc/` | Servidor Node.js publicado no **Render**. O nome vem da prova de conceito inicial e foi mantido porque é a pasta configurada no Render. |
| `render-poc/motor-curado/` | **Motor de IA da base curada:** busca, geração, validação, revisão, fila e cache. |
| `render-poc/motor-curado.cjs` | Liga o motor ao servidor e decide o modo híbrido. |
| `functions/src/` | TypeScript compartilhado: rota do chat (`assistente/handler.ts`), visitante, classificador de escopo, fluxo documental (RAG) e Cloud Functions dos avisos por e-mail (`index.ts`, `avisos/`). O Render compila essa pasta no deploy. |
| `knowledge-local/` | Base curada: `faq-curada.json` (75 fatos aprovados, com fonte e evidência), `contatos-publicos.json` (contatos oficiais permitidos) e `embeddings-curados.json` (índice vetorial). |
| `scripts/` | Ferramentas: reindexar a base, avaliar o híbrido, procurar segredos no código e as verificações usadas pelos testes. |
| `tests/` | Testes automatizados (Node test runner). `com-dados-privados/` exige a amostra oficial fora do git; `emulador/` exige os emuladores do Firebase. |
| `local-e2e/` | Infraestrutura dos testes ponta a ponta com emuladores. |
| `demo-academica/` | Fixtures fictícias do modo demonstração, usado só em testes e desligado em produção. |
| `firestore.rules` | Regras de segurança do banco: perfis, conversas privadas, avisos e administradores. |
| `firebase.json` | Configuração do Hosting, Functions, Firestore e emuladores. |

## Testes

```sh
npm test                 # suíte principal (~1.340 testes, sem rede nem credenciais)
npm run test:servidor    # testes do servidor Render
npm run test:regras      # regras do Firestore nos emuladores (Firebase CLI + Java)
npm run segredos         # procura chaves ou senhas esquecidas no código
```

Os testes simulam o Gemini e o Firebase: não gastam cota nem acessam dados reais.

## Publicação

1. **Backend (Render):** push na branch `main` e, no painel do Render, Manual Deploy → Deploy latest commit. O build compila `functions/`. Para conferir: `GET /health` mostra o motor e a revisão (commit) publicada.
2. **Site (Firebase Hosting):** `firebase deploy --only hosting --project tcc-ia-d8891`.
3. **Regras e Functions:** `firebase deploy --only firestore:rules,functions --project tcc-ia-d8891`.

Antes de publicar, rode `npm test` e `npm run segredos`. Se a base curada mudou, rode `npm run indexar` (ver o documento de manutenção).

## Equipe

Os nomes e contatos da equipe estão na página **Sobre** do site.
