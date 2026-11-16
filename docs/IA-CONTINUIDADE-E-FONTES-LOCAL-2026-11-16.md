# Continuidade da conversa e referências — etapa local

Branch de trabalho: `feat/ia-confiabilidade-local`. Sem commit, push, merge ou deploy, conforme orientação do usuário.

## Correções

Quando o assistente pede o curso, uma resposta como “Enfermagem, preciso fazer estágio?” agora mantém a pergunta nova. Antes, ela podia ser substituída pela pergunta anterior de renovação. Respostas que informam somente o curso, como “Faço Logística”, continuam recuperando a pergunta original e seu ano. Perguntas novas sobre assuntos não catalogados também são preservadas.

Pedidos como “Qual é a fonte?”, “Pode me mandar o link?”, “Onde posso conferir isso?” e “Qual a referência?” agora usam o tema da conversa. A referência é extraída dos registros recuperados, sem chamada de geração ou revisão. Sem assunto identificável, o assistente pede esclarecimento. Uma resposta pendente não recebe referência inventada, mas também não impede um pedido explícito sobre outro assunto. A exceção de perda do prazo da renovação continua distinta do calendário geral.

## Evidências

- Treze testes novos. Na primeira rodada, dez dos onze casos iniciais falharam; duas variações adicionais também falharam antes das correções.
- Regressão selecionada: 408 testes passaram, nenhuma falha.
- Avaliação offline ampliada: 66/66 cenários de recuperação e política, sem jargão não solicitado detectado pelo avaliador.
- Sintaxe dos módulos alterados e `git diff --check` verificados.
- Logs em `.cache/ia-continuidade-2026-11-16/`, ignorados pelo Git.

Os testes usam transportes simulados. Não demonstram precisão factual geral do Gemini nem substituem uma avaliação com respostas reais revisadas por pessoas. Nenhuma consulta paga foi iniciada nesta etapa. A base factual aprovada não foi alterada.

O adaptador local foi reiniciado com as correções para testes manuais em `http://127.0.0.1:5000/Logado/Home/home.html`. As alterações permanecem no motor local; não foi feita alteração de produção.
