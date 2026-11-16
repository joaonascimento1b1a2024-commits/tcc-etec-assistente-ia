# Prompt de continuidade — Sylvinho

Atualização posterior: o usuário aprovou o teste local de IA e autorizou commit/push somente em `release/tcc-candidate`. Ver `docs/RELEASE-TCC-CANDIDATE.md` para escopo, evidências e limites. Main e deploy continuam sem autorização. Os registros abaixo de ausência de commit e aprovação pendente descrevem momentos anteriores; conferir o Git atual.

Copie o bloco abaixo para um novo chat que tenha acesso à pasta do projeto. Este prompt transmite contexto; não autoriza executar todas as melhorias propostas.

```text
Você dará continuidade ao projeto Sylvinho, TCC da ETEC Sylvio de Mattos Carvalho, em Matão. Responda em português simples e trabalhe com evidências. Quero preservar o trabalho existente e melhorar gradualmente, sem reconstruir o projeto.

AMBIENTE
- Windows / PowerShell, workspace C:\Programação.
- Principal: C:\Programação\tcc-etec-assistente-ia.
- Complementar: C:\Programação\sylvinho-backend.
- Frontend em public/, HTML/CSS/JS; Functions TypeScript no principal. Não migrar para React, Next, Tailwind ou shadcn por iniciativa própria.
- Publicação: https://sylvinho.web.app/.
- Firebase configurado: tcc-ia-d8891; target Hosting sylvinho. Não confundir com o projeto antigo da chave Gemini.
- Figma: o12zEQuWX9XfnKaOzhD3Dl, TCC — Front.

PRIMEIRO PASSO: SOMENTE LEITURA E CONTINUIDADE
1. Leia os AGENTS.md aplicáveis e confira o Git sem alterar nada. Há muitas mudanças locais e arquivos novos de várias entregas: preserve todos.
2. Leia docs/RELATORIO-CONSOLIDADO-SYLVINHO-2026-11-12.md e os documentos específicos necessários à tarefa, especialmente docs/INTERFACE-NAVEGACAO-LOCAL.md.
3. Para IA, leia os registros mais recentes de docs/curadoria-local/: ATIVACAO-CHAT-LOCAL.md, FALHAS-E-NOVA-TENTATIVA-LOCAL.md e CONTEXTO-CACHE-E-AVALIACAO.md. O relatório das etapas 0–5 é anterior à ativação. Resolva diferenças pela cronologia e pelo código atual.
4. Confira o que existe, quais serviços estão realmente ativos e quais ferramentas/skills a nova sessão oferece. Não presuma que um processo ou uma conexão antiga continua funcionando.
5. Apresente um resumo curto do estado e a próxima prioridade recomendada. Sem uma tarefa nova explícita minha, não implemente as sugestões nem aplique as imagens. Quando eu der uma tarefa, execute o que já estiver autorizado sem pedir novamente aprovações rotineiras.

REGRAS PERSISTENTES
- Sem commit, push, deploy, importação no Firebase de produção ou escrita remota. Branch de teste/publicação só quando eu mandar explicitamente.
- Tudo local e reversível. Não usar git reset --hard, git clean, checkout/restauração ampla ou stash pop para desfazer uma entrega. Compare backups e preserve alterações posteriores.
- Poppins, identidade preta/vermelha, logos oficiais, documentos e imagens originais preservados. Otimização apenas em cópias adequadas; não recomprimir logos/documentos.
- WhatsApp fica fora das alterações por enquanto. Não enviar mensagens, e-mails ou acionar canais reais. Contato público no texto não significa integração operacional.
- Preservar autenticação, permissões, isolamento entre contas, histórico e IDs de envio; sem afrouxar segurança para fazer teste passar.
- Manter RAG. O teste temporário sem RAG foi revertido por minha solicitação. Não reativar modo sem RAG automaticamente.
- Não inventar fatos, URLs, preços, prazos, regras, estatísticas, testes ou disponibilidade da IA. Separar falta de dado de falha técnica e de limite de cota.
- Não imprimir/copiar chaves ou tokens para código, relatórios, logs ou prompts. Não ler arquivos de segredos só para diagnosticar visual.
- Figma só deve ser alterado quando a tarefa atual incluir sincronização de design; preservar frames antigos. Não usar geração paga ou consultas limitadas sem necessidade.

ESTADO DA INTERFACE
- Revisão de navegação posterior: docs/NAVEGACAO-DESKTOP-SUAVE-LOCAL.md. Corrigido salto de 120 px durante troca de páginas, com shell-init.js no head, estado inicial da lateral, SVG/rótulos estáticos e dimensões da logo reservadas. Desktop tem transição nativa de 280 ms; links/Voltar/Avançar permanecem nativos. Respeita movimento reduzido e preserva a experiência móvel anterior. Doze combinações de primeira pintura passaram, sem salto horizontal/vertical mesmo com ui.js atrasado; ensaio final sem erros. Sem publicação ou alteração da IA.
- Fechamento posterior: docs/FECHAMENTO-MOBILE-E-VALIDACAO-LOCAL.md. Gaveta respeita altura visual com teclado simulado; oito cenários móveis e 69 verificações de layout passaram. Nesta rodada passaram 185 testes selecionados, build/lint e regras reais nos emuladores com JAR local existente. Login completo no navegador ficou inconclusivo por bloqueio de rede do SDK público Firebase; não é falha de autenticação confirmada. Sem aparelho físico/Safari. Imagens adiadas.
- Landing local já recebeu composição baseada no Figma, largura total, proporções menores e transições suaves nas artes. O usuário considera a landing boa.
- Cards/ícones têm entradas discretas; botões têm microinterações; reduced-motion e ausência de JS foram considerados. Parallax, conector animado, barra de progresso e contadores NÃO foram implementados. Não adicionar por obrigação.
- Poppins local, SVGs, copiar resposta, mostrar senha, processamento, busca de histórico por título e filtro por categoria estão implementados.
- Tema da conta é restrito a /Logado/. Páginas públicas continuam escuras. Não ativar tema público por acidente.
- Chat com histórico rolável e campo reservado. Correção móvel posterior: removido conflito de altura mínima com VisualViewport, suporte a toque na horizontal e limite multilinha pela altura útil; chat visitante compacta cabeçalho/espaços abaixo de 360 px úteis. Oito cenários de teclado simulado passaram; teclado de aparelho físico/Safari continua pendente. Ver docs/CELULAR-E-VERIFICACOES-LOCAIS.md. Imagens adiadas pelo usuário.
- Lateral desktop: 196 px expandida / 76 px recolhida; logo 130 px; Novo chat 48 px mínimo e fonte 16 px desktop; links fonte 14 px, área mínima 44 px, espaçamento 20 px.
- No celular, gaveta modal com foco contido, fundo inerte e fechamento por Escape/clique fora/seleção. Sem JS, menu original acessível.
- Cabeçalho atual simples: Sylvinho e perfil, sem cápsula arredondada, iniciais vermelhas ou seta de dropdown. Pedido do usuário: menos aparência de IA.
- O usuário NÃO havia aprovado a escala compacta anterior. A revisão posterior tomou a publicação como referência de tamanho.
- Atenção ao zoom: 127.0.0.1 estava em 80% e a publicação em 100%; localhost foi medido em 100%. Não compensar zoom diferente aumentando o CSS globalmente.
- Recolhimento desktop recebeu transição local sincronizada de 180 ms entre 196 e 76 px, desativada com movimento reduzido. Ver docs/RECOLHIMENTO-DESKTOP-LOCAL.md: 98 testes selecionados, 69 verificações de layout, 51 cenários responsivos e ensaio específico de movimento passaram nessa rodada. Aprovação visual pelo usuário e aparelho físico continuam pendentes. Uma amostra anterior de 12 s não teve navegação automática; isso não prova ausência universal de recargas. Preferir janela isolada/headless nos testes.
- Arquivos-chave: public/Logado/shell.css; public/Arquivos-Universais/ui.js, theme.js, theme.css; public/Logado/Home/; public/Chat/; public/Landing-Page/.

IMAGENS CLARAS: SOMENTE PROPOSTAS, NÃO APLICADAS
Estão em C:\Users\jvict\Downloads:
1. Ondas Vermelhas em Fundo Tecnológico.png — candidata para login/cadastro, mas hoje essas páginas são públicas escuras; a mudança exige decisão de escopo.
2. Interface Futurista com Balão de Chat.png — possível ilustração pontual da landing; evitar como fundo da conversa, pois compete com o conteúdo.
3. Circuitos Diagonais em Vermelho e Cinza.png — candidata preferida para área logada/chat no tema claro.
Não copiar/aplicar/recomprimir só por receber este prompt. Antes de eventual implementação, preservar originais, medir peso/dimensões, testar recorte móvel, contraste e continuidade; manter superfícies legíveis para mensagens, cartões, menu e header.

IA E CONHECIMENTO
- Corpus original: 290 trechos preservados, 286 do Regimento e quatro sínteses de contato.
- knowledge-local/resumo.json registra 44 entradas aprovadas, 131 propostas da Parte B fora do índice, 200 perguntas originais mapeadas, 96 com alegações recebidas, 104 sem dado e sete contatos públicos liberados individualmente. As listas se sobrepõem; não somar como fatos independentes.
- 44 entradas não significam curadoria completa dos 290 trechos.
- Camiseta ~R$50, declaração em até um dia, renovação por NSA, merenda 10h20 e TCC no terceiro ano com banca continuam em_revisao, fora do índice, até confirmação rastreável.
- Matrícula: a partir de 16 pelo próprio candidato, abaixo de 16 pelo representante legal (art. 64). Saída antecipada de menor de 18 é regra local distinta, com condições/exceções. PTD: art. 104-VIII. Consulte DIVERGENCIAS-E-PENDENCIAS.md; não eliminar exceções das normas.
- Horário geral da escola não é horário atual da Secretaria. Não aplicar calendário 2026 a 2027 ou a todo curso sem evidência.
- Gemini curado local: padrão no código gemini-3-flash-preview, reserva gemini-2.5-flash, embeddings gemini-embedding-001, configuráveis. Confira runtime/health antes de dizer que estão ativos.
- Busca híbrida lexical/vetorial com filtros de status, vigência, evidência e escopo; geração estruturada e revisão semântica. Linguagem simples, natural, sem jargão técnico e perguntas finais automáticas.
- Contexto usa o que o usuário declarou. Falhas técnicas novas são distintas de falta de informação; retry manual preserva messageId e evita duplicação, inclusive após recarga. Não apagar respostas antigas para esconder falhas.
- Cache aprovado em memória por até cinco minutos e 128 entradas, segregado por contexto/conta/versões. Não compartilhar respostas privadas.
- Não há link universal confiável para abrir toda fonte; não inventar destinos a partir da resposta.
- Questionário: docs/questionario-secretaria/QUESTIONARIO-COMPLETO-SYLVINHO.md tem 480 perguntas, 24 lotes de 20, preservando 200 originais + 280 novas. Zero respostas novas preenchidas. Receber respostas com origem, setor que confirmou, data, escopo, vigência e status; revisar antes de indexar. Instagram permanece sem posts aprovados.

AMBIENTES E EVIDÊNCIAS
- Reativação posterior autorizada: docs/REATIVACAO-IA-CANDIDATA-LOCAL.md. Emuladores 5000/8080/9099 e adaptador 5002 foram ligados; health curado com 44 entradas. Uma pergunta real gerada/revisada pelo modelo principal passou em 3.063 ms e persistiu após recarga; sem token retornou 401. SDK oficial copiado apenas ao staging/cache para contornar bloqueio de rede do navegador. Confirmar processos atuais antes de alegar disponibilidade. Commit/push de release/tcc-candidate aguardam o usuário aprovar este teste local; nenhum commit novo ou deploy foi feito.
- node scripts/preview-ui.mjs -> http://localhost:4173/Logado/Home/home.html: SOMENTE prévia visual com fixtures; não valida IA/Firebase/login/e-mail.
- RAG real local usa emuladores, Hosting 5000, adaptador 5002, projeto demo-sylvinho-render-poc. Verifique portas antes de iniciar qualquer coisa. Inicialização documentada em ATIVACAO-CHAT-LOCAL.md: node local-e2e/history-run.mjs --keep-open --gemini-local; em outro terminal, node scripts/iniciar-rag-gemini-local.mjs --faq-curada. Não iniciar automaticamente só ao ler este prompt. Gemini externo pode consumir cota mesmo com Firebase emulado.
- Últimos resultados de interface documentados: 51 cenários responsivos, 69 verificações de layout em 13 páginas, 98 testes selecionados aprovados. NÃO foram repetidos na consolidação documental.
- Teste dependente de tests/dados/rag-original.json está pendente por fixture ausente; foi explicitamente excluído pelo nome. Não criar dado fictício para disfarçar a ausência.
- Histórico da IA: 260 de referência; depois conjuntos selecionados de 284/290/300/310. 56/56 offline de recuperação/política NÃO são 56 respostas Gemini.
- Avaliação real de 50: duas respostas geradas/validadas, média 2,980 s, após oito chamadas de geração/revisão; 48 pendentes por cota. Não declarar 100%, 95% de precisão ou latência global garantida.
- npm test da raiz é placeholder. Escolha comandos reais documentados e testes proporcionais ao diff; registre falhas/exclusões honestamente.
- Evidências em .cache/shell-review/, .cache/ui-review/, .cache/landing-review/ e .cache/curadoria-sylvinho/.
- Reversão da interface: scripts/reverter-shell-local.mjs tem modo de conferência e --aplicar com proteção por hashes. Não executar --aplicar sem solicitação; não desfaz todo o projeto/Figma/testes/docs. Há backups específicos para as demais rodadas.

FIGMA E MCP
- Capturas atuais: desktop https://www.figma.com/design/o12zEQuWX9XfnKaOzhD3Dl?node-id=344-63 e mobile ?node-id=345-63. Frames 339–343 são históricos, não a referência atual de escala/header.
- Capturas não equivalem a componentes reutilizáveis, variantes ou protótipo pronto. Plano Starter bloqueou biblioteca/busca/edição direta e parte da verificação. Não afirmar homologação total; confira disponibilidade da nova sessão.
- Use MCP Figma para tarefas de Figma e leia os recursos/instruções próprios da operação antes de agir. Preserve originais e não envie conversas privadas. O helper de captura está fora de public/.
- Chrome DevTools MCP para inspeção; Firebase MCP para identificação/leitura quando necessário; shadcn MCP só se pertinente, sem instalar framework por padrão; 21st/Magic apenas quando necessário.
- Última consulta 21st tinha duas recuperações de código disponíveis e geração IA desativada. É histórico, não saldo atual. Confira uso antes de consumir. Nunca gaste consultas de componentes só para explorar ou testar autenticação. Não inclua a chave no chat.
- Descubra ferramentas do catálogo da sessão em vez de presumir que todo MCP está conectado/autorizado. Ferramenta presente não significa serviço integralmente testado.

SKILLS: ESCOLHER CONFORME A TAREFA
Quero ECC usado com profundidade quando útil, sem executar todas as skills indiscriminadamente. Leia o SKILL.md escolhido e anuncie a aplicação. Skills não substituem evidência de testes. Respeite a estrutura existente e minhas restrições.

- Continuidade: ecc:living-docs-governance, ecc:codebase-onboarding; ecc:context-and-decisions quando houver ambiguidade de termos.
- Design: frontend-design, ecc:inherit-legacy-style, ecc:frontend-design-direction, ecc:make-interfaces-feel-better; ecc:design-system se houver tarefa real de componentes.
- Revisão/acessibilidade: web-design-guidelines, ecc:accessibility, ecc:frontend-a11y.
- Movimento: ecc:motion-foundations, ecc:motion-patterns, adaptados ao HTML/JS e reduced-motion.
- Impacto/fluxos: ecc:change-impact, ecc:click-path-audit.
- Testes: ecc:browser-qa, ecc:e2e-testing, ecc:verification-loop.
- IA/RAG: ecc:knowledge-ops, ecc:iterative-retrieval, ecc:eval-harness, ecc:ai-regression-testing, ecc:cost-aware-llm-pipeline, ecc:error-handling.
- Backend/segurança: ecc:backend-patterns, ecc:api-design, ecc:security-review quando pertinentes.
- Encerramento: ecc:agent-self-evaluation, relatando resultado, evidência, falhas e limites.
- documentos/PDFs: documents:documents e pdf:pdf quando o formato exigir.
- Descoberta/instalação somente se necessário: find-skills, skill-installer e plugin-management:plugin-management. Não instalar ferramentas extras por padrão.

Raiz ECC conhecida: C:\Users\jvict\.codex\plugins\cache\ecc\ecc\2.2.3\skills\<nome>\SKILL.md.
Skills pessoais: C:\Users\jvict\.agents\skills\<nome>\SKILL.md, incluindo frontend-design e web-design-guidelines. Caminhos e versões devem ser confirmados no catálogo atual. Leia também as instruções do MCP Figma quando aplicável.

PRÓXIMAS PRIORIDADES PROPOSTAS, AINDA SEM EXECUÇÃO AUTOMÁTICA
1. Fechar escala/header em zoom equivalente e suavizar recolhimento desktop.
2. Decidir/testar tema claro com as artes propostas.
3. Validar celular físico/teclado e acessibilidade.
4. Concluir amostra independente de respostas reais, com orçamento de cota, avaliação factual e latência.
5. Receber questionário confirmado, ampliar curadoria e fontes confiáveis.
6. Testar fluxos reais de conta/histórico/avisos em ambiente isolado; finalizar Figma e preparar futura branch apenas quando autorizado.

Não interprete estas propostas como autorização para mudar tudo. Comece pela leitura e diga o que confirmou e o que ainda precisa ser verificado. Depois seguiremos a tarefa que eu indicar.
```
