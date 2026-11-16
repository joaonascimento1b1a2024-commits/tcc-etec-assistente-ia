# Teste local sem RAG

Ativado a pedido do usuário para comparar a experiência com Gemini 3 Flash Preview diretamente, sem recuperar documentos.

Iniciar com os emuladores já ativos:

```powershell
node scripts/iniciar-rag-gemini-local.mjs --sem-rag
```

O serviço precisa ser encerrado no terminal antes de iniciar outra instância na mesma porta. Endereço: http://127.0.0.1:5000/Logado/Home/home.html. O cabeçalho da cópia servida pelo emulador identifica “teste sem RAG”. Iniciar Novo chat para evitar confundir mensagens antigas com os resultados atuais.

O modelo recebe a pergunta atual e instruções de conversa, sem trechos, fontes, UID, token ou histórico completo. As mensagens continuam salvas no Firestore Emulator; histórico salvo não significa memória de conversa enviada ao modelo neste experimento. Perguntas gerais são permitidas. A instrução impede alegar consulta aos documentos ou inventar informações locais da escola. A saída usa uma chamada em vez das quatro do fluxo RAG validado, com filtros do provedor e filtro local de dados pessoais; não oferece a mesma verificação documental do modo RAG.

`local-e2e/gemini-sem-rag.mjs` contém a composição experimental. Nenhum documento foi apagado. O comportamento publicado, as chaves e os dados Firebase reais não foram alterados. Sem commit, push ou deploy.

Verificação: dois testes automatizados passaram. No navegador, a pergunta “Qual é o valor de pi? Responda brevemente.” recebeu resposta real do Gemini, sem referências documentais nem erro JavaScript; `/health` confirmou zero chunks utilizados. Evidência em `.cache/chat-rag/sem-rag.json`.

Para reativar o RAG, encerrar o serviço e executar o mesmo comando sem `--sem-rag`. O cabeçalho volta ao normal. O modo sem RAG não é uma substituição aprovada para fornecer procedimentos oficiais da secretaria; é um teste comparativo.
