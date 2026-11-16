# Validação e integridade da IA local — 16/11/2026

Trabalho local em `feat/ia-confiabilidade-local`, sem commit, push, merge ou deploy.

## Respostas

A conferência numérica permitia trocar unidades quando o número existia nos fatos: “16 anos” podia virar “16 dias”. Agora também confere pares de número e unidade para percentuais, anos, dias, meses, semanas, horas, reais, vagas e aulas. Expressões equivalentes como “75%” e “75 por cento” continuam aceitas. Não infere conversões nem resolve o significado completo da resposta; a revisão semântica continua obrigatória.

Unidade não sustentada bloqueia a proposta antes da revisão e do cache. A versão de validação na chave do cache foi incrementada. A instrução do revisor agora exige pertinência à pergunta, preservação de condições e exceções e rejeição de conclusões individuais não autorizadas. A pergunta permanece nos dados, separada da instrução do sistema. O filtro existente já bloqueia instruções suspeitas antes do provedor.

Quatorze testes cobrem essas condições. Na primeira rodada, seis trocas de unidade e a integração correspondente falharam; cinco controles positivos passaram. Um caso que misturava revisão e instrução suspeita foi separado: o filtro bloqueia essa entrada antes da revisão. Alterar a instrução não demonstra por si só melhoria de precisão do modelo real.

## Base de conhecimento

IDs duplicados podiam contornar a detecção de conflito, que pressupunha IDs únicos. A busca agora recusa a inicialização com `BASE_ID_DUPLICADO` ou `BASE_ID_INVALIDO`. Escopos malformados ou intervalos de idade inválidos ficam inelegíveis. Datas atuais inválidas também são recusadas.

Onze testes passaram; sete falhavam antes das correções. O comando somente de leitura `node scripts/auditar-base-curada-local.mjs` verifica identidade, textos, variações, datas e elegibilidade. Não consulta a internet, altera registros, aprova fatos ou comprova autenticidade de hashes.

Auditoria em 16/11: 44 registros, nenhum problema estrutural e nenhum registro indisponível. Quatro revisões estão pendentes desde 12/11: `celular-aula`, `saida-antecipada`, `uniforme` e `calcado`. `revisarEm` é um alerta de revisão, distinto do fim de vigência. As datas não foram alteradas para aparentar uma revisão realizada. Esses assuntos precisam de conferência humana antes da publicação.

## Verificação

- 433 testes selecionados passaram, nenhuma falha.
- 66/66 cenários offline de recuperação e política passaram.
- Sintaxe verificada e `git diff --check` sem erros.
- Logs locais ignorados pelo Git em `.cache/ia-validacao-2026-11-16/` e `.cache/ia-integridade-2026-11-16/`.

Nenhuma consulta paga foi disparada. Transportes simulados não medem precisão factual geral ou latência real do Gemini. A base factual e a produção não foram modificadas.
