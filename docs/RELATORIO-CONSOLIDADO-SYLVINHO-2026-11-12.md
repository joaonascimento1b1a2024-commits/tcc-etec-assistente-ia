# Sylvinho — relatório consolidado e continuidade

Revisão posterior de navegação: [correção do salto desktop ao trocar páginas e usar Voltar](NAVEGACAO-DESKTOP-SUAVE-LOCAL.md). Estado da lateral antecipado, ícones estáticos e transição nativa de conteúdo; sem alterar IA ou publicar.

Fechamento posterior: [gaveta móvel, regras emuladas e validação final local](FECHAMENTO-MOBILE-E-VALIDACAO-LOCAL.md). Esse registro atualiza as pendências de infraestrutura das rodadas anteriores e preserva os limites de aparelho físico e SDK externo.

Continuidade móvel posterior: [correções de teclado simulado e verificações locais](CELULAR-E-VERIFICACOES-LOCAIS.md). Imagens adiadas; ensaios físicos/Safari e regras em emulador continuam com limites registrados nesse documento.

Atualização posterior em 12/11/2026: a pendência de suavização do recolhimento desktop foi implementada e verificada localmente. Ver [resultado, testes e limites desta rodada](RECOLHIMENTO-DESKTOP-LOCAL.md). As afirmações abaixo sobre ausência dessa correção e ausência de novas suítes descrevem o momento da consolidação original.

Data de consolidação: **12/11/2026**. Escopo desta entrega: documentação. Foram consultados os arquivos, o estado do Git, os relatórios e as evidências locais. **Nesta entrega não foram alterados código, imagens, configurações, dados, Figma ou serviços remotos; não foram executadas novas chamadas à IA nem repetidas as suítes.** Os resultados abaixo são identificados por rodada, sem apresentá-los como testes executados novamente agora.

## 1. O projeto e os ambientes

O Sylvinho é o TCC que oferece atendimento informativo da Secretaria Acadêmica da ETEC Sylvio de Mattos Carvalho, em Matão. O objetivo é responder em linguagem simples, apoiando as informações institucionais em fontes verificadas e encaminhando dúvidas não confirmadas ao setor competente.

| Parte | Local / referência | Observação |
|---|---|---|
| Repositório principal | `C:\Programação\tcc-etec-assistente-ia` | Frontend em `public/`; backend TypeScript em `functions/`; testes e composição local no mesmo repositório. |
| Backend complementar | `C:\Programação\sylvinho-backend` | Existe separadamente; o inicializador local consulta a configuração do Gemini desse backend. Não presumir que só ele contém a IA. |
| Frontend | HTML, CSS e JavaScript | Não houve migração para React, Next.js, Tailwind ou shadcn. |
| Serviços | Firebase Authentication, Firestore, Functions e Hosting | Existência/configuração não equivale à homologação completa dos serviços. |
| Publicação | https://sylvinho.web.app/ | Continua diferente das melhorias locais; nenhuma publicação foi feita nas entregas aqui documentadas. |
| Firebase configurado | `tcc-ia-d8891` | `.firebaserc` aponta o target `sylvinho` para o site `sylvinho`. Não confundir com o projeto antigo da chave Gemini. |
| Figma | [TCC — Front](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl/TCC---Front?node-id=0-1) | Referência visual, com revisões posteriores do usuário. |

Há dois ambientes locais distintos:

- **Prévia visual:** `node scripts/preview-ui.mjs`, endereço `http://localhost:4173/Logado/Home/home.html`. Usa dados fictícios e não comprova login, Firebase, Gemini, RAG ou e-mail. O endereço é uma referência de acesso, não uma afirmação de que o processo está ativo neste momento.
- **Aplicação com emuladores e RAG:** Hosting em `127.0.0.1:5000`, adaptador em `5002`, projeto emulado `demo-sylvinho-render-poc`. Precisa dos processos e da configuração local corretos. Mesmo com Firebase emulado, a geração e os embeddings reais usam a API externa e suas cotas.

## 2. Decisões e limites que permanecem válidos

1. Preservar a estrutura, a identidade preta/vermelha e a essência do projeto. Melhorar gradualmente, sem refazer tudo.
2. Usar **Poppins**, mantendo as fontes locais e a licença.
3. Preservar logos oficiais da escola, CPS e Governo, documentos importantes, imagens originais e trabalho anterior da equipe.
4. Não executar commit, push, deploy, importação no Firebase de produção ou escrita remota sem uma nova instrução explícita. A ideia de branch de teste foi discutida; não é autorização atual para publicar.
5. Não modificar nem ativar a integração de WhatsApp nesta etapa. Mostrar contato público confirmado não significa integrar atendimento ou transferir histórico.
6. Não enfraquecer autenticação, permissões, propriedade da conversa, proteção de dados ou controle contra envios duplicados.
7. Manter RAG e respostas sustentadas por evidências. O teste temporário sem RAG foi interrompido por solicitação do usuário; não o reativar automaticamente.
8. Não transformar informações informais do aluno em regras oficiais. Itens `em_revisao` ficam fora do índice de respostas aprovadas.
9. Preservar reversibilidade por comparação de arquivos e backups. Não usar reset, limpeza global ou reaplicação do stash para desfazer somente uma entrega.
10. Usar ECC e MCP quando contribuírem para a tarefa. Consultas limitadas de componentes devem ser usadas apenas quando necessárias. Não copiar chaves ou tokens para documentação, código ou prompts.

## 3. O que fizemos na interface

### Base visual e recursos compartilhados

- Poppins local, ícones SVG consistentes, ajustes de cores, espaçamento e foco visível.
- Tema da conta restrito a `/Logado/`, conforme o código atual de `theme.js`; as páginas públicas permanecem escuras. Há regras de CSS para telas claras adicionais, mas isso não significa que o tema público tenha sido autorizado ou ativado.
- Copiar resposta preservando texto e referências, com confirmação apenas se a cópia funcionar.
- Mostrar/ocultar senha sem alterar o valor ou impedir o preenchimento automático.
- Estado de processamento ligado à requisição, mantendo as proteções de envio pendente.
- Busca no histórico **por título**, sem distinção de acentos; não é busca no conteúdo completo das conversas.
- Filtro dos avisos pelas categorias existentes, sem inventar estados como “encerrado” sem dados confiáveis.
- Acabamento de termos e privacidade: idioma, título, leitura, tipografia e navegação. Não houve certificação jurídica dos textos.
- Textos das notificações alinhados ao comportamento observado do backend. Preferência completa de ativar/desativar entrega continua pendente.
- Remoção do botão de anexo que não tinha implementação.

A organização do CSS foi incremental. **Não foi concluída uma limpeza integral da cascata**, nem uma reconstrução de todos os estilos.

### Landing

Foi construída uma versão local baseada no Figma, com apresentação, marcas oficiais, benefícios, notebook ilustrativo, três etapas, serviços, chamada final e rodapé. Depois vieram os ajustes solicitados:

- Preenchimento da largura da janela, eliminando as faixas laterais externas percebidas pelo usuário.
- Redução de proporções: títulos principais de 48 para 40 px e apresentação de 816 para 660 px de altura mínima naquela revisão.
- Limitação da altura do notebook no desktop, preservando a arte inteira.
- Remoção do fundo lateral que competia com a imagem do notebook; máscaras e degradês nas artes decorativas para suavizar as transições entre blocos.
- Animações discretas: entrada única de cards, deslocamento de 8 px, duração de 350 ms, atraso de 100 ms e leve escala dos ícones. Botões com microinterações curtas.
- Conteúdo visível sem JavaScript e respeito a `prefers-reduced-motion`.

**Não foram implementados:** parallax, linha animada das etapas, header persistente/translúcido, barra de progresso, brilho seguindo o mouse ou contadores. Não inventamos estatísticas. A landing foi considerada boa pelo usuário; esses efeitos não são uma lista de execução obrigatória.

Arquivos centrais: `public/index.html`, `public/Landing-Page/landing.css`, `animacoes-scroll.css`, `animacoes-scroll.js` e `navegacao-secoes.js`.

### Imagens e logos

Três fundos existentes receberam cópias WebP sem perda, com comparação dos pixels decodificados naquela entrega. O total correspondente passou de **3.995.671 para 2.789.098 bytes**, aproximadamente **30,2%** menos nos arquivos transferidos. Isso não mede o peso total atual da landing. Os PNGs originais foram mantidos; as logos oficiais não foram recomprimidas.

### Chat, lateral e cabeçalho

- Histórico com rolagem interna e espaço reservado para o campo de escrita; suporte a várias linhas, Enter para enviar e Shift+Enter para quebrar linha.
- Consideração da altura visual no celular, mantendo o zoom nativo. Teclado em aparelho físico ainda precisa ser validado.
- Lateral desktop recolhível de **196 px para 76 px**, com preferência local, ícones identificados e possibilidade de rolar o menu.
- Caixas de seleção, hover e foco nos links. “Novo chat” tem borda, sombra discreta e reflexo único ao receber hover/foco, sem brilho contínuo.
- No celular, gaveta sobreposta: fundo inerte, foco contido, Escape/clique fora/seleção fecham o menu e devolvem o foco. Sem JS, a navegação original continua visível.
- Cabeçalho simplificado após o usuário pedir menos aparência de IA: faixa simples, identificação “Sylvinho”, nome e foto da conta quando houver; ícone neutro quando não houver foto. Sem cápsula de perfil, iniciais vermelhas ou seta de dropdown.

| Referência atual | Medida local documentada |
|---|---:|
| Lateral expandida / recolhida | 196 / 76 px |
| Logo da lateral | 130 px de largura |
| Novo chat no desktop | 48 px de altura mínima; fonte 16 px |
| Links laterais | Fonte 14 px; área mínima 44 px; intervalo 20 px |
| Cartões da Home | Mínimo 108 px desktop / 72 px celular |
| Campo de escrita | Área mínima 48 px; texto 16 px no celular |
| Cabeçalho | Aproximadamente 49 px, com alvos de toque de pelo menos 44 px |

O usuário **não havia aprovado a escala compacta anterior da lateral**. A revisão posterior usou a publicação como referência de tamanho. Também foi constatado zoom de 80% em `127.0.0.1`, frente a 100% na publicação; a comparação em `localhost` foi medida em 100%. Não devemos aumentar o CSS artificialmente para compensar zoom diferente entre abas.

Arquivos centrais: `public/Logado/shell.css`, `public/Arquivos-Universais/ui.js`, `public/Logado/Home/home.html`, `home.css`, `home.js` e `public/Chat/chat.css`. O estilo compartilhado foi incluído nas seis páginas logadas.

### Atualização brusca: diagnóstico e pendência

Na amostra de aproximadamente 12 segundos, não houve navegação automática. Isso não prova ausência de recarga em qualquer circunstância. As recargas manuais feitas durante verificações no navegador também podiam aparecer ao usuário; novas verificações repetitivas devem preferir uma janela isolada/headless.

O recolhimento desktop ainda desloca a lateral e o conteúdo de 196 para 76 px sem transição de largura/margem. Existe transição de `transform`, mas **a mudança de distribuição do espaço permanece brusca**. O diagnóstico foi registrado em `.cache/shell-review/diagnostico-salto.json`; o acabamento desse comportamento não foi implementado.

## 4. As três imagens propostas para o tema claro

**Foram avaliadas visualmente; não foram aplicadas, copiadas ao projeto ou recomprimidas.** A autorização atual é para este relatório.

| Imagem em Downloads | Uso sugerido | Cuidados |
|---|---|---|
| `Ondas Vermelhas em Fundo Tecnológico.png` | Possível fundo de login/cadastro, com formulário sobre área calma. | Essas páginas hoje permanecem escuras. Usá-la exigiria aprovar a mudança de escopo do tema público, além de testar recorte e contraste. |
| `Interface Futurista com Balão de Chat.png` | Possível ilustração pontual da landing. | O balão central compete com conteúdo e reforça a aparência de IA que o usuário pediu para reduzir no cabeçalho. Evitar como fundo do histórico. |
| `Circuitos Diagonais em Vermelho e Cinza.png` | Melhor candidata para a área logada clara, Home/chat e conversas. | Manter mensagens, cartões, menu e cabeçalho sobre superfícies legíveis; avaliar recorte móvel. |

Hoje o tema claro usa uma camada branca sobre fundos existentes. Uma arte realmente clara pode melhorar a continuidade visual, mas isso precisa ser conferido com os textos e componentes reais. Antes de implementar: medir dimensões/peso, preservar originais, preparar cópias se necessário, testar contraste, campos, foco, nomes longos e ausência de emendas. Não trocar as três artes de uma vez sem comparar os resultados.

## 5. O que fizemos na IA e na base

### Inventário e curadoria

O levantamento original identificou **290 trechos únicos: 286 do Regimento Comum e quatro sínteses de contato**. O inventário cobre secretaria, matrícula, documentos, calendário, avaliação/frequência, transferência/cancelamento, estágio/TCC, benefícios, regras gerais e cursos. As categorias se sobrepõem; suas contagens não devem ser somadas como documentos distintos. “Conteúdo localizado” não significa procedimento atual completo ou resposta segura.

Principais lacunas: canais e passos operacionais da escola, prazos de emissão, custos, horários atuais da Secretaria, oferta atual de cursos, regras por turma, formulários e procedimentos de estágio/TCC. O corpus antigo não tratava TCC expressamente com a completude necessária.

Estado conferido em `knowledge-local/resumo.json`:

| Conjunto | Quantidade / situação |
|---|---|
| FAQ aprovada atual | **44 entradas**, incluindo os sete contatos públicos |
| Propostas da Parte B | **131**, fora do índice aprovado |
| Perguntas originais mapeadas | **200** |
| Perguntas com alguma alegação recebida | **96**, não necessariamente confirmadas |
| Perguntas originais sem dado recebido | **104**, sem resposta inventada |
| Contatos liberados individualmente | **7: três WhatsApps e quatro e-mails institucionais** |
| Base original de 290 | Preservada; não alterada pela curadoria |

Essas listas têm sobreposição. Não somá-las como número de fatos independentes. As 44 entradas não representam curadoria completa de todos os 290 trechos.

Regras importantes preservadas:

- Camiseta em torno de R$ 50, declaração em até um dia, renovação via NSA, merenda às 10h20 e TCC no terceiro ano com banca continuam `em_revisao`, fora do índice.
- A resposta pode usar somente a parte oficial confirmada, sem acrescentar o procedimento informal.
- Matrícula: a partir de 16 anos pelo próprio candidato; abaixo de 16 pelo representante legal, conforme art. 64 e a decisão registrada. Saída antecipada de menor de 18 é outro assunto e usa a fonte local com suas condições/exceções.
- PTD corrigido para **art. 104-VIII**. As demais divergências e exceções estão no relatório específico; não simplificar normas removendo condições.
- Horário geral da escola não é horário da Secretaria. Calendário 2026 não responde automaticamente sobre 2027 ou qualquer curso.
- Os sete contatos têm aprovação própria e origem pública registrada. Nenhum contato pessoal adicional entra na lista por semelhança.
- Instagram: esquema e coleção vazia preparados; nenhum post foi coletado/aprovado.

### Busca e geração

A composição curada local combina busca lexical e vetorial. Status, evidência, vigência, conflitos, substituições e escopo são filtrados antes do ranking. São considerados até 15 candidatos e selecionados até cinco. O escore é heurístico, não uma probabilidade de correção.

O código atual usa como padrão **`gemini-3-flash-preview`**, reserva **`gemini-2.5-flash`** e embeddings **`gemini-embedding-001`**, configuráveis por ambiente. Isso é configuração conferida no código; não comprova qual modelo está atendendo um processo ativo ou a publicação neste instante.

Foram adicionados geração estruturada, revisão semântica, controle de números não sustentados, contexto de acompanhamentos e separação de assuntos próximos. Curso, idade, ano e turno vêm do que o usuário informou, sem assumir dados pessoais. O estilo buscado é simples e direto, sem jargão técnico ou perguntas finais automáticas.

Resposta natural vem primeiro; referências ficam disponíveis conforme o fluxo, inclusive pedido explícito de fontes na composição curada. O frontend preserva suporte a referências expansíveis. **Não há abertura universal de documento com URL confiável concluída para toda fonte**; não criar links a partir da prosa gerada.

### Falha, continuidade e desempenho

- Falha técnica passou a ser distinguida de informação institucional não confirmada.
- Novas falhas técnicas não são salvas como respostas factuais do bot; o histórico antigo não foi reescrito.
- Retry manual preserva pergunta, conversa e `messageId`, respeita espera e bloqueia cliques repetidos. Recarregar não deve disparar uma nova tentativa técnica automaticamente.
- Se uma resposta já foi persistida, a repetição recupera o resultado sem criar outro bot.
- Pedido de atendimento humano usa o contato público aprovado sem chamar Gemini nem abrir WhatsApp automaticamente.
- Cache em memória, até cinco minutos e 128 entradas, somente para respostas geradas e aprovadas. Chave considera conta, contexto e versões relevantes; não é cache público de conversas nem banco remoto.
- Cotas 429 e indisponibilidade 503 continuam possíveis. Não há API gratuita ilimitada comprovada; reserva e recuperação não eliminam limites.

## 6. Questionário para alimentar a base

O documento completo possui **480 perguntas, em 24 lotes/categorias de 20**. Preserva as 200 originais e acrescenta 280; o verificador registra IDs únicos, ausência de duplicatas exatas normalizadas e **zero respostas novas preenchidas**.

Além das dez categorias originais, há contatos/confirmação, Vestibulinho, exceções de matrícula, rotina escolar, uniforme/alimentação, sistemas, acessibilidade, infraestrutura/biblioteca, detalhes de estágio/TCC, avaliação/família, oferta de cursos, segurança/privacidade, gestão da base e projetos/participação.

Arquivo para responder: [QUESTIONARIO-COMPLETO-SYLVINHO.md](questionario-secretaria/QUESTIONARIO-COMPLETO-SYLVINHO.md). Estrutura técnica: `questionario-completo.json` e `verificacao.json` na mesma pasta.

Cada resposta nova deve registrar pergunta/ID, variações, resposta, categoria, aplica-se a, vigência inicial/final quando pertinente, quem confirmou — setor ou autoridade competente —, data, origem/evidência, status e versão. Não expor dados pessoais desnecessários. Dúvida sem confirmação permanece pendente; resposta de aluno entra em revisão. Depois de aprovada: validar conflitos/escopo, gerar a coleção e o índice local, testar recuperação e resposta, e só então considerar futura importação mediante autorização.

## 7. Resultados de verificação e seus limites

**Não somar os números abaixo:** há conjuntos sobrepostos e momentos diferentes. Esta consolidação não executou novamente esses testes.

| Rodada documentada | Resultado registrado | O que não comprova |
|---|---|---|
| Landing | Nove grupos em sete tamanhos: 1440×900, 1903×945, 2560×1080, 1024×768, 768×800, 390×844, 320×640 | Não mede qualidade estética ou serviços reais. |
| Animações | 36 cenários, incluindo JS desativado, movimento reduzido e falhas de APIs | Não certifica todos os navegadores/aparelhos. |
| Chat responsivo recente | 51 cenários com histórico longo, janela baixa, multiline e gaveta | Usa prévia visual; teclado físico/virtual real ainda pendente. |
| Navegação recente | 69 verificações de layout em 13 páginas, mais interações; sem erros JS/pedidos externos na prévia | Não comprova login ou permissões reais. |
| Regressão recente da interface | 98 testes selecionados passaram; um caso dependente de fixture foi excluído explicitamente | Não é a suíte completa do repositório. |
| Curadoria inicial | 260 regressões de referência + 24 novos; depois 290, 300 e 310 em rodadas sucessivas | Não afirmar que 310 foram repetidos depois de cada ajuste visual. |
| Recuperação/política curada | 56/56 offline | Não são 56 respostas realmente geradas pelo Gemini. |
| Ativação local real | Renovação 7,282 s; acompanhamento 2,618 s; fontes 0,548 s; informação informal 0,229 s; persistência/replay/401 verificados | Fluxos determinísticos e geração têm custos distintos; amostra pequena. |
| Avaliação posterior de 50 perguntas | Oito chamadas de geração/revisão; duas respostas geradas e validadas, média 2,980 s; 48 pendentes após limite | Não certifica 95% de precisão, meta global de latência ou funcionamento 100%. |
| Build/lint de Functions | Aprovados nas rodadas documentadas da IA | Não foram executados novamente nesta entrega documental. |

Há uma fixture ausente: `tests/dados/rag-original.json`, usada pelo caso “formato real gerado”. Nos testes da navegação, cinco falhas adicionais do contexto simulado foram corrigidas incluindo temporizadores no teste; isso não alterou a autenticação da aplicação. O comando `npm test` da raiz ainda é um placeholder que retorna erro e não representa as suítes reais.

Comandos da última verificação de interface, a executar somente em tarefa de teste apropriada:

```powershell
node --test --test-skip-pattern="formato real gerado" tests/home-assistente.test.mjs tests/assistente-client.test.mjs tests/resposta-documental-view.test.mjs tests/session-navigation.test.mjs
node scripts/verificar-chat-responsivo.mjs
node scripts/verificar-shell-local.mjs
```

Evidências: `.cache/shell-review/`, `.cache/ui-review/responsive/`, `.cache/landing-review/`, `.cache/curadoria-sylvinho/` e JSONs em `docs/curadoria-local/`. Capturas e relatórios são evidências de um momento, não monitoramento contínuo.

## 8. Publicação e Figma

Na revisão da publicação foram consultadas 14 rotas/47 URLs locais únicas e feitas 36 medições em nove telas. O campo do chat ficava abaixo da primeira tela em 320×640 e 390×844. Duas conversas existentes exibiam pergunta sem resposta do assistente; isso não determina a causa nem prova falha de toda geração. Serviços registrou erro ao acessar `#whatsapp-status` ausente. Termos/privacidade publicados ainda tinham metadados e apresentação antigos.

Esses achados pertencem à revisão registrada em [REVISAO-SITE-HOSPEDADO-2026-11-12.md](REVISAO-SITE-HOSPEDADO-2026-11-12.md). Não houve nova auditoria remota nesta consolidação. A sessão consultada era administrativa; operações de escrita não foram exercitadas.

No Figma, as capturas atuais são [desktop 344:63](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=344-63) e [mobile 345:63](https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=345-63). Os frames 339–343 permanecem como histórico da versão anterior. Os originais foram preservados.

O fluxo de captura confirmou a inclusão dessas telas. Porém, o plano Starter bloqueou biblioteca/busca/edição direta e parte da verificação posterior. As capturas **não equivalem a biblioteca de componentes, variantes e protótipo finalizado**. Organização, componentização e homologação completa continuam pendentes. A ponte de captura fica fora de `public/` e foi encerrada após o uso.

## 9. O que falta e como avançar

| Prioridade | Trabalho proposto | Como considerar concluído |
|---|---|---|
| 1 | Fechar a aprovação visual da escala, lateral e cabeçalho em zoom equivalente; suavizar o recolhimento desktop. | Sem salto incômodo, sem cortar campo/textos, respeitando movimento reduzido e mantendo as medidas aprovadas. |
| 2 | Decidir e testar o fundo claro, começando pela candidata de circuitos. | Comparação antes/depois aprovada, contraste e recortes conferidos, sem mexer nas logos/originais. Nada aplicado ainda. |
| 3 | Testar em Android e iPhone reais, teclado aberto, orientação horizontal e zoom. | Campo acessível, foco e gaveta corretos, rolagem previsível e nenhuma perda de conteúdo. |
| 4 | Concluir avaliação de pelo menos 50 respostas reais com orçamento de cota e amostra independente. | Relatar sustentação factual, exceções, recuperação, linguagem, p50/p95 e falhas; não medir só presença de palavras. |
| 5 | Receber e revisar o questionário com a Secretaria. | Origem, data, setor, escopo e vigência registrados; pendências não entram no índice. |
| 6 | Ampliar a curadoria do corpus e o contrato de fontes. | Mais temas respondidos com segurança e abertura de documento somente com destino confiável. |
| 7 | Exercitar fluxos reais em ambiente de teste: login/cadastro/recuperação, aluno/admin, histórico e avisos. | Isolamento de contas e permissões verificados; nenhuma mensagem enviada a pessoas reais. |
| 8 | Revisar textos institucionais, preferências de notificação, desempenho e CSS legado. | Conteúdo corresponde ao comportamento; medição representativa; remoções sem regressão. |
| 9 | Organizar Figma e preparar uma futura entrega em branch de teste. | Design representa a versão aprovada; diff completo revisado; commit/push/deploy somente após instrução explícita. |

WhatsApp permanece adiado. Não reabrir mudanças amplas da landing só para acrescentar efeitos. A lista é proposta de sequência; **a criação deste relatório não autoriza executá-la**.

## 10. Skills, ECC e MCP

ECC é o conjunto de skills e práticas; não é um serviço que prova sozinho o funcionamento do site. MCP conecta ferramentas. Ter a ferramenta carregada não demonstra que todas as operações remotas estejam disponíveis.

### MCPs disponíveis e uso esperado

| MCP | Estado conhecido / papel |
|---|---|
| Chrome DevTools | Ferramentas presentes nesta sessão; usado anteriormente para inspeção real. Preferir testes repetitivos isolados para não recarregar a aba pessoal. |
| Figma | Ferramentas presentes; capturas funcionaram, com limites do plano para outras operações. Ler as instruções específicas do servidor antes de usar. |
| Firebase | Ferramentas presentes; usar identificação/leitura quando necessário. Nenhuma importação/escrita de produção está autorizada. |
| shadcn/ui | Consulta de comando já respondeu; nenhum componente foi instalado. Consultar apenas se fizer sentido para a estrutura existente. |
| 21st / Magic | Conexão já verificada. Última consulta de uso registrava duas recuperações de código disponíveis e geração IA desativada; isso não é uma cota atual garantida. Conferir uso antes de ação limitada e não consumir por exploração desnecessária. |

Nesta entrega foi conferida a presença dessas ferramentas no catálogo; não foram feitas novas chamadas aos serviços para testar autenticação ou consumir componentes. Credenciais ficam fora dos artefatos.

### Skills relevantes para o próximo chat

Não é necessário executar todas em toda tarefa. Ler o `SKILL.md` da skill escolhida, explicar o uso e aplicar apenas o que corresponde ao escopo. Adaptar recomendações de frameworks ao HTML/JS existente.

| Objetivo | Skills |
|---|---|
| Continuidade e documentação | `ecc:living-docs-governance`, `ecc:codebase-onboarding`; `ecc:context-and-decisions` quando houver ambiguidade de termos. |
| Preservar identidade e desenhar ajustes | `frontend-design`, `ecc:inherit-legacy-style`, `ecc:frontend-design-direction`, `ecc:make-interfaces-feel-better`; `ecc:design-system` se houver tarefa de componentes. |
| Revisão visual e acessibilidade | `web-design-guidelines`, `ecc:accessibility`, `ecc:frontend-a11y`. |
| Animações | `ecc:motion-foundations`, `ecc:motion-patterns`; aplicar movimento reduzido e evitar custo de layout. |
| Impacto e navegação | `ecc:change-impact`, `ecc:click-path-audit`. |
| Testes de interface | `ecc:browser-qa`, `ecc:e2e-testing`, `ecc:verification-loop`. |
| IA, RAG e conhecimento | `ecc:knowledge-ops`, `ecc:iterative-retrieval`, `ecc:eval-harness`, `ecc:ai-regression-testing`, `ecc:cost-aware-llm-pipeline`, `ecc:error-handling`. |
| Backend e segurança | `ecc:backend-patterns`, `ecc:api-design`, `ecc:security-review`, conforme a alteração. |
| Encerramento | `ecc:agent-self-evaluation`, com evidências e limites explícitos. |
| Documentos e PDFs | `documents:documents` e `pdf:pdf`, somente quando o formato ou a leitura exigirem. |
| Descoberta/instalação | `find-skills`, `skill-installer`, `plugin-management:plugin-management`, somente se a tarefa exigir algo ausente. Não instalar por padrão. |

Raiz ECC disponível nesta máquina: `C:\Users\jvict\.codex\plugins\cache\ecc\ecc\2.2.3\skills\<nome>\SKILL.md`. Skills pessoais: `C:\Users\jvict\.agents\skills\<nome>\SKILL.md`. Outros caminhos devem ser obtidos no catálogo da nova sessão, porque versões podem mudar. Para Figma, consultar também os recursos/instruções próprios do servidor; uma skill de frontend não os substitui.

## 11. Arquivos, backups e reversão

O Git tem numerosos arquivos modificados e não rastreados de várias entregas. **Não atribuir todo o diff à tarefa mais recente**. Esta consolidação acrescenta somente este relatório e o prompt de continuidade.

Referências principais:

- [Interface atual, medidas, Figma e testes](INTERFACE-NAVEGACAO-LOCAL.md).
- [Revisão inicial da interface](REVISAO-INTERFACE-LOCAL.md), [landing](LANDING-FIGMA-LOCAL.md) e [animações](ANIMACOES-LANDING-LOCAL.md).
- [Histórico geral anterior](RELATORIO-PROJETO-E-ALTERACOES.md). Seus estados “Figma não alterado” e “integração pendente” foram superados pelas entregas posteriores; conservar a cronologia.
- [Etapas 0–5 da curadoria](curadoria-local/RELATORIO-ETAPAS-0-A-5.md), [divergências](curadoria-local/DIVERGENCIAS-E-PENDENCIAS.md), [ativação](curadoria-local/ATIVACAO-CHAT-LOCAL.md), [retry](curadoria-local/FALHAS-E-NOVA-TENTATIVA-LOCAL.md) e [contexto/cache/avaliação](curadoria-local/CONTEXTO-CACHE-E-AVALIACAO.md).
- [Inventário e lacunas dos 290 trechos](levantamento-base/LEVANTAMENTO-COBERTURA-E-LACUNAS.md) e [questionário completo](questionario-secretaria/QUESTIONARIO-COMPLETO-SYLVINHO.md).

Backups documentados: `C:\Programação\Backups\sylvinho-ui-20261111\public`, `.cache/landing-before/`, `.cache/landing-before-animacoes/`, `.cache/interface-shell-before-2026-11-12/` e `.cache/header-before-2026-11-12/`. As rodadas da IA possuem backups próprios referenciados em seus relatórios. Conferir existência, manifesto e alterações posteriores antes de restaurar.

`scripts/reverter-shell-local.mjs` permite conferir a reversão sem aplicar; `--aplicar` restaura os oito arquivos públicos listados no manifesto e remove o CSS novo, após validar hashes. Não reverte Figma, documentação, testes ou todo o projeto. **Não executar a aplicação da reversão apenas porque este relatório contém o comando.** Para a IA, seguir o backup específico da rodada e preservar conversas locais.

Critério para uma futura entrega: revisar escopo/diff, conferir funcionamento real separado da prévia, registrar testes e falhas, preservar originais e solicitar apenas a autorização final que ainda não exista para commit/publicação.

O prompt para transferir este contexto está em [PROMPT-NOVO-CHAT-SYLVINHO.md](PROMPT-NOVO-CHAT-SYLVINHO.md).
