# Sylvinho — relatório do projeto e das alterações locais

Atualizado em 11/11/2026. Situação: alterações locais para avaliação, sem commit, push, deploy ou alteração remota do Figma.

Atualização posterior: a composição local com Gemini real e oito trechos de fontes reais foi implementada e testada. Resposta natural, fontes expansíveis, persistência, replay e autenticação foram verificados. Detalhes e limites em [CHAT-RAG-GEMINI-LOCAL.md](CHAT-RAG-GEMINI-LOCAL.md). As pendências de integração descritas abaixo refletem o estado anterior a essa rodada; não houve publicação.

## O que conheço do projeto

O Sylvinho é o assistente de IA da secretaria da ETEC Sylvio de Mattos Carvalho, em Matão. O objetivo é orientar alunos e responsáveis sobre informações acadêmicas e administrativas, usando documentos e regras da instituição. O projeto faz parte do TCC da equipe.

O frontend está em `public/`, com HTML, CSS e JavaScript, sem migração para outro framework. Existem landing, página da equipe, chat público, login, cadastro e páginas institucionais. A área autenticada reúne Home/chat, conversas anteriores, avisos, serviços e configurações de aluno e administrador.

O backend deste repositório está em `functions/`, usa TypeScript, Firebase Functions, Firebase Admin e o SDK Google GenAI. Há módulos de assistente, RAG e avisos. RAG é o mecanismo de consulta a informações documentais para apoiar as respostas. O projeto usa Firebase Authentication, Firestore e Hosting; o projeto Firebase indicado na sessão é TCC-IA (`tcc-ia-d8891`). Essa descrição se baseia nos arquivos e verificações desta sessão, sem afirmar que os serviços publicados foram validados.

A referência visual é o Figma TCC - Front, arquivo `o12zEQuWX9XfnKaOzhD3Dl`, especialmente o frame de landing `22:14`. A identidade adotada é escura, com vermelho, Poppins, fotos/artes tecnológicas e marcas oficiais da escola, CPS e Governo de São Paulo.

## Restrições combinadas

- Preservar a estrutura e a essência do projeto, sem recomeçar do zero.
- Preservar logos oficiais, documentos importantes e imagens originais.
- Não alterar a lógica do WhatsApp nesta etapa.
- Trabalhar localmente, sem commit ou publicação até autorização explícita.
- Manter possibilidade de reverter nossas alterações, preservando trabalho posterior da equipe.
- Usar ECC para orientar os ajustes e a verificação da interface.

## Sugestões e situação atual

| Proposta | Situação |
| --- | --- |
| Corrigir WhatsApp | Adiada por solicitação do usuário; lógica preservada. |
| Alinhar textos de notificações ao envio real | Textos ajustados; nenhuma mensagem real enviada. Preferência de ativar/desativar envio ainda não implementada. |
| Melhorar responsividade do chat | Implementada na Home e no chat público, incluindo menu móvel e campo de escrita visível. |
| Organizar estilos, cores e tipografia | Ajustes incrementais implementados, com Poppins e padrões compartilhados. Não houve limpeza completa de todo CSS legado. |
| Padronizar ícones e páginas institucionais | SVGs e apresentação de termos/privacidade ajustados; conteúdo jurídico preservado, sem revisão jurídica. |
| Copiar resposta, mostrar senha e processamento | Implementados com estados acessíveis e tratamento de falhas. |
| Pesquisar histórico e filtrar avisos | Busca por títulos e filtro por categorias existentes implementados. Não é busca no conteúdo completo das mensagens. |
| Abrir documentos citados | Pendente de destino confiável fornecido pelo backend; nenhum link foi inventado. |
| Atualizar Figma com componentes e estados | Planejado e documentado; arquivo remoto não alterado. |
| Compactar fundos | WebP sem perda adicionado; PNGs originais mantidos. |
| Aproximar landing do Figma | Implementada localmente e depois ajustada conforme avaliação do usuário. |

## O que foi feito até agora

### Interface compartilhada e área autenticada

Poppins foi incluída em arquivos locais com licença. Ícones de navegação e cartões foram padronizados com SVGs. Foram ajustados cores de ação, foco por teclado, espaçamentos e controles. O tema escolhido na conta passou a atuar somente na área autenticada; páginas públicas permanecem escuras.

O chat passou a usar a altura disponível da janela, com rolagem do conteúdo e campo de escrita fora dessa rolagem. O menu móvel abre sem empurrar o campo para baixo. O campo aceita várias linhas: Enter envia e Shift+Enter quebra a linha. O botão de anexo sem funcionalidade foi removido.

Foi adicionado copiar resposta com texto original e referências, confirmação somente quando a cópia funciona, mostrar/ocultar senha e indicação de processamento vinculada à requisição. A lógica existente de envio pendente foi preservada; não foi criado reenvio automático.

O histórico recebeu busca por título sem distinguir acentos. Avisos receberam filtro pelas categorias existentes. Termos e privacidade receberam idioma, título, tipografia, largura de leitura e retorno de navegação. Os textos de notificações foram alinhados ao comportamento observado no backend.

### Imagens

Três fundos anteriores foram convertidos para WebP sem perda: aproximadamente 4,00 MB passaram para 2,79 MB, redução de 30,2% nos arquivos transferidos correspondentes. Isso não representa a economia total de toda a landing atual: ela também usa outras artes do Figma. Os PNGs originais foram mantidos, portanto o tamanho da pasta não diminuiu na mesma proporção.

### Landing page

A landing recebeu composição baseada no Figma: cabeçalho com marcas oficiais, apresentação, benefícios, notebook ilustrativo, três etapas, serviços, chamada final e rodapé. Foram usados arquivos locais exportados e rotas já existentes.

Depois da avaliação do usuário, foi removido o limite externo de 1.440 px para preencher toda a janela. Em seguida, títulos principais passaram de 48 para 40 px, a apresentação passou de 816 para 660 px de altura mínima, e as demais seções foram compactadas. A imagem do notebook recebeu altura limitada em desktop, mantendo a arte inteira.

Na correção mais recente, foi removido o fundo lateral que competia com a arte central do notebook. Um fundo radial discreto e máscaras em degradê suavizam as bordas da imagem. Os fundos da apresentação e das três etapas também desaparecem gradualmente nas transições. As máscaras atuam apenas nas artes decorativas; textos, botões, logos e arquivos de imagem originais não foram modificados por esse efeito.

A landing atual incorpora essas decisões posteriores do usuário; não é uma reprodução pixel a pixel do frame inicial.

## Verificações e limitações

A rodada atual da landing passou em nove grupos de verificações, incluindo sete viewports: 1440×900, 1903×945, 2560×1080, 1024×768, 768×800, 390×844 e 320×640. Foram conferidos largura total, ausência de rolagem horizontal, carregamento de imagens, estrutura, destinos, âncora de serviços e atalho de teclado. Não houve erro JavaScript ou recurso HTTP com falha nessa rodada. A suavidade visual também exige avaliação humana; o teste automatizado não mede qualidade estética.

Nas rodadas anteriores, foram verificadas 51 condições de visibilidade e clique do campo de chat e 14 verificações gerais de navegador. O build TypeScript passou. Também passaram 84 testes selecionados; dois casos preexistentes ficaram excluídos por fixture ausente e mock incompatível. Esses resultados históricos não significam que toda a suíte foi executada novamente nesta correção de CSS.

O teste integrado com emuladores autenticou uma conta fictícia, mas a pergunta recebeu HTTP 403 de demonstração não autorizada. O fluxo completo de resposta e persistência continua sem aprovação nessa rodada; as permissões não foram afrouxadas para fazer o teste passar.

A prévia em `http://127.0.0.1:4173/` usa dados fictícios e substitui os controladores de dados apenas no conteúdo servido. Não comprova login real, geração de IA, gravação no Firestore ou envio de e-mail. O teclado virtual ainda merece teste em aparelho físico.

## Próximas prioridades recomendadas

1. Aprovar a aparência local da landing, especialmente as transições, escala e leitura no celular.
2. Testar o chat em aparelho físico, nos dois temas da área autenticada e com teclado aberto.
3. Resolver o bloqueio do ambiente de demonstração para validar o fluxo integrado, sem alterar permissões de produção indevidamente.
4. Definir um contrato de fontes documentais com título, página e URL/identificador confiável.
5. Atualizar o Figma com os padrões aprovados, versões móveis e estados de carregamento, vazio e erro.
6. Revisar os textos institucionais com a equipe responsável e decidir futuramente sobre preferências de notificações.

WhatsApp permanece fora da rodada. Commit e deploy dependem de autorização explícita posterior.

## Controle e reversão

O backup inicial está em `C:\Programação\Backups\sylvinho-ui-20261111\public`; existe também uma cópia anterior à landing em `.cache/landing-before/`. O relatório detalhado anterior está em `docs/REVISAO-INTERFACE-LOCAL.md`; as evidências locais estão em `.cache/ui-review/` e `.cache/landing-review/`.

Para reverter, comparar o estado atual com o backup e recuperar somente nossas alterações. Não usar reset/clean global, nem reaplicar o stash como forma de desfazer a interface. O inventário em `.cache/ui-review/manifest.json` registra uma rodada anterior e deve ser atualizado antes de uma reversão automática, pois houve ajustes posteriores na landing.
