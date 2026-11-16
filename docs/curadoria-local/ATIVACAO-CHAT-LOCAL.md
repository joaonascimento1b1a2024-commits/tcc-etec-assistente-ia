# Chat curado ativado localmente

12/11/2026, após autorização expressa para ver a IA funcionando no chat.

URL: http://127.0.0.1:5000/Logado/Home/home.html

O endpoint local em `127.0.0.1:5002` está no modo `gemini-rag-curado-local`, com Gemini 3 Flash Preview, reserva Gemini 2.5 Flash e embeddings reais. A coleção agora tem **44 entradas aprovadas**: foi incluído o horário geral da escola já conferido no site. O horário atual da Secretaria continua em revisão. Os 290 trechos anteriores permanecem preservados.

Esta ativação substitui a situação descrita na entrega anterior, na qual a composição ainda não estava ligada ao chat. Não houve commit, push, deploy ou acesso ao Firebase de produção. Auth, Firestore, Functions auxiliares e Hosting usam emuladores com o projeto `demo-sylvinho-render-poc`.

## Integração

- O handler mantém validação de token, propriedade da conversa, persistência e proteção contra mensagens duplicadas. O adaptador opcional recebe somente mensagens anteriores da própria conversa autenticada; não aceita histórico enviado no corpo HTTP.
- A inicialização com `--faq-curada` instala o adaptador. Os modos anteriores continuam disponíveis e não são o padrão de produção.
- O pedido de fonte usa referências aprovadas sem nova geração. O acompanhamento sobre perda do prazo preserva a regra correspondente, em vez de retornar só o calendário.
- A validação numérica reconhece formatos equivalentes de datas e distingue marcadores de lista dos números factuais. Novos dias, anos e percentuais continuam bloqueados; a revisão semântica permanece obrigatória.
- Há limite por chamada e modelo reserva para indisponibilidade/429. O Gemini 2.5 usa orçamento de pensamento zero neste teste, para não gastar a saída estruturada com pensamento interno.
- Erros antigos já salvos no histórico não foram apagados. Uma nova conversa usa a versão atual.

## Verificação final

- **290/290 testes passaram**: os 260 estabelecidos, 24 da curadoria anterior e seis testes adicionais desta integração.
- **56/56 cenários offline** de recuperação/política passaram; continuam separados da avaliação de geração.
- Build e lint de `functions/` passaram.
- Teste real com navegador isolado: renovação em **7,282 s**, acompanhamento do prazo em **2,618 s**, referências em **0,548 s**, encaminhamento de preço informal em **0,229 s**.
- Histórico após recarga preservado; replay não gerou duplicação; pedido sem token foi bloqueado com 401; nenhum erro JavaScript observado.
- Campo de escrita visível, sem rolagem horizontal, em 1440×900 e 390×844.
- Durante os testes, houve 429 no modelo principal e a revisão foi concluída com a reserva. Limites externos continuam existindo; não há garantia de disponibilidade integral da API nem certificação de precisão geral a partir dessa amostra.

Evidência: `.cache/curadoria-sylvinho/chat-curado-navegador.json` e screenshot `chat-curado-celular.png`. Reproduzir a verificação real: `node scripts/verificar-chat-curado-navegador.mjs` (consome cota da API).

## Arquivos desta integração

Editados: `functions/src/assistente/handler.ts`, `scripts/iniciar-rag-gemini-local.mjs`, `local-e2e/curadoria-local.mjs`, `local-e2e/gemini-curado.mjs`, `tests/assistente-handler.test.mjs`, `tests/curadoria-local.test.mjs`, `knowledge-local/fatos-conferidos.mjs` e dados locais regenerados da coleção/índice.

Novos: `scripts/verificar-chat-curado-navegador.mjs`, `scripts/diagnosticar-resposta-curada.mjs` e este registro. O diagnóstico usa exclusivamente a pergunta sintética pública sobre renovação, não conversas de usuários.

Backup anterior da inicialização e do handler: `C:\Programação\Backups\sylvinho-ativacao-local-20261112-113445`. O manifesto da entrega anterior foi preservado e sua reversão automática recusará os arquivos modificados depois dela. Não regenerar esse manifesto para apagar as alterações desta ativação sem revisão.

## Iniciar novamente quando os processos forem encerrados

Em um terminal, a partir da raiz do projeto:

```powershell
node local-e2e/history-run.mjs --keep-open --gemini-local
```

Esse comando confere os emuladores e executa a verificação sintética inicial. Depois, em outro terminal:

```powershell
node scripts/iniciar-rag-gemini-local.mjs --faq-curada
```

Não executar os inicializadores novamente se as portas já estiverem ocupadas pelo ambiente atual. A sessão emulada é local; não dá acesso à conta ou ao histórico de produção.
