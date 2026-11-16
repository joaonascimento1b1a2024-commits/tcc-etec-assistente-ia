# Recolhimento desktop — continuidade de 12/11/2026

Foi corrigida localmente a mudança brusca de espaço entre a lateral de 196 px e a faixa de 76 px. A largura e a margem do conteúdo usam a mesma curva e duração de 180 ms. As medidas finais, o cabeçalho, os fundos e os fluxos de conta foram preservados.

A transição só é habilitada depois do primeiro clique no botão de recolher. A preferência restaurada no carregamento não produz uma animação de entrada. No celular permanece a gaveta por transform; com movimento reduzido, o desktop troca de estado imediatamente. Cliques durante a transição chegam ao estado da última ação.

Implementação em HTML/CSS/JS existente, sem dependências. A mudança de largura/margem provoca layout durante a curta transição; não é animação exclusiva do compositor. A escolha mantém texto e controles sem distorção de escala. A amostra de frames confirmou alinhamento lateral/conteúdo sem rolagem horizontal; não constitui benchmark universal de desempenho.

## Verificações executadas nesta rodada

- 98 testes selecionados aprovados, zero falhas. Usado o filtro anterior `formato real gerado`, cujo arquivo de dados continua ausente; o runner desta execução informou zero casos pulados.
- 69 verificações de layout em 13 páginas aprovadas, sem erros JavaScript ou requisições externas.
- 51 cenários responsivos do chat aprovados.
- Ensaio específico: posições intermediárias no movimento normal, alinhamento em cada frame, movimento reduzido imediato, cliques rápidos e gaveta mobile aprovados.
- Sintaxe JavaScript dos arquivos alterados conferida.
- Capturas desktop expandido e recolhido inspecionadas: cabeçalho e campo de escrita visíveis, identidade e medidas preservadas.

Comandos:

```powershell
node --test --test-skip-pattern="formato real gerado" tests/home-assistente.test.mjs tests/assistente-client.test.mjs tests/resposta-documental-view.test.mjs tests/session-navigation.test.mjs
node scripts/verificar-shell-local.mjs
node scripts/verificar-chat-responsivo.mjs
node scripts/verificar-recolhimento-local.mjs
```

Evidências específicas em `.cache/sidebar-continuacao-2026-11-12/`, incluindo `movimento.json` e capturas. As suítes existentes também atualizaram seus resultados em `.cache/shell-review/` e `.cache/ui-review/responsive/`.

## Estado e limites

A prévia visual na porta 4173 respondeu HTTP 200 e usa fixtures. Portas 5000, 5001, 5002, 8080, 9099 e 4000 estavam indisponíveis na conferência inicial. Nenhum backend foi iniciado. Não foram testados Gemini, login real, permissões de produção, e-mail ou Firebase nesta rodada.

O resumo local continua registrando 44 aprovados, 131 propostas, 200 perguntas originais, 96 com alegações, 104 sem dado e sete contatos públicos; as listas se sobrepõem. O backend complementar existe, mas não foi reconhecido como repositório Git.

Continuam pendentes: aprovação visual pelo usuário, decisão sobre as artes claras, teclado em aparelho físico, avaliação independente de respostas reais e confirmações da Secretaria. O prompt exige decisão de escopo antes de aplicar as artes e orçamento antes de retomar a avaliação; continuidade não transforma essas propostas em fatos confirmados. Nenhuma arte foi aplicada, nenhuma resposta institucional foi inventada e nenhum serviço pago foi consultado.

Sem commit, push, deploy, escrita remota ou alteração no Figma. O trabalho anterior foi preservado.

## Reversão específica

Antes de restaurar, comparar os arquivos atuais para preservar alterações posteriores. A pasta de evidências guarda `shell.before.css`, `ui.before.js` e `verificar-shell.before.mjs`. Restaurar apenas os arquivos correspondentes se a comparação confirmar que não há trabalho posterior. O novo verificador e este relatório podem ser mantidos como histórico. Não usar reset ou limpeza global, nem executar o antigo reversor da entrega inteira.

## Autoavaliação

Aplicada a skill `ecc:agent-self-evaluation`: precisão 4/5 (evidências de prévia, sem validação em aparelho físico); completude 4/5 (correção local entregue, aprovação visual pendente); clareza 4/5 (escopo e limitações registrados, documentação histórica extensa); utilidade 4/5 (verificador reproduzível, sem benchmark em hardware variado); concisão 4/5 (detalhes mantidos para reversão). Média 4,0/5. Melhorias futuras: validar aparelho real, obter aprovação visual e medir em hardware menos potente. A avaliação do usuário ainda não foi recebida.
