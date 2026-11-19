# Varredura dos sites oficiais e ampliação da base curada

Data: 19/11/2026. Leitura somente de páginas públicas. Sem commit, push ou deploy.

## O que foi lido

| Fonte | Como | Conteúdo |
| --- | --- | --- |
| etecmatao.cps.sp.gov.br | API pública do WordPress (`wp-json`) | 31 páginas, 69 notícias (quase todas de 2016–2024), 9 cursos, 5 eventos e a lista de 57 documentos. |
| PDFs publicados pela escola | download direto | Calendário Escolar 2026 (alterado em 20/03/2026), Regimento interno 2021-2024, regulamento das bibliotecas, regulamento dos laboratórios e horários das turmas (2º semestre de 2024). |
| vestibulinho.etec.sp.gov.br | navegador (Chrome) | Dúvidas Frequentes completas (cerca de 150 perguntas oficiais), calendário do 1º semestre de 2027, documentos e a página da unidade de Matão, com cursos e vagas. O acesso direto por script recebe HTTP 403 da Cloudflare; não foi contornado. |
| Calendário de matrícula 1º sem. 2027 | PDF oficial | Listas de convocação e datas de matrícula. |

Durante a conferência, o site da escola passou a mostrar "Há um erro crítico no seu site" (erro do WordPress) em todas as páginas, inclusive na API. O texto já coletado foi usado, e a nota de cada entrada registra a forma de conferência.

Dados pessoais de alunos e pais (Grêmio, APM, Conselho de Escola) e listas de professores não entraram na base. Entraram só cargos institucionais publicados pela escola: direção, coordenação pedagógica e orientação.

## Mudanças na base (`knowledge-local/faq-curada.json`)

46 → 70 entradas aprovadas: 24 novas e 3 atualizadas. Cada evidência foi conferida, literalmente, no texto da fonte:

- 68 evidências do Vestibulinho, conferidas no navegador;
- as demais, nos PDFs e no texto da API.

**Novas:**

| Tema | Entradas |
| --- | --- |
| Vestibulinho | como funciona e como se inscrever (com o site oficial), taxa e pagamento, redução da taxa, dia da prova, resultados e chamadas de 2027, regras da matrícula, pontuação acrescida, PcD e atendimento diferenciado, treineiro |
| Cursos | oferta do 1º semestre de 2027 em Matão (turnos e vagas), estrutura e duração dos cursos, idade mínima, Enfermagem noturna (sábados e estágio diurno), horários de cada turno |
| Escola | direção, coordenação pedagógica e orientação, telefone fixo, infraestrutura, biblioteca, regras dos laboratórios, dispensa antecipada em casos extraordinários |
| Calendário | fim das aulas e prazos de reconsideração e reclassificação de 2026, aproveitamento de estudos, feriados restantes de 2026 |

**Atualizadas:**

- `tecnico-concomitante` (v2): antes dizia que não havia regra para dois cursos técnicos. Pelas Dúvidas Frequentes do Vestibulinho, é permitido quando os horários não coincidem, inclusive ETEC e Fatec ao mesmo tempo. Em duas turmas de Ensino Médio, não.
- `enfermagem-catalogo` (v2): Enfermagem não aparece na oferta do 1º semestre de 2027 em Matão. A entrada também traz a idade mínima de 18 anos e as aulas aos sábados no período noturno.
- `cursos-noturnos` (v2): oferta noturna de 2027 (Administração, Eletrotécnica, Mecânica, Programação de Jogos Digitais e Especialização em Saúde do Trabalhador).

**Código:**

- `render-poc/motor-curado/curadoria-local.mjs`:
  - "biblioteca" e "jogos digitais" saíram das pendências fixas, porque agora há fato oficial;
  - o telefone fixo (16) 3382-6878 entrou na lista de contatos permitidos (também em `contatos-publicos.json`).
- `functions/src/assistente/escopo.ts`:
  - o vocabulário escolar foi ampliado (menções, falta, aula, diretor, laboratório, feriado, prova, taxa e outros), porque essas perguntas eram recusadas como fora de escopo;
  - "faz meu trabalho de…" passou a ser fora de escopo.
- `render-poc/motor-curado/curadoria-local.mjs`: "que horas começa a aula" deixou de ser tratada como pergunta de calendário. Antes, a busca considerava só as entradas de calendário, e a de horários dos turnos não entrava.
- Entradas tiradas do Calendário Escolar Geral (`prazos-fim-2026`, `feriados-fim-2026` e `aproveitamento-estudos`) ficaram restritas aos cursos listados nele, como as entradas de 2026 já existentes. Sem o curso, o Sylvinho pergunta "Qual é o seu curso?".
- `inicio-2026`: novas variações ("quando começam as aulas", "quando voltam as aulas").
- Índice vetorial: 70 vetores (`knowledge-local/embeddings-curados.json`).
- Testes:
  - o teste de moderação do Regimento usa um fato sintético, porque nenhum fato real cita mais o Regimento;
  - o teste da lista de contatos passou de 7 para 8.

## Verificação

**Testes:**

- Suíte completa: 1.340 testes, com as mesmas 17 falhas que já existiam. Nenhum dos arquivos com falha usa a base, os contatos ou o motor curado.
- Motor e curadoria: 62/62.
- Escopo: 98/98.
- `render-poc`: 32/32.
- Lint das Functions: limpo.

**Testes que precisaram de ajuste:**

- O teste de moderação do Regimento passou a usar um fato sintético.
- O teste da rota visitante usava "Posso fazer o técnico junto com o ensino médio?" como frase sem palavra-chave. Agora ela é reconhecida, então o exemplo virou "Dá para fazer as duas coisas juntas?".

**Avaliação local** (motor real, chave local, 57 perguntas = as 40 da rodada de produção + 3 do chat + 14 sobre os temas novos):

- Passaram a responder certo:
  - as três perguntas de inscrição feitas no chat, agora com o site oficial;
  - idade mínima (antes era o erro factual);
  - dois cursos técnicos;
  - cursos oferecidos;
  - menções;
  - diretor e telefone;
  - biblioteca e laboratório;
  - refeitório e Pix;
  - pontuação acrescida e resultados do Vestibulinho;
  - jogos digitais;
  - fim das aulas por curso.
- Tempo esgotado: parte das respostas estourou os 20 s. O diagnóstico mostrou cota esgotada (HTTP 429) e lentidão ou HTTP 503 dos modelos na chave local, com pedidos de cerca de 4 KB. Depois da renovação da cota, as respostas voltaram para 2,5 a 4,5 s. A chave do Render tem cota própria.
- Ainda pendente: "Que horas começa a aula do técnico?". A pergunta chega às entradas certas (`horarios-turnos`, `cursos-noturnos`), mas a última tentativa teve a resposta reprovada na validação. Conferir em produção depois da publicação.

## Rodada em produção (`d5e36bb`) e correções

Rodada com as 57 perguntas no chat de visitante de produção.

**Nas mesmas 40 perguntas da primeira avaliação:** 37 respostas adequadas (92,5%), contra 31 antes. Houve 1 erro factual e 2 falhas técnicas.

**Problemas encontrados:**

1. **Erro factual:** "Tem curso à noite?" citou Enfermagem como curso noturno oferecido em 2027. O Gemini juntou a oferta noturna com a entrada que falava da "Enfermagem oferecida à noite".
2. **Falha do Gemini caindo no fluxo antigo:** quando o Gemini falhou (cota, sobrecarga ou tempo), o fluxo documental antigo respondeu "não encontrei" a perguntas que a base cobre: resultado do Vestibulinho, telefone e inscrição.
3. **Pedidos de curso desnecessários:** as entradas tiradas do Calendário Geral pediam o curso antes de responder ("Posso aproveitar matérias…"), ou davam resposta vaga ("Quando acabam as aulas este ano?").

**Correções:**

- `enfermagem-sabado-estagio` (v2): passou a dizer "quando há turma noturna…" e registra que Enfermagem não aparece na oferta de 2027.
- `prazos-fim-2026`, `feriados-fim-2026` e `aproveitamento-estudos` (v2): voltam a valer sem pedir o curso. A resposta diz a quais cursos o Calendário Geral se aplica e manda os demais, como Enfermagem, à Secretaria.
- `saude`: novas variações ("falta por doença").
- **Resposta direta:**
  - **Motor** (`gemini-curado.mjs`): quando a geração ou a revisão falha e a busca aponta um único fato aprovado inequívoco, a falha segue como falha, mas leva esse fato como `reserva`. Inequívoco significa que a pergunta é igual a uma pergunta ou variação aprovada, ou que a confiança é de pelo menos 0,6 com folga de 0,05 sobre o segundo colocado.
  - **Servidor** (`motor-curado.cjs`): mostra o texto aprovado (`curado_direto`) em vez de cair no fluxo antigo ou pedir nova tentativa.
  - **Garantia:** a resposta gerada reprovada nunca é exibida.
  - **Testes:** dois testes novos. Quatro testes do adaptador passaram a esperar esse comportamento, e o caso "sem fato inequívoco" continua testado com o comportamento anterior.

**Conferência local:** as 6 perguntas com problema passaram a responder certo. Em 4 delas, a resposta direta entrou depois de HTTP 429 ou tempo excedido no Gemini.

**Em produção (`297988c` e `497ed27`):** o Gemini gratuito estava sobrecarregado. Quase todos os modelos da lista responderam 429 ou 503, ou estouraram o tempo. Ajustes nessa fase:

- **Desempate (`497ed27`):** com empate de confiança, a reserva vale quando o primeiro fato também lidera a busca semântica, com folga de 0,05, e a lexical. Esse é o caso de "Qual o telefone da escola?", que empatava com os quatro contatos.
- **Diagnóstico:** o log `RESERVA_DIRETA` registra se a reserva foi criada (id, exato e confianças, sem o texto da pergunta).
- **Falso negativo do teste:** testes com `curl` no Git Bash do Windows estragam os acentos ("matérias", "doença"). A pergunta chegava diferente e não casava com a base. Enviadas pelo Node, em UTF-8, as perguntas usam o fato aprovado normalmente. Para testar perguntas com acento, use o script em Node.

Conferidas em produção, com respostas corretas:

- cursos noturnos, sem Enfermagem;
- resultado do Vestibulinho;
- telefone;
- fim das aulas;
- aproveitamento de estudos;
- inscrição;
- falta por doença.

## Divergências encontradas (para o grupo decidir)

1. **Horário da Secretaria:** o Regimento interno (revisão de 26/02/2024) diz "de segunda à sexta-feira, das 9h às 14h e das 18h30 às 21h". A base mantém o horário da Secretaria como pendente, por decisão anterior. Se o grupo confirmar com a Secretaria, vira uma entrada.
2. **Telefone:** a página de contato da escola traz (16) 3382-6878. O portal do Vestibulinho traz (16) 3383-9200, e o Regimento, (16) 3382-1226. A base usa o da página de contato.
3. **Técnico em Mecânica:** a página diz "três módulos", mas cita um módulo IV. Por isso Mecânica ficou fora da resposta de duração dos cursos.
4. **Núcleo Pedagógico:** a página foi atualizada em 27/01/2026, mas o título da lista de coordenadores de curso diz "ano letivo de 2024". Por isso só entraram o coordenador pedagógico e o orientador.
5. **Horários publicados por turma** são do 2º semestre de 2024. Os horários de cada turno vêm do Regimento interno, e a resposta manda confirmar com a Secretaria.
6. **Infraestrutura:** os números são de 2024 (1.287 alunos no 1º semestre de 2024). A página não informa se há merenda.

## Pendências de revisão humana

As 24 entradas novas e as 3 atualizadas foram conferidas com a fonte primária pela curadoria assistida. Elas não foram confirmadas com a Secretaria. Recomenda-se a leitura do grupo, como nas 6 entradas já marcadas.

Entradas com prazo curto:

- `vestibulinho-dia-da-prova`: vigência até 07/12/2026;
- `prazos-fim-2026` e `feriados-fim-2026`: até o fim do ano;
- entradas do Vestibulinho: até 28/02/2027.

Depois dessas datas, saem da busca sozinhas pela vigência e precisam de atualização para o processo seguinte.
