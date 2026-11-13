# Falhas, atendimento humano e nova tentativa

Entrega local de 12/11/2026. Escopo: prioridades 1, 3 e 6 combinadas com o usuário. Sem commit, push, deploy ou importação em Firebase de produção.

## Comportamento novo

- **Informação não confirmada:** continua a orientação cautelosa à Secretaria. Não aparece botão de retry técnico para preço de camiseta ou outra informação ainda em revisão.
- **Falha técnica:** não é gravada como resposta do bot. O servidor retorna erro temporário com categoria e espera mínima; a pergunta permanece salva. A interface distingue limite de uso, indisponibilidade, demora e impossibilidade de concluir uma resposta segura. Não apresenta essas situações como falta de informação da escola.
- **Atendimento humano:** pedidos como “Quero falar com um atendente”, “Preciso conversar com alguém” e “Quero atendimento humano” recebem diretamente o contato público aprovado da Secretaria, sem chamar Gemini ou abrir WhatsApp automaticamente.
- **Tentar novamente:** o botão reaproveita pergunta, conversa e `messageId`. Fica bloqueado enquanto há envio ou espera indicada pelo serviço. Cliques repetidos não geram novas perguntas.
- **Recarga:** novas falhas técnicas ficam marcadas na pendência local e aguardam ação manual; recarregar não dispara outra tentativa. Se a resposta já estiver confirmada no histórico, a pendência é encerrada sem nova geração.
- **Resposta perdida depois do commit:** uma repetição com o mesmo ID recupera a resposta já salva, sem acrescentar outro bot.
- **Sessão expirada/sem permissão:** retry não substitui login ou autorização. Token, proprietário da conversa, regras de escrita e validações de conteúdo foram preservados.

O histórico antigo não foi apagado nem reescrito. Avisos técnicos que foram salvos como bot nas versões anteriores permanecem como registros históricos; o tratamento novo vale para os novos envios.

## Verificação

- Build e lint de `functions/`: passaram.
- Conjunto de regressão ampliado: **300 testes passaram, zero falhas**. Mantido o mesmo recorte de regressões já estabelecido, incluindo a exclusão anterior do caso `formato real gerado` dependente de fixture ausente.
- Avaliação offline de política/recuperação: **56/56** passaram. Não equivale a 56 respostas geradas pela IA.
- Navegador com Auth e Firestore emulados: 503 simulado na rede, espera, recarga com ação manual, retry com mesmo ID, duplo clique, resposta HTTP perdida após commit, histórico após recarga e bloqueio de pedido sem token.
- As falhas foram simuladas apenas na página de teste isolada. As respostas de contato e de informação pendente vieram do servidor local real. **Nenhuma chamada Gemini foi necessária para esse ensaio**, pois esses dois fluxos são determinísticos.
- Campo de escrita acessível e sem rolagem horizontal em 390×844 e 320×640, inclusive com aviso e botão de retry presentes. Nenhum erro JavaScript observado.

Reproduzir o ensaio de navegador, com os serviços locais ativos:

```powershell
node scripts/verificar-retry-chat-local.mjs
```

Evidências: `.cache/curadoria-sylvinho/retry-navegador.json` e `retry-celular.png`.

## Arquivos

- `functions/src/assistente/handler.ts`: erro temporário tipado e resposta HTTP sem persistir bot de falha.
- `local-e2e/gemini-curado.mjs`: separação dos resultados técnicos retentáveis.
- `local-e2e/curadoria-local.mjs`: intenção de atendimento humano e contato aprovado.
- `scripts/iniciar-rag-gemini-local.mjs`: adaptação do resultado técnico para o contrato HTTP.
- `public/Logado/Home/assistente-client.js`: leitura limitada de categoria/espera, sem mostrar prosa remota de erro.
- `public/Logado/Home/home.js`, `home.html`, `home.css`: botão, espera, recuperação manual e mensagens de estado.
- `public/Logado/Home/envio-pendente.js`: validação dos campos opcionais de recuperação.
- Testes atualizados/ampliados de handler, cliente, Home e curadoria.
- Novos scripts: `atualizar-home-staging-local.mjs` e `verificar-retry-chat-local.mjs`.

O staging foi atualizado preservando bootstrap, endpoints e CSP dos emuladores. Não foram alterados logos, imagens originais, regras do Firestore, conteúdo aprovado da base nem a lógica dos links/botões de WhatsApp.

## Uso e reversão

O chat continua em http://127.0.0.1:5000/Logado/Home/home.html. Recarregue com Ctrl+F5 para carregar a interface nova. Os limites externos do Gemini continuam existindo; esta entrega melhora a recuperação, não remove cotas.

Backup anterior desta rodada: `C:\Programação\Backups\sylvinho-retry-local-20261112-122550`. Ele contém as cópias dos arquivos existentes modificados. Para reverter somente esta rodada, comparar com essas cópias, restaurar os arquivos correspondentes, regenerar `functions/lib` com `npm.cmd run build` e reiniciar somente o backend local. Preservar alterações posteriores do usuário e as conversas dos emuladores. Não usar `git reset --hard` ou `git clean`.

Os manifestos das entregas anteriores não foram regenerados: seus bloqueios por hash continuam protegendo as mudanças feitas depois deles.
