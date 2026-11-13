# Revisão do site hospedado do Sylvinho

Data: 12/11/2026. Endereço: https://sylvinho.web.app/.

O site abriu pelo navegador com o ECC. Foi possível consultar páginas públicas e navegar na sessão já autenticada disponível. A publicação tem diferenças importantes em relação à cópia local, e foram reproduzidos problemas no uso do chat pelo celular e na página Serviços. O funcionamento completo da IA em produção permanece sem confirmação nesta revisão.

## Escopo e limites

- Navegação de leitura pelo ECC Chrome DevTools, seguindo o ECC Browser QA. Não foram fornecidas credenciais nem executado um novo login.
- Consulta HTTP complementar de 14 rotas, incluindo `/` e `/index.html`, e 47 URLs locais únicas ao todo, incluindo páginas, estilos, scripts e imagens. As verificações HTTP não usaram sessão autenticada.
- Medição do DOM em nove telas, nas larguras 320, 390, 768 e 1440 pixels: 36 combinações. Alturas correspondentes: 640, 844, 800 e 900 pixels.
- Inspeção visual da landing em desktop. Capturas adicionais travaram na ferramenta; a conexão alternativa de Computer Use estava indisponível. As medições puderam continuar após a recuperação do ECC.
- Não houve envio de pergunta nova, criação ou exclusão de conversa, alteração de perfil ou tema, publicação ou exclusão de aviso, promoção de usuário, disparo de e-mail ou ação no WhatsApp.
- Login completo, cadastro, recuperação de senha, sessão anônima, permissões de aluno e operações de escrita não foram exercitados. A sessão existente era administrativa; abrir as configurações do aluno redirecionou para a tela administrativa.
- Não foi concluída auditoria automatizada de WCAG, teste com leitor de tela, navegação integral por teclado, reduced motion ou JavaScript desativado. Não foram obtidos Lighthouse, LCP, CLS ou INP representativos. Sem baseline visual equivalente, a regressão visual completa é inconclusiva.
- Nenhum código da aplicação, regra, conteúdo da base ou dado remoto foi alterado. Foram criados apenas este relatório e arquivos locais de apoio em `.cache/revisao-hospedado-2026-11-12/`. Sem commit, push ou deploy.

## Diferença entre publicação e cópia local

A [landing publicada](https://sylvinho.web.app/) contém a apresentação inicial com logos, navegação, texto de abertura e os dois botões. Seu título é `Document`; não há elemento `main` nem seções `section` no HTML consultado. O fundo utilizado é `Landing-Page/arquivos/fundo1_landingPage.png`.

A cópia local de `public/index.html` tem título próprio do Sylvinho, um `main`, cinco seções, referência a `landing.css`, animações de scroll e referências a WebP. Portanto, a página hospedada não corresponde à landing local atual. Isso não significa que as melhorias locais desapareceram. É compatível com a restrição anterior de manter alterações locais sem deploy; não foi determinada nesta revisão a origem ou data de cada publicação remota.

Os demais HTMLs consultados também diferem em bytes dos arquivos locais, mas esse teste isolado não comprova quais comportamentos mudaram: formatação e finais de linha também afetam o resultado. A comparação funcional concreta acima foi feita para a landing.

## Achados prioritários

### 1 Campo de escrita fora da primeira tela no celular

Na [Home do chat](https://sylvinho.web.app/Logado/Home/home.html), sem abrir conversa, o campo de escrita ficou nas seguintes posições:

| Tela | Início do campo | Fim do campo | Visível ao abrir |
| --- | ---: | ---: | --- |
| 320 × 640 | 1069 px | 1115 px | Não |
| 390 × 844 | 993 px | 1039 px | Não |
| 768 × 800 | 742 px | 785 px | Sim |
| 1440 × 900 | 842 px | 885 px | Sim |

Em 390 × 844, rolar até o fim tornou o campo acessível: ele passou a ocupar aproximadamente 757 a 803 px da tela. Não foi constatada impossibilidade absoluta de escrever; o problema reproduzido é precisar rolar a página antes de alcançar o campo. O menu ocupava cerca de 231 px de altura nessa largura, sem um controle visível de recolhimento identificado na inspeção.

Recomendação: adotar uma estrutura de chat limitada à altura disponível da janela, reservar espaço para o campo de escrita e rolar o histórico internamente. No celular, reduzir ou recolher a navegação e compactar apresentação e sugestões. Conferir depois com teclado virtual real, orientação horizontal e zoom, pois a emulação de viewport não substitui esses testes.

Prioridade: alta, por afetar diretamente o uso do principal recurso.

### 2 Conversas salvas sem resposta exibida

No [histórico](https://sylvinho.web.app/Logado/Conversas/conversas.html), foram carregadas quatro conversas. Duas conversas existentes foram abertas por seus links. Em cada uma, a interface mostrou uma pergunta do usuário e nenhuma mensagem do assistente. A mensagem de status permaneceu genérica, informando que as mensagens são salvas na conta. Não havia resposta para copiar ou fontes expansíveis nessas duas exibições.

Isso não demonstra que toda conversa falha nem identifica a causa. Uma conversa pode ter sido interrompida, não ter resposta persistida ou encontrar outro problema. Também não é um teste de uma requisição nova ao Gemini. Os identificadores das conversas e dados do perfil foram omitidos deste relatório.

Recomendação: reproduzir o cenário em ambiente local ou de teste, conferir estados de envio pendente, resposta persistida, carregamento do histórico e falha recuperável. Uma pergunta sem resposta não deve ficar sem explicação; quando aplicável, oferecer recuperação que preserve a identificação do envio e impeça duplicações. Confirmar por teste de ponta a ponta a geração pelo modelo e o apoio nas fontes aprovadas.

Prioridade: alta. Estado atual do Gemini, cotas, modelo e RAG de produção: não confirmado nesta revisão.

### 3 Erro reproduzido em Serviços

Na página [Serviços](https://sylvinho.web.app/Logado/Servi%C3%A7os/servicos.html), o console registrou:

```text
Uncaught TypeError: Cannot set properties of null (setting 'textContent')
servicos.js:42:32
```

O JavaScript procura `#whatsapp-status`, mas esse identificador não existe no HTML publicado. No ramo observado, o código instala um bloqueio de clique por falta de número configurado e depois falha ao tentar atualizar o status ausente.

Além disso, a tela anuncia continuidade do atendimento, disponibilidade 24 horas e conversa com a IA pelo WhatsApp, enquanto o `href` exibido aponta genericamente para `https://web.whatsapp.com/`. Essa apresentação não comprova uma integração operacional nem transferência de histórico. O link não foi acionado.

Recomendação: registrar a inconsistência de código e alinhar as promessas ao serviço realmente disponível. Como a integração do WhatsApp ficou fora do escopo de alterações solicitado anteriormente, este relatório não executa nem propõe sua ativação imediata. O erro deve permanecer visível na lista de pendências técnicas.

Prioridade: alta para o erro de interface; integração e texto dependem da decisão de escopo.

### 4 Termos e privacidade precisam de acabamento e revisão de correspondência

As páginas de [termos](https://sylvinho.web.app/Criar-Conta/termos.html) e [privacidade](https://sylvinho.web.app/Criar-Conta/pol%C3%ADticaPriv.html) responderam, mas ambas estão com título `Document`, idioma `en`, sem `main` e sem título principal `h1`.

Os termos têm 23 ocorrências de cor em estilos diretamente no HTML; a privacidade, 17. Elas não carregam o mesmo CSS de tema das páginas principais. Nos termos, o link do projeto aponta para `tcc-ia-d8891.web.app/index.html`. Na privacidade, o link do nome do projeto tem destino vazio. Não foi identificado um retorno próprio para o cadastro ou início nessas páginas.

Recomendação: acertar idioma, título, navegação e aplicação dos estilos compartilhados, preservando a leitura. Separadamente, conferir se o conteúdo descreve de fato autenticação, histórico, IA, tratamento de mensagens, contatos e exclusão de dados. Esta revisão não certifica adequação jurídica nem propõe inventar prazos ou compromissos de privacidade.

Prioridade: média, antes de considerar o fluxo de cadastro finalizado.

## Revisão por área

| Área | O que foi observado | Próximo ajuste ou verificação |
| --- | --- | --- |
| Landing | Identidade preta e vermelha, logos carregados, Poppins e botões principais presentes. Versão reduzida frente à cópia local. | Validar a versão local aprovada antes de qualquer futura publicação; título, descrição e `main` também precisam ser acertados na publicação atual. |
| Sobre | Estrutura com título, seções, equipe, contatos e retorno ao início; sem erro de console na consulta realizada. | Manter consistência com a landing escolhida e conferir foco e leitura completa no celular. Os contatos públicos não foram acionados. |
| Login | HTML com campos obrigatórios, preenchimento automático apropriado para usuário e senha, opção de lembrar e recuperação. | Na versão consultada não há botão de mostrar senha nem link próprio para voltar ao início. Validar em sessão de teste antes de concluir o fluxo. |
| Cadastro | HTML com nome, e-mail, senha, confirmação e aceite obrigatório com links institucionais. | Falta controle de mostrar senha e retorno claro para quem já possui conta. Verificar mensagens de senha divergente e falhas de criação em ambiente de teste. |
| Chat público | HTML e recursos presentes. Na sessão autenticada disponível, a abertura encaminhou para a Home logada. | Testar separadamente em sessão realmente anônima. A existência do HTML não comprova funcionamento da conversa pública. |
| Home | Rotas do menu acessíveis, campo com nome acessível, botões de sugestão e estado de salvamento presentes. Há símbolos de texto nos ícones. | Campo sempre disponível no celular, menu compacto, ícones consistentes e explicação para conversas sem resposta. |
| Conversas | Quatro registros carregados e links para abertura; ações de renomear e excluir presentes. Não havia busca visível. | Busca pode ajudar quando o histórico crescer; verificar títulos longos e mensagens sem resposta. Nenhum registro foi renomeado ou excluído. |
| Avisos | Estado vazio claro; controles de seleção e exclusão desativados quando não há registros. | Testar lista preenchida e permissões em ambiente de teste antes de adicionar filtros. Nenhuma publicação foi feita. |
| Serviços | Tela carregada, mas com erro de JavaScript e promessas de WhatsApp não verificadas. | Manter a pendência registrada e respeitar a decisão de não trabalhar agora na integração. |
| Configurações administrativas | Perfil, segurança, tema e acessos a criação de avisos e promoção de usuários presentes. | Testar permissões com contas de teste; não confundir ver os controles com comprovar segurança. Nenhum controle de escrita foi acionado. |
| Configurações do aluno | HTML público responde; a sessão administrativa foi encaminhada à tela correspondente ao seu papel. | Avaliar com conta de aluno de teste. Não foi verificado o comportamento real das preferências do aluno. |
| Termos e privacidade | Textos acessíveis, mas com metadados, navegação e estilos destoantes. | Acabamento compartilhado e revisão do conteúdo contra o funcionamento real. |

## Responsividade medida

Nenhuma das 36 combinações abaixo apresentou largura do documento maior que a janela nas medições. Isso não substitui aprovação visual completa: o campo de escrita fora da primeira tela é um exemplo de problema que não aparece na verificação de rolagem horizontal.

| Tela | 320 × 640 | 390 × 844 | 768 × 800 | 1440 × 900 |
| --- | --- | --- | --- | --- |
| Landing | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |
| Sobre | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |
| Termos | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |
| Privacidade | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |
| Home | Campo abaixo da tela inicial | Campo abaixo da tela inicial | Campo na tela | Campo na tela |
| Conversas | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |
| Avisos | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |
| Serviços | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |
| Configurações administrativas | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal | Sem excesso horizontal |

As imagens já concluídas nas telas medidas não apresentaram falha de carregamento. As verificações HTTP dos recursos locais consultados também não registraram respostas 4xx ou 5xx. Recursos externos, importações JavaScript indiretas e todos os estados dinâmicos não estão integralmente cobertos por essa contagem.

## Desempenho e consistência visual

Os tamanhos HTTP dos fundos publicados, sem considerar a compressão de transporte, foram:

| Arquivo | Tamanho aproximado |
| --- | ---: |
| Fundo PNG da landing | 1,50 MB |
| Fundo PNG da Home | 1,30 MB |
| Fundo PNG do login | 1,20 MB |

Recomendação: avaliar as cópias otimizadas já preparadas localmente e servir variantes adequadas à tela, preservando os arquivos originais, logos e documentos oficiais. Não afirmar economia percentual sem comparar os arquivos e conferir o resultado visual. Não foram recomprimidas imagens nesta revisão.

A Poppins foi observada nas principais páginas inspecionadas. Os símbolos de texto da navegação continuam destoando da proposta de ícones SVG consistentes. Algumas páginas já têm link de pular para o conteúdo e regiões bem identificadas; isso é positivo, mas a presença do VLibras ou desses elementos não comprova acessibilidade completa.

O código de tema publicado utiliza uma preferência geral `etec:theme`, além de uma chave por usuário, e as páginas públicas carregam esse mecanismo. Isso sustenta a necessidade de decidir se o tema escolhido na área logada deve afetar também páginas públicas. Não alterei essa preferência para testar a persistência na conta.

Na configuração administrativa, o texto informa que novos avisos são enviados por e-mail a alunos e administradores. Não houve publicação de aviso nem inspeção do serviço de envio em produção; a correspondência entre texto, destinatários reais e preferências continua pendente.

## Ordem recomendada

1. Registrar qual versão local será usada como referência de aprovação. Não publicar automaticamente para aproximar as versões.
2. Ajustar e testar localmente a área de chat no celular, garantindo o campo de escrita e reduzindo a navegação expandida.
3. Investigar as conversas sem resposta exibida e testar envio, falha, recuperação, persistência e RAG com dados controlados. Só depois avaliar o comportamento equivalente em produção, dentro do escopo autorizado.
4. Finalizar consistência de ícones, telas de acesso, termos e privacidade, aproveitando as melhorias locais existentes em vez de refazer o projeto.
5. Validar fundos otimizados e obter medições representativas de carregamento e estabilidade visual.
6. Executar os fluxos de aluno, visitante e administrador com contas de teste e avisos de teste, sem atingir usuários reais. Confirmar o comportamento de e-mail e as permissões no backend.

O questionário de informações escolares é complementar a essas tarefas: ampliar a base melhora o conteúdo das respostas, mas não resolve sozinho falhas de envio, persistência, interface ou cota do provedor.

## Resultado da revisão

Há uma identidade visual coerente e as rotas principais carregam, mas ainda existem pendências funcionais reproduzidas. Não é possível afirmar que o site ou a IA estão funcionando 100% com esta revisão de leitura. A geração nova de respostas, a segurança por papel e a regressão visual completa permanecem inconclusivas.

Evidências locais: `.cache/revisao-hospedado-2026-11-12/auditoria-http.json` e `responsividade.json`. Esses arquivos não registram credenciais, tokens de autenticação ou identificadores das conversas consultadas. O cache de scripts contém somente código servido publicamente pelo site e não deve ser confundido com auditoria do backend.

Para reverter somente esta entrega, remover este relatório e a pasta de apoio citada. Não é necessário reverter arquivos da aplicação, pois eles não foram editados nesta tarefa.
