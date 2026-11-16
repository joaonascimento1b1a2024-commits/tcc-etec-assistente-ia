# Correções de domínio e frontend para Render

Data: 16/11/2026. Branch `feat/ia-confiabilidade-local`. Alterações locais, ainda sem commit, push ou deploy. Este documento sucede o diagnóstico `REVISAO-PUBLICACAO-SYLVINHO-2026-11-16.md` e distingue preparação de correção efetivamente entregue ao site público.

## 1. Domínio no frontend — corrigido localmente

`public/Logado/Home/assistente-config.js` agora reconhece `https://sylvinho.web.app` e `https://sylvinho.firebaseapp.com`, preservando as duas origens antigas. O cliente visitante continua derivando `/perguntarVisitante` do endpoint Render. Autenticação e loopback não foram alterados. Domínios semelhantes, HTTP e portas alternativas continuam bloqueados.

## 2. CORS no Render — código corrigido; ambiente remoto pendente

`render-poc/producao.cjs` permite as quatro origens explícitas. O validador documental existente passa a aceitar os domínios novos. Não foi usado wildcard nem reflexão de qualquer Origin.

No serviço Render, a configuração não secreta a aplicar junto do código corrigido é:

```dotenv
ASSISTENTE_CORS_ORIGINS=https://sylvinho.web.app,https://sylvinho.firebaseapp.com,https://tcc-ia-d8891.web.app,https://tcc-ia-d8891.firebaseapp.com
```

Essa configuração foi registrada também no exemplo público. Alterar só a variável no serviço antigo pode falhar na validação; alterar só o código mantendo a variável antiga continua rejeitando o domínio novo no CORS. Código e ambiente precisam ser entregues juntos. Chaves, conta de serviço, projeto Firebase, provedor e modelo da IA não foram alterados.

## 3. Sobre e publicação antiga — fonte pronta; entrega pendente

O link separado `Sobre/sobre.html` já estava corrigido no commit anterior e foi mantido. O Hosting remoto ainda servia o HTML anterior no diagnóstico. A atualização efetiva exige publicar a revisão correta no target `sylvinho`; não foi feita nesta execução.

Os dois targets de Hosting receberam configuração de revalidação para HTML, JS e CSS sem nomes versionados: `public, max-age=0, must-revalidate`. Imagens e fontes não foram incluídas nessa alteração. Isso reduz permanência de arquivos antigos após futuras atualizações, mas não substitui publicar o artefato certo.

## 4. Mobile, contraste e favicon — corrigidos localmente

- Painel de benefícios usa grid adaptativo com largura mínima de card; em telefones passa a uma coluna sem quebrar palavras dos títulos.
- Destaque dos títulos mudou de `#f00` para `#ff6565` no fundo `#212121`. Contraste medido: aproximadamente 5,60:1.
- Novo `public/favicon.svg`, declarado nas treze páginas HTML com caminhos relativos. A validação local requisita o ícone declarado e verifica HTTP 200; não depende de `/favicon.ico` implícito.

## 5. Testes e detecção de publicação incorreta

- `tests/dominio-sylvinho-render.test.mjs`: domínios novos, frontend, configuração documental, preflight das duas rotas sem inicializar Firebase/IA e rejeição de origem maliciosa. Os quatro testes positivos falharam antes da implementação.
- `scripts/verificar-publicacao-sylvinho.mjs`: smoke manual somente GET/OPTIONS para health, link Sobre, domínio no cliente, favicon e CORS. Não inicia login, grava conversas ou chama o modelo. Uso após entrega: `node scripts/verificar-publicacao-sylvinho.mjs`. Aceita opcionalmente `--origem=` com uma das quatro origens oficiais. Uma falha retorna código de saída diferente de zero.
- `tests/smoke-publicacao-sylvinho.test.mjs`: o smoke reprova os três problemas publicados e não usa POST.
- Três expectativas antigas de texto em `tests/assistente-producao.test.mjs` foram atualizadas para reconhecer também a recusa natural já usada pelo produto, mantendo as verificações de persistência e rejeição de conteúdo indevido.

## Verificação realizada

- 512 testes selecionados passaram, nenhuma falha.
- 66/66 cenários offline passaram.
- Build TypeScript das Functions passou.
- Lint das Functions e checagem de sintaxe dos scripts novos passaram; `git diff --check` sem erros.
- `scripts/verificar-front-publicacao-local.mjs`: Chrome em 360, 375, 390, 414, 768 e 1440px. Sem overflow horizontal, títulos sem quebra de palavra, Sobre e retorno funcionando, ícone 200 e contraste acima de 4,5:1. Nenhum erro JavaScript detectado. Preview efêmero, sem alterar os emuladores ou acessar a produção.
- Evidências em `.cache/correcao-publicacao-2026-11-16/`.

A regressão excluiu pelos padrões os casos de corpus original que dependem de artefatos locais ausentes (`formato real gerado` e `Node HTTP -> fabrica Render -> RAG original`). Não são 512 testes do sistema inteiro nem uma certificação de produção. Nenhuma chamada paga foi realizada nesta correção.

## O que permanece pendente

- Publicar frontend e backend corrigidos e aplicar `ASSISTENTE_CORS_ORIGINS` no Render. Depende de autorização para publicação; a instrução anterior era manter o trabalho local.
- Executar o smoke no domínio real depois da entrega, seguido de teste visitante e autenticado com conta de teste.
- Investigar pelos logs/telemetria do Render a demora de início observada. Espera e timeout continuam cobertos por testes; não foi alterado o plano do serviço nem ocultada a demora com tentativas automáticas.
- Confirmar provedor/motor efetivamente usado no serviço e decidir a integração do motor curado local. Não trocar o pipeline de IA silenciosamente como parte de uma correção CORS. O backend continua com seu fluxo existente.
- Verificar os domínios autorizados de Authentication e as quatro revisões humanas de conteúdo antes de aprovação final.

Nenhuma dessas pendências foi marcada como resolvida apenas porque o health retorna 200. A validação ponta a ponta remota só é possível após a entrega das alterações.

Referência oficial para cabeçalhos e revalidação do Hosting: [configuração de cabeçalhos](https://firebase.google.com/docs/hosting/full-config#headers) e [comportamento de cache](https://firebase.google.com/docs/hosting/manage-cache).
