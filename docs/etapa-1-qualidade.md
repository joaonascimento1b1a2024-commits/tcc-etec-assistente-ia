# Etapa 1 — qualidade do atendimento

Auditoria e implementação local em 29/10/2026. Sem deploy, commit, mudanças
no frontend, Auth, regras, histórico, credenciais ou ativação de provedores.

## Fluxo auditado

1. `public/Logado/Home/home.js` salva a pergunta e seu identificador na conversa.
2. `assistente-client.js` envia token Firebase, pergunta, conversationId e messageId
   ao POST `/perguntarAssistente` no Render.
3. `render-poc/server.cjs` usa o adaptador CORS de `assistente/http.ts`.
4. `handler.ts` valida o token, acessa `users/{uid}/conversas/{conversationId}`
   e confirma que o identificador corresponde à pergunta salva. Replay devolve
   a resposta existente sem gerar novamente.
5. `render-poc/documental.cjs` compõe `pergunta-livre/fluxo.ts`: consulta
   `conhecimento` ativo, seleção lexical restrita a fontes autorizadas e gateway.
6. `geracao/gateway.ts` prepara o baseline documental e verifica usuário,
   ativação, provedor, aprovações, retenção, evidências e limites.
7. Gemini direto usa `GEMINI_MODEL`; OpenRouter usa `OPENROUTER_MODEL` e pode
   encaminhar a um modelo Gemini. O modelo do arquivo de exemplo não comprova
   configuração do serviço. O gerador Gemini legado não integra esta composição.
8. O fluxo gerativo classifica entrada, propõe, revisa e classifica saída.
   Citações, referências, números, formatos e limites continuam validados.
9. O handler persiste somente o bot, em transação; a Home relê o histórico.

O modo de execução chamado `documental` pode selecionar geração autorizada.
O Gemini direto exige evidências; respostas gerais são implementadas no fluxo
OpenRouter. O visitante não fornece UID para a allowlist e fica documental.
As Cloud Functions de `index.ts` têm composição documental própria.

## Ambiente publicado: não verificado

As consultas somente de leitura ao health do Render e ao arquivo público de
configuração do Hosting falharam por TLS neste ambiente. Não há acesso verificado
ao painel, variáveis ou logs do Render. Não foi enviada pergunta real, acessado
histórico de alunos ou consumida API de geração. Não se pode afirmar qual modelo
está ativo, nem se uma resposta publicada veio de IA, fallback ou replay.

Para comprovar futuramente: verificar commit do deploy e configurações não
secretas, correlacionar uma execução autorizada com evento `SYLVINHO_IA GERADA`
e consumo do provedor; `FALLBACK` e seu motivo distinguem falhas. HTTP 200 e
texto antigo do histórico não comprovam nova geração. Não ativar flags para
realizar essa verificação.

A divergência anterior de domínios permanece fora desta alteração: a lista local
não inclui `sylvinho.web.app`. Não publicar este checkout sem conciliá-la.

## Alterações

- `geracao/atendimento.ts`: orientação compartilhada sobre resposta direta,
  extensão proporcional à dúvida, linguagem acessível, referência oficial,
  evidência para datas/prazos/valores, ausência de garantia de vigência e separação
  entre tarefa do aluno e rotina interna. Respeita a abstenção de cada schema.
- `geracao/instrucoes.ts`: Gemini/OpenAI recebem a orientação na proposta.
- `geracao/conversa.ts`: OpenRouter recebe as mesmas diretrizes; remove a
  preferência fixa por duas a quatro frases, permitindo respostas menores.
- `resposta-documental.ts`: quatro formas explicitamente incompletas, com
  variação opcional de “E”, pedem o procedimento em vez de selecionar trechos
  de um assunto arbitrário. Resposta determinística, sem selo de IA. Perguntas
  específicas mantêm a seleção, citações e apresentação existentes.
- `tests/qualidade-atendimento.test.mjs`: 13 testes sintéticos, sem rede real.

Não foram relaxados validadores, moderação, política de dados, allowlist,
aprovações, limites, formato de referências ou contratos de persistência.

## Comparação executada

O módulo anterior foi obtido do HEAD e transpilado somente em memória, para
comparação com o módulo atual. Corpus dos testes exclusivamente sintético.

| Pergunta/caso | Antes | Depois |
| --- | --- | --- |
| E quanto tempo demora? | Recusa genérica e encaminhamento à secretaria | Pergunta a qual procedimento o usuário se refere |
| Quais documentos? | Recusa genérica e encaminhamento à secretaria | Solicita o assunto antes de buscar a orientação |
| Qual o prazo para diploma? (sem evidência) | Recusa sem inventar prazo | Preservada |
| Matrícula, renovação, frequência, declaração, calendário e atendimento | Uma citação literal e fonte por caso sintético | Idênticas; condições e fontes preservadas |

Nova resposta de esclarecimento:

> Sobre qual procedimento você quer saber: matrícula, renovação de matrícula,
> declaração escolar ou outro? Informe o assunto para que eu possa buscar a
> orientação nos documentos.

Nos prompts, o Gemini antes recebia uma instrução geral de clareza; agora recebe
critérios explícitos de concisão, linguagem, próximos passos sustentados e limites
de evidência. Isso é uma alteração de instrução, não uma comparação de respostas
reais do modelo. O transporte simulado verifica que a instrução chega ao adaptador
com systemInstruction separado dos dados e JSON estruturado preservado.

## Validação

- Build TypeScript: aprovado.
- ESLint: aprovado.
- 442 testes selecionados: aprovados, incluindo os 13 novos.
- `git diff --check`: aprovado.
- Suítes: qualidade-atendimento, gemini-geracao, gemini-politica-retencao,
  openrouter-conversa, openrouter-revisao, openrouter-contexto, openai-geracao,
  assistente-handler, assistente-client, conversation-store, pergunta-livre-fluxo,
  pergunta-livre-siglas e resposta-ia-view.

As dependências foram instaladas pelo lockfile, sem scripts de instalação;
nenhuma versão de dependência foi alterada. A suíte completa do repositório
não foi executada; a fixture documental `tests/dados/rag-original.json` continua
ausente. Testes sintéticos não certificam regras escolares nem qualidade real
do modelo publicado.

## Limitações e continuidade

- Melhoria gerativa efetiva precisa de avaliação real posteriormente autorizada.
- O esclarecimento documental reconhece formas limitadas; não é compreensão
  semântica nem memória conversacional.
- Busca permanece lexical e conservadora; sinônimos e perguntas longas ainda
  podem causar ausência de evidências. Ampliação fica para a Etapa 2.
- Histórico é persistido, mas não enviado ao modelo; continuidade é Etapa 3.
- A composição conserva o baseline documental integral; respostas extensas
  podem ultrapassar o teto e retornar fallback. O formato foi preservado para
  não quebrar o parser de fontes do frontend.
- Fontes ativas não equivalem a fontes vigentes. Revisão humana do corpus e
  critérios de atualização continuam necessários.
- Não foi demonstrada melhora linguística quantitativa em produção.
