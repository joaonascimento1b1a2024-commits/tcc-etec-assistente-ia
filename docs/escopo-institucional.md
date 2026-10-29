# Restrição institucional — implementação local

## Diagnóstico e política
O fluxo OpenRouter aceitava `geral` no schema e instruía o modelo a responder conceitos e cálculos. Agora esse tipo é rejeitado. A política compartilhada em `escopo.ts` combina reconhecimento de objetivos externos, domínio positivo de serviços, interações sociais completas e continuidade resolvida pelo contexto autenticado. Não depende apenas de palavras proibidas nem da obediência ao prompt. Não é um classificador semântico universal: regras linguísticas locais desconhecidas pedem esclarecimento.

- A: institucional, com ou sem nome da escola — mantém recuperação e validação documental.
- B: social — resposta local natural, sem busca ou geração.
- C: externo ou tentativa reconhecida de mudar o papel — redirecionamento institucional local.
- D: ambíguo — contexto limitado já existente ou esclarecimento local.

Objetivos externos reconhecidos prevalecem em pedidos mistos, inclusive quando mencionam ETEC. A lista de serviços não autoriza publicação de conhecimento geral: no OpenRouter somente saídas documentais com evidências podem transportar texto gerado. Mensagens livres de conversa, esclarecimento, sem_base e fora_escopo são substituídas por respostas locais, mesmo depois da revisão. O tipo geral é inválido. Gemini/OpenAI diretos continuam exigindo evidências.

## Caminhos
Handler autenticado: após validação, replay e resolução de contexto, antes de RAG/geração; persiste respostas locais com o mesmo messageId pela transação existente.
Visitante: após validação/CORS/limites, antes de inicializar dependências; sem contexto recebido do cliente.
Busca compartilhada: dispensa leitura para mensagens não institucionais.
Compositor documental e gateway: proteção adicional para chamadas diretas e fallbacks.
Prompts e schema: removida permissão geral; revisão exige escopo institucional.
Demonstração de catálogo continua separada, sem aceitar pergunta livre nesse caminho. Nenhuma flag foi ativada.

## Exemplos
- Valor de pi? — antes: resposta geral relatada em produção; agora: redirecionamento institucional, sem provedor.
- Crie um jogo em Python — agora: mesmo redirecionamento, mesmo se mencionar ETEC.
- Como faço minha matrícula? — mantém RAG, fontes e regras de evidência.
- Olá! — apresentação institucional local.
- E o prazo? — consulta de prazo de matrícula quando o contexto anterior reconhecido é matrícula; sem contexto, pede o procedimento.

## Validação
Build TypeScript, ESLint e git diff --check aprovados. 429 testes selecionados aprovados, incluindo 35 novos em escopo-institucional.test.mjs. Suítes: escopo-institucional, qualidade-atendimento, rag-etapa2, contexto-conversacional, experiencia-atendimento, gemini-geracao, assistente-handler, chat-visitante, openrouter-conversa, openrouter-revisao, openrouter-contexto, assistente-client, conversation-store e resposta-ia-view.
Testes antigos que autorizavam conhecimento geral foram ajustados à política nova; fixtures de concorrência agora usam perguntas institucionais. Testes de revisão passaram a esperar três chamadas quando a saída final é local: não há classificação externa de texto local constante. Testes de privacidade continuam usando dados sintéticos e verificando bloqueios. Não foram feitas chamadas reais de IA.

## Limitações e riscos
- Reconhecimento linguístico fechado pode pedir esclarecimento ou recusar uma pergunta institucional não prevista; não promete compreensão semântica irrestrita.
- Perguntas mistas reconhecidas são recusadas integralmente; o usuário precisa separar a dúvida institucional.
- Mensagens livres geradas são substituídas por texto local: reduz personalização, mas impede conhecimento geral disfarçado nesses tipos.
- Saídas documentais continuam dependendo da qualidade do corpus e dos validadores/revisão existentes; não há garantia absoluta contra toda paráfrase maliciosa.
- Replay mantém respostas antigas já persistidas, inclusive eventual conhecimento geral anterior. Nenhum histórico foi reescrito.
- Resultados são locais e sintéticos. Suíte completa, corpus oficial e produção não foram certificados.
- Divergência de domínio identificada na auditoria anterior permanece fora desta alteração.

Sem frontend, Auth, regras ou estrutura do Firestore alterados. Dependências instaladas pelo lockfile, sem mudança de versões. Sem commit, push ou deploy.
