# Revisão aprofundada — sylvinho.web.app

Data: 16/11/2026, horário de São Paulo. Diagnóstico com navegação real, comparação de arquivos, leitura do código e requisições GET/OPTIONS. Sem alterações no site, escritas no Firebase, login, deploy ou novas chamadas de geração de IA.

P0 = bloqueia o atendimento no domínio novo; P1 = comportamento ou integração que precisa ser resolvido antes da aprovação; P2 = qualidade e robustez; P3 = acabamento.

## Falhas e problemas reproduzidos

### 1. P0 — frontend desativa os endpoints no domínio novo

**Evidência:** `resolverAssistenteConfig({origin:'https://sylvinho.web.app'})` na publicação retornou `endpoint:''`. Uma pergunta sintética no chat visitante resultou em “O chat está indisponível neste ambiente”. Nenhuma chamada ao backend foi iniciada por esse envio.

**Causa:** `public/Logado/Home/assistente-config.js:8` permite apenas os dois domínios antigos. Nas linhas 39–40, origens fora da lista recebem endpoint vazio. `public/Chat/cliente.js` reutiliza essa configuração e deriva a rota visitante. Logo, ambos os clientes são afetados pela mesma configuração. A execução autenticada completa não foi exercitada.

**Correção:** incluir os domínios que serão efetivamente suportados, de forma explícita e alinhada com o backend. Não liberar qualquer origem nem alterar a proteção de loopback.

**Aceite:** resolução não vazia para o domínio novo; visitante usa `/perguntarVisitante`; autenticado usa `/perguntarAssistente`; origem desconhecida continua bloqueada.

### 2. P0 — backend rejeita o novo domínio por CORS

**Evidência após aquecimento:** preflight OPTIONS com Origin `https://sylvinho.web.app` retornou 403, sem `Access-Control-Allow-Origin`, nas duas rotas. Com `https://tcc-ia-d8891.web.app`, ambas retornaram 204 e cabeçalhos permitindo POST, Authorization e Content-Type. Respostas aquecidas levaram 265–402 ms.

**Causa confirmada remotamente:** política CORS não aceita o domínio novo. No código disponível, `render-poc/producao.cjs:8` mantém somente as origens antigas; `render-poc/documental.cjs:20` valida o ambiente contra essa lista. `validarOrigensProducao`, na linha 33 de `producao.cjs`, também impõe correspondência exata da lista. A configuração real de variáveis do Render não foi lida.

**Correção:** alinhar allowlist, validadores, testes e `ASSISTENTE_CORS_ORIGINS` do serviço. Revisar variantes `web.app`/`firebaseapp.com` somente se forem utilizadas. Corrigir apenas o frontend deixará esse segundo bloqueio intacto. Evitar `*` e reflexão indiscriminada de Origin.

**Aceite:** OPTIONS das duas rotas retorna 204 para cada origem aprovada e rejeita origem desconhecida; validar depois o POST real de visitante e o autenticado com conta de teste.

### 3. P1 — HTML publicado é anterior à correção do Sobre

**Evidência:** o hash do `/index.html` público, normalizando apenas finais de linha, coincide com `HEAD^:public/index.html`, anterior ao commit `ec16775`. O menu continua em `#sobre`; o clique foi reproduzido. A página `/Sobre/sobre.html` existe e responde 200. Outros quatro arquivos comparados coincidem com a cópia local, mas eles não permitem identificar a revisão inteira do deploy.

**Causa:** artefato antigo do index está sendo servido no domínio consultado. Não foi determinada a origem operacional: deploy anterior, alvo incorreto ou pipeline usando outra revisão. Não é apenas uma hipótese de cache do navegador: a leitura HTTP independente também encontrou o HTML antigo.

**Correção:** conferir commit/revisão de build, diretório `public` e target Hosting `sylvinho`. Publicar o artefato correto somente quando autorizado. `firebase.json` e `.firebaserc` possuem os targets `sylvinho` e `antigo`; atualizar main não comprova publicação no target correto.

**Aceite:** `/` e `/index.html` contêm `href="Sobre/sobre.html"`; clicar no menu abre a página separada no desktop e celular, inclusive em sessão nova. O retorno ao Início também deve funcionar.

**Prevenção:** registrar revisão do frontend e backend e fazer smoke test do domínio final. Arquivos consultados retornaram `Cache-Control: max-age=3600`; revisar a estratégia de revalidação do HTML/configuração, sem concluir que esse cache causou a divergência.

### 4. P2 — demora inicial do serviço

**Evidência:** a primeira bateria de quatro OPTIONS excedeu o limite de 20 segundos. Na sequência, GET `/health` e GET das rotas responderam em cerca de seis segundos; depois, os preflights responderam em menos de meio segundo. Health retornou 200; GET das rotas retornou 405 com `Allow: POST`, que é o comportamento esperado.

**Causa:** compatível com serviço iniciando ou instabilidade transitória; não há logs ou telemetria suficientes para atribuir definitivamente ao plano do Render.

**Correção sugerida:** medir separadamente primeira requisição e serviço aquecido; consultar logs de inicialização; manter estado de espera e retry sem duplicação; decidir sobre disponibilidade contínua conforme necessidade e custo. Não aumentar todos os timeouts como correção única.

**Aceite:** medir uma amostra de início e outra aquecida; informar espera, permitir recuperação e preservar a pergunta. Ainda não há p95 confiável nem teste de carga.

### 5. P2 — títulos quebram palavras no mobile

**Evidência:** captura a 375px mostra quebra dentro de palavras em “Informações seguras” e “Atendimento 24/7”. Medição do painel: células estreitas, fonte de 19px/600 e `overflow-wrap:break-word`. A palavra “Atendimento” ultrapassou a largura de 123px da célula na medição. Não há rolagem horizontal.

**Causa:** `public/Landing-Page/landing.css:140` mantém duas colunas; uma coluna só entra em até 360px, na linha 170. `public/Arquivos-Universais/visual.css:15` permite quebra de palavras globalmente.

**Correção:** antecipar uma coluna para painéis estreitos ou adaptar o grid ao tamanho mínimo legível dos cards. Ajustar padding/gap antes de reduzir tipografia; não remover globalmente proteções contra overflow.

**Aceite:** títulos sem quebra dentro das palavras em 360, 375, 390 e 414px, sem overflow e com zoom de texto.

### 6. P2 — contraste do título do painel merece ajuste

**Evidência:** cor computada `rgb(255,0,0)` sobre `rgb(33,33,33)` resulta em aproximadamente 4,027:1; mobile usa 19px e peso 600. O valor fica abaixo do alvo de 4,5:1 para texto comum. A classificação de texto grande/negrito deve ser conferida com a fonte efetiva; não foi feita auditoria WCAG completa.

**Correção:** usar tom de destaque mais claro no painel ou outra combinação que atinja ao menos 4,5:1 sem depender da exceção para texto grande.

**Aceite:** medir as cores computadas nos temas suportados e conferir contraste de foco/hover. Referência: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html .

### 7. P3 — favicon inexistente na rota padrão

**Evidência:** `/favicon.ico` retornou 404 no navegador. Existe um arquivo local `public/Arquivos-Universais/favicon.png.jpeg`, mas não foi confirmada a adequação do formato nem sua declaração nas páginas.

**Correção:** escolher ícone válido e declarar `rel="icon"` com caminho/tipo corretos nas páginas, ou fornecer a rota padrão.

**Aceite:** ícone carrega com 200, é exibido na aba e não produz o 404 observado.

## Lacunas de integração e testes

### 8. P1 — motor local melhorado ainda precisa de integração explícita

No código disponível, `scripts/iniciar-rag-gemini-local.mjs:45` instancia `criarGeminiCurado`. O caminho de produção em `render-poc/documental.cjs:71` usa `criarFluxoPerguntaLivre` e retorna `fluxo.gerarResposta`, sem integrar esse motor local. Fazer merge ou publicar apenas Hosting não transfere automaticamente fila, curadoria e validação do adaptador local ao serviço Render.

Isso é uma lacuna confirmada no código, não uma determinação do provedor ou modelo atualmente em execução remota. O health público não identifica revisão, modo ou motor. As duas rotas responderem 405 em GET comprova sua presença, não o funcionamento factual do RAG/Gemini.

**Trabalho necessário:** definir qual pipeline será oficial; integrar o comportamento aprovado de forma explícita; preservar autenticação, proteção de dados, persistência, limites e contrato HTTP; testar o mesmo conjunto no adaptador de produção. Não copiar credenciais ou apontar produção para emuladores.

**Aceite:** versão/motor identificáveis sem segredos; mesma bateria de perguntas e falhas aprovada no ambiente apropriado; verificação ponta a ponta com conta de teste antes de considerar a IA publicada equivalente à local.

### 9. P1 — testes não detectam a migração de domínio

`tests/assistente-client.test.mjs:149` compara as listas do cliente e servidor. As duas listas podem estar iguais e ambas omitir o site novo, como ocorreu aqui. Falta contrato que relacione os domínios reais de publicação à configuração testada.

**Correção:** adicionar regressões para o domínio `sylvinho.web.app`, origens antigas mantidas e origem proibida; incluir preflight das duas rotas e clique real em Sobre em smoke pós-publicação. Não enfraquecer os testes para apenas aceitar qualquer domínio.

## Validações pendentes — não classificadas como falhas confirmadas

- Firebase Authentication: conferir se o novo domínio está autorizado para os provedores utilizados. Não presumir que o `authDomain` antigo deva ser substituído: site e autenticação podem pertencer ao mesmo projeto. Google login, e-mail/senha e restauração de sessão precisam de conta de teste; não foram exercitados em produção.
- Área autenticada: navegação com menu aberto/recolhido, botão Voltar, histórico, isolamento entre contas, retry e resposta real da IA. Sem sessão, o redirecionamento para Login passou.
- Quatro revisões de conteúdo continuam pendentes: celular em aula, saída antecipada, uniforme e calçado. As datas de revisão não foram atualizadas artificialmente.
- Sem baseline visual, auditoria axe/leitor de tela ou métricas de campo: não há certificação de regressão visual, acessibilidade completa, INP ou Core Web Vitals reais.

## Ordem proposta de correção

1. Alinhar domínios no frontend, backend e configuração do serviço, com testes de rejeição preservados.
2. Confirmar e entregar o index correto no target de Hosting, quando autorizado.
3. Decidir e integrar o motor oficial da IA; verificar configuração do Authentication e fluxo completo com conta de teste.
4. Resolver legibilidade/contraste mobile, demora inicial e favicon.
5. Repetir smoke pós-publicação no domínio real e manter evidência da revisão de cada serviço.

## Evidências locais

`.cache/qa-sylvinho-publicado-2026-11-16/relatorio.json`, `aprofundamento.json`, `resultado.md` e capturas PNG. São artefatos de execução ignorados pelo Git. Os hashes e preflights permitem reproduzir a distinção entre frontend bloqueado, CORS rejeitado e HTML antigo. Somente este relatório foi acrescentado ao código versionável nesta revisão; nenhuma correção foi aplicada.
