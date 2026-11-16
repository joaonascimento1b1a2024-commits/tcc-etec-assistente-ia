const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const originalPath = path.join(root, 'docs/levantamento-base/perguntas-pendentes.json');
const originalBytes = fs.readFileSync(originalPath);
const originais = JSON.parse(originalBytes).perguntas;
const grupos = [
['contatos_confirmacao','Contatos e atendimento por setor','Secretaria e Direção',`
Qual dos telefones fixos publicados pela escola deve ser usado hoje e para quais assuntos?
O número fixo do folder antigo ainda funciona ou foi substituído?
O WhatsApp geral atende quais assuntos que não devem ir diretamente para a Secretaria?
Em quais horários o WhatsApp da Orientação é acompanhado por uma pessoa?
Quais assuntos podem ser enviados ao e-mail da Direção?
Quais assuntos podem ser enviados ao e-mail administrativo?
Quais assuntos podem ser enviados ao e-mail da APM?
Qual contato institucional deve receber pedidos de empresas e propostas de parceria?
Existe algum canal separado para candidatos que ainda não são alunos?
Existe algum canal separado para ex-alunos de turmas antigas?
Qual procedimento seguir quando nenhum dos canais institucionais responde?
Como a escola informa que um número ou endereço de e-mail foi substituído?
Quais perfis de redes sociais pertencem oficialmente à escola e quais não pertencem?
Quais comunicados publicados nas redes sociais também precisam aparecer no site?
Se um telefone publicado em uma rede social divergir do site, onde o usuário deve confirmar o contato?
Quais canais aceitam mensagens de áudio e quais exigem pedido por escrito?
Quais anexos podem ser enviados pelos canais institucionais e quais precisam de entrega por outro meio?
O atendimento remoto atende também quem não consegue comparecer em horário comercial?
Qual é a orientação para quem precisa de atendimento urgente quando a Secretaria está fechada?
Existe atendimento em unidades ou classes descentralizadas e qual setor responde por cada local?
`],
['vestibulinho_detalhes','Vestibulinho e ingresso','Secretaria e responsável pelo processo seletivo',`
Qual é o endereço oficial do processo seletivo e como reconhecer uma página falsa de inscrição?
Quais documentos são necessários para fazer a inscrição, antes da etapa de matrícula?
Como o candidato corrige seus dados depois de concluir a inscrição?
Como conferir se o pagamento da taxa foi reconhecido?
O que fazer se o pagamento não aparecer antes do encerramento do prazo?
Há redução ou isenção da taxa neste processo e qual edital define os critérios?
Como solicitar atendimento diferenciado para a prova e até quando é possível pedir?
Como conferir se o atendimento diferenciado solicitado foi concedido?
Como funciona a pontuação acrescida e quais comprovantes são exigidos?
Quem estudou em escola particular com bolsa pode solicitar a pontuação acrescida prevista no edital?
Como consultar o local de prova e o que fazer se os dados estiverem errados?
Qual é a regra vigente de abertura e fechamento dos portões da prova?
Quais documentos de identificação são aceitos no dia da prova?
Quais materiais são permitidos e quais são proibidos durante a prova?
Qual procedimento seguir se o documento de identificação for perdido perto da prova?
Onde consultar gabarito, resultado e prazos para contestar questões ou classificação?
Como funcionam segunda opção, lista de espera e chamadas seguintes neste processo?
Qual é a diferença entre o calendário de matrícula presencial, semipresencial e online neste ingresso?
Existe processo específico para especialização técnica e quais requisitos adicionais ele exige?
Se eu perder a inscrição ou a prova, existe outra forma de ingresso prevista em edital para este período?
`],
['matricula_excecoes','Matrícula e documentos em situações específicas','Secretaria',`
Se ainda não recebi o certificado de conclusão da escola anterior, qual documento previsto no edital posso apresentar?
Qual procedimento se aplica quando falta apenas a foto 3x4 na entrega da matrícula?
Como a Secretaria atende o candidato com 16 ou 17 anos que vai fazer a própria matrícula?
Quais documentos comprovam a representação legal de um candidato menor de 16 anos?
Como é atendido o candidato emancipado e qual comprovação é solicitada?
Qual procedimento vale para candidato estrangeiro ou com documentos escolares emitidos no exterior?
Como é feita a matrícula de quem usa nome social?
O que fazer se o nome nos documentos pessoais divergir do histórico escolar?
Quais comprovantes adicionais são exigidos para ingresso em Enfermagem neste edital?
Se houver idade mínima específica do curso, em qual data ela precisa estar completa?
Existe formulário para justificar ausência nos primeiros dias após a matrícula inicial?
Como comprovar uma justificativa quando há risco de cancelamento da matrícula inicial por ausência?
Como a escola entra em contato com o aluno antes de registrar abandono e como fica registrada essa tentativa?
Como justificar faltas consecutivas sem confundir justificativa com abono automático?
O que fazer se perdi o prazo de renovação, mas quero continuar estudando?
Como renovar a matrícula se estou em progressão parcial?
Como renovar a matrícula se meu pedido de reconsideração ou recurso ainda está em análise?
Como corrigir uma renovação registrada para turma, turno ou módulo incorreto?
Há procedimento próprio de matrícula para classes descentralizadas e qual unidade recebe os documentos?
Como solicitar uma declaração de matrícula com urgência e qual prazo a escola realmente consegue assumir?
`],
['rotina_escolar','Entrada saída e rotina dos turnos','Orientação e Secretaria',`
Quais são os horários atuais de entrada, intervalos e saída de cada turno?
O horário do M Tec noturno é diferente do horário dos técnicos modulares?
Como localizar a sala e a turma no primeiro dia de aula?
Como consultar uma mudança de sala ou de professor no dia da aula?
Qual é o procedimento de entrada quando o aluno chega atrasado?
Existe tolerância de atraso e ela muda por turno ou por atividade?
Como são registradas presença e ausência quando o aluno chega depois do início da aula?
O aluno pode entrar apenas para a segunda aula e em quais condições?
Como avisar a escola quando um atraso é causado pelo transporte escolar?
Qual procedimento seguir quando o professor ainda não chegou ou a turma está sem aula?
Quem deve autorizar a saída antecipada de um aluno maior de 18 anos?
Se o responsável não puder buscar pessoalmente o menor que precisa sair, qual procedimento formal a escola oferece?
Como comprovar quem tem autorização legal para buscar um aluno menor?
É permitido sair durante o intervalo e retornar para as aulas seguintes?
O aluno pode permanecer na escola antes do início ou depois do fim do próprio turno?
Como funcionam entrada e identificação de visitantes, responsáveis e prestadores de serviço?
Existe acesso específico para bicicletas, motos ou carros e quais condições de uso se aplicam?
Como funciona o acesso de estudantes de classes descentralizadas às instalações da sede?
Qual canal confirma se haverá aula em caso de interrupção de energia, água ou transporte?
Qual procedimento seguir quando um aluno precisa faltar para cumprir obrigação de trabalho ou compromisso oficial?
`],
['uniforme_alimentacao','Uniforme alimentação e despesas','Orientação APM e setor responsável pela alimentação',`
Qual é o modelo de uniforme atualmente exigido e para quais atividades e turmas?
Onde é possível obter a camiseta do uniforme pelos canais reconhecidos pela escola?
Qual é o preço confirmado da camiseta, em que data foi informado e por quanto tempo vale?
Quais tamanhos estão disponíveis e como consultar reposição ou encomenda?
Existe orientação para quem ainda não conseguiu comprar ou receber o uniforme?
Se o aluno não puder pagar o uniforme, qual procedimento evita prejuízo ao acesso às aulas?
Qual procedimento vale quando o uniforme está danificado ou não pode ser usado por motivo justificado?
A recomendação sobre calçados em áreas comuns é diferente da exigência de segurança dos laboratórios?
Para cada laboratório, quais calçados, roupas e equipamentos de proteção são obrigatórios?
Quem fornece os equipamentos de proteção e o que fazer se o aluno não tiver condições de obtê-los?
Em quais horários e turnos a alimentação escolar é servida atualmente?
Quais alunos podem receber alimentação escolar e como funciona para classes descentralizadas?
É necessário cadastro, identificação ou reserva para receber a alimentação escolar?
Como informar alergia, intolerância ou outra necessidade alimentar ao setor competente?
Qual é o canal para consultar cardápio e mudanças na alimentação escolar?
É permitido levar comida de casa e em quais locais ela pode ser consumida?
Existe cantina em funcionamento e como consultar seu horário sem confundi-la com a merenda gratuita?
Quais contribuições da APM são voluntárias e como isso é comunicado aos alunos?
Quais materiais precisam ser comprados pelo aluno em cada curso e onde fica a lista oficial?
Há despesas com visitas, apresentações ou formatura e que alternativas existem para quem não pode pagar?
`],
['sistemas_acesso','NSA e ferramentas digitais','Secretaria e suporte de tecnologia',`
Qual é o endereço oficial do NSA utilizado pela unidade?
Como o novo aluno recebe seu primeiro acesso ao NSA?
Como o responsável legal recebe acesso próprio ao acompanhamento escolar?
Qual é o procedimento para recuperar a senha do NSA sem compartilhar a senha antiga?
O que fazer quando o cadastro ainda não aparece no NSA após a matrícula?
O que fazer se curso, turma ou situação da matrícula aparecerem incorretos no sistema?
Qual mensagem ou comprovante confirma que uma renovação pelo sistema foi concluída?
O que fazer quando o NSA informa erro durante o período de renovação?
Como solicitar atualização de um e-mail de recuperação ao qual não tenho mais acesso?
Como obter o e-mail institucional e quando ele passa a funcionar?
Como recuperar o acesso ao e-mail institucional pelo canal oficial?
Quais ferramentas digitais e licenças são oferecidas aos alunos deste curso?
Qual plataforma é usada para materiais, tarefas e aulas remotas autorizadas?
Como entrar em uma turma digital à qual ainda não fui adicionado?
Qual canal atende erro de acesso fora do horário das aulas?
Há alternativa de entrega de atividades para quem está temporariamente sem internet ou equipamento?
Até quando o ex-aluno mantém acesso ao e-mail e aos arquivos institucionais?
Como salvar os próprios arquivos antes do encerramento do acesso institucional?
Como comunicar suspeita de invasão da conta institucional?
Quais dados o suporte pode pedir para identificar o aluno e quais nunca devem ser enviados por mensagem?
`],
['acessibilidade_inclusao','Acessibilidade inclusão e apoio pedagógico','Orientação e Coordenação Pedagógica',`
Como solicitar uma avaliação das necessidades de acessibilidade para acompanhar as aulas?
É possível pedir apoio inicial enquanto um documento ou laudo ainda está sendo providenciado?
Quais adaptações de material e avaliação podem ser analisadas pela escola?
Qual é o procedimento para solicitar intérprete de Libras ou outro recurso de comunicação?
Como solicitar material em formato acessível para leitor de tela ou baixa visão?
Há rota acessível até salas, laboratórios, biblioteca e demais espaços usados pela turma?
Como consultar as condições atuais de elevador, rampas e banheiros acessíveis?
O que fazer quando um recurso de acessibilidade está indisponível no dia da aula?
Como solicitar ajustes de mobiliário ou local de prova por necessidade de acessibilidade?
Que apoio pode ser solicitado por aluno com deficiência em atividades de laboratório e estágio?
Como a escola organiza acompanhamento de dificuldades persistentes de aprendizagem?
Como solicitar mediação quando uma adaptação combinada não está sendo aplicada?
Qual setor recebe pedidos de acolhimento por sofrimento emocional sem expor o aluno em canais públicos?
Existe atendimento psicológico na unidade ou apenas orientação e encaminhamento para outros serviços?
Como é feito o encaminhamento para a rede de proteção quando a escola identifica necessidade de apoio?
Como o estudante gestante solicita acompanhamento pedagógico e quais documentos são necessários?
Como solicitar atendimento pedagógico durante afastamento prolongado por saúde?
Como a família participa do acompanhamento sem divulgar dados sensíveis a pessoas não autorizadas?
Que apoio de comunicação existe para aluno ou responsável que não domina a língua portuguesa?
Como a escola atende pedidos de uso de nome social nos registros e na rotina escolar?
`],
['infraestrutura_biblioteca','Biblioteca laboratórios e espaços da escola','Biblioteca Coordenação e Administração',`
Quais são os horários atuais de atendimento da biblioteca em cada turno?
Quem pode usar a biblioteca e como funciona o cadastro para empréstimos?
Quantos materiais podem ser emprestados e qual é o prazo de devolução?
Como renovar um empréstimo ou reservar um material já emprestado?
O que fazer quando um livro da biblioteca é perdido ou danificado?
Existe catálogo online e qual é o endereço oficial de consulta?
Há acesso a livros digitais, normas técnicas ou bases de pesquisa pela escola?
Como reservar um espaço de estudo em grupo, se esse serviço existir?
É permitido usar computadores da biblioteca ou dos laboratórios fora da aula?
Como solicitar acesso a software necessário para uma atividade do curso?
Qual procedimento seguir ao encontrar equipamento quebrado ou com problema de segurança?
É permitido conectar notebook ou dispositivo pessoal à rede da escola?
Existe rede Wi Fi para alunos e qual é o procedimento oficial de acesso?
Como guardar e recuperar arquivos produzidos nos computadores compartilhados?
Há serviço de impressão ou digitalização para alunos e quais condições se aplicam?
Como solicitar uso de sala maker, auditório ou sala multiuso para um projeto?
Quais atividades podem usar a quadra e quem autoriza o acesso fora da aula?
Como consultar os espaços realmente disponíveis na sede e em cada classe descentralizada?
Quais são as regras de acesso a oficinas e laboratórios sem a presença do professor?
Como solicitar empréstimo de material para apresentação em evento fora da escola?
`],
['estagio_tcc_detalhes','Situações práticas de estágio e TCC','Coordenação de curso e responsável por estágio',`
Como conferir se uma vaga de estágio é compatível com as atividades previstas para o meu curso?
O estágio só pode começar depois de quais assinaturas e aprovações?
Quem providencia o seguro do estágio e como comprovar que está vigente?
Como consultar os limites de jornada do estágio aplicáveis à minha situação?
O que fazer se a empresa pedir início imediato sem a documentação concluída?
Como registrar mudança de supervisor, horário, atividade ou local de estágio?
Qual procedimento vale para encerrar um estágio antes do prazo combinado?
Como comunicar problemas, assédio ou atividade incompatível no local do estágio?
Como conciliar estágio, aulas e avaliações sem assumir que haverá abono de faltas?
Como são analisadas horas de estágio feitas antes da aprovação dos documentos?
Quais regras específicas de supervisão e prática se aplicam ao estágio de Enfermagem?
Quem confirma a elegibilidade de um egresso para solicitar dispensa de estágio e quais exceções de curso se aplicam?
Como as horas de TCC divulgadas no site são distribuídas na matriz específica da minha turma?
Quais critérios e pesos são usados na avaliação do TCC do meu curso?
O que acontece se um integrante do grupo não cumprir sua parte no TCC?
Como solicitar mudança de grupo ou de orientador por motivo justificado?
Quais limites de uso de inteligência artificial se aplicam à escrita, programação e pesquisa do TCC?
Como o TCC deve registrar autoria, referências e uso de código ou material de terceiros?
É preciso autorização para usar dados, imagens ou entrevistas com pessoas no TCC?
Como solicitar proteção de dados, sigilo ou restrição de divulgação de um TCC apresentado à comunidade?
`],
['avaliacao_familia_detalhes','Avaliação acompanhamento e participação da família','Coordenação Pedagógica Orientação e Secretaria',`
Como é dividido o acompanhamento das avaliações ao longo do ano em cada modalidade?
Existe semana de provas comum à escola ou o cronograma é definido por cada professor?
O Simula ETEC está previsto para este ano e para quais turmas?
Se houver simulado, como formato, conteúdos e efeitos na avaliação são comunicados oficialmente?
Como pedir orientação quando não entendo a devolutiva de uma atividade avaliada?
Qual procedimento vale para ausência em uma avaliação por motivo justificado?
Existe segunda chamada e quais requisitos e prazos oficiais se aplicam?
Como registrar problema técnico na entrega de uma atividade digital dentro do prazo?
Como são comunicadas atividades de progressão parcial de componentes práticos?
Como consultar a decisão do Conselho de Classe sobre minha situação sem acessar dados de outros alunos?
Como o aluno recebe orientações sobre pendências de componentes no último módulo ou série?
Quais efeitos uma progressão parcial tem sobre a emissão de documentos de conclusão?
Como é comunicada a aplicação de um prazo excepcional de reconsideração no fim do ano?
Como consultar minha situação quando a tela do sistema diverge de um resultado entregue pela escola?
Como um responsável recebe aviso de faltas recorrentes e risco de retenção?
Como o responsável atualiza suas autorizações e os canais de comunicação da família?
Como a escola trata pedidos de informações feitos por familiares que não são responsáveis legais?
Quais informações de aluno maior de idade podem ser fornecidas à família e por qual autorização?
Como solicitar reunião conjunta com professores de mais de uma disciplina?
Como a família acompanha os encaminhamentos combinados em uma reunião pedagógica?
`],
['cursos_oferta_detalhes','Oferta de cursos por turma e unidade','Direção e coordenações de curso',`
Quais cursos estão em funcionamento e quais apenas constam no catálogo histórico da escola?
Quais cursos são oferecidos em classes descentralizadas e em que endereço cada turma tem aula?
Há oferta atual de Logística e onde está o documento que confirma curso, turno e unidade?
Há oferta atual de Programação de Jogos Digitais e onde está o documento correspondente?
Há cursos online ou semipresenciais vinculados à unidade e quais encontros presenciais são exigidos?
Qual matriz de Mecânica está em vigor e ela prevê três ou quatro semestres para cada turma?
Qual é a carga horária total de Enfermagem para cada matriz e como as horas de estágio são contabilizadas?
Quais cursos e turmas contam com especialização em Urgência e Emergência ou APH neste período?
Quais requisitos profissionais e escolares são exigidos para ingresso na especialização oferecida?
Quais diferenças de organização e carga horária existem entre Mecatrônica diurna e noturna?
Quais qualificações intermediárias são emitidas em Informática para Internet e a partir de qual conclusão?
Quais qualificações intermediárias são emitidas em Mecatrônica e a partir de qual conclusão?
Qual é a diferença entre cursar Informática para Internet e Desenvolvimento de Sistemas nesta unidade?
O curso de Administração anunciado funciona na sede, em parceria ou em mais de um local?
Existe idade mínima ou requisito adicional específico para atividades práticas de algum curso?
Como é avisada uma mudança de matriz curricular e quais turmas continuam na matriz anterior?
O que acontece com a continuidade dos alunos se não houver abertura da turma seguinte do curso?
Como a escola orienta quem precisa mudar de turno por trabalho sem prometer existência de vaga?
Há componentes que exigem visita técnica, atividade externa ou deslocamento regular e como isso é informado antes do ingresso?
Quais registros profissionais ou exigências externas precisam ser consultados após concluir cada curso regulamentado?
`],
['seguranca_privacidade','Segurança convivência e privacidade','Direção Orientação e setor competente',`
Qual é o procedimento da escola quando um aluno passa mal durante a aula?
Como a escola avisa o responsável em uma emergência envolvendo aluno menor?
Onde o aluno deve informar necessidade de cuidado emergencial sem divulgar dados de saúde em grupos?
Como comunicar acidente ou situação de risco em laboratório ou oficina?
Onde consultar o plano de evacuação e o ponto de encontro da escola?
Qual setor acompanha prevenção de acidentes e recebe sugestões de segurança?
Qual canal recebe relato de assédio ou violência de forma reservada?
Como solicitar proteção e acompanhamento depois de relatar bullying ou discriminação?
É possível acompanhar um relato sem que ele seja divulgado para a turma?
Qual procedimento seguir quando uma ocorrência envolve alguém da própria equipe escolar?
Como pedir orientação para encaminhar uma reclamação à Ouvidoria depois do atendimento local?
Como solicitar acesso ou correção dos próprios dados pessoais mantidos pela escola?
Qual canal oficial recebe dúvidas sobre tratamento de dados e privacidade?
Como revogar ou revisar uma autorização de uso de imagem, quando isso for aplicável?
Como solicitar retirada de uma imagem publicada indevidamente em canal institucional?
Quais registros escolares o aluno ou responsável pode consultar e por qual procedimento de identificação?
Quais informações acadêmicas nunca devem ser enviadas a grupos públicos ou ao chat do Sylvinho?
Como comunicar golpe que usa o nome da escola para pedir dinheiro ou dados?
Qual é o procedimento para informar perda de documento pessoal dentro da unidade sem publicar seus dados?
Qual é o canal para pedir acolhimento após conflito escolar sem iniciar uma discussão em grupo de mensagens?
`],
['gestao_base_sylvinho','Confirmação das informações e comportamento do Sylvinho','Equipe do TCC e representantes dos setores',`
Qual setor pode aprovar as respostas de cada categoria antes de entrarem na base do Sylvinho?
Como a equipe registrará a confirmação de uma informação recebida presencialmente ou por mensagem institucional?
Qual é a frequência de revisão de horários, contatos, preços e procedimentos locais?
Quem avisará a equipe do Sylvinho quando uma informação aprovada deixar de valer?
Como identificar a versão de um comunicado que substitui uma orientação anterior?
Qual procedimento será usado quando o site, um documento e um comunicado recente trouxerem orientações diferentes?
Como as respostas devem indicar que uma data vale apenas para determinado ano, curso ou turno?
Que informações a escola autoriza publicar para qualquer visitante e quais exigem atendimento identificado?
Quais dados pessoais devem ser recusados ou removidos antes da curadoria de novos documentos?
Como os sete contatos institucionais já preparados serão reconfirmados individualmente quando houver mudança?
Quais perfis de redes sociais podem servir como origem de um comunicado e quem confirmará sua autenticidade?
Como registrar o conteúdo e a validade de um aviso temporário sem manter uma promoção ou inscrição vencida como atual?
Quais perguntas exigem orientação humana mesmo quando existem documentos relacionados na base?
Quando não houver confirmação, qual setor deve ser indicado para cada assunto em vez de encaminhar tudo à Secretaria?
Como o Sylvinho deve explicar uma falha técnica da IA sem dar a entender que a escola não tem a informação?
Quais exemplos de respostas a equipe considera naturais e adequados ao público da escola?
Como o Sylvinho deve diferenciar uma regra obrigatória de uma recomendação ou prática informal?
Quais perguntas reais de alunos ou responsáveis ainda não aparecem neste questionário e qual setor pode respondê-las?
Quem avaliará as respostas novas da IA para verificar se respeitam as fontes e as exceções?
Que evidências serão exigidas para aprovar cada resposta e quais testes devem impedir o retorno de informação informal como fato?
`],
['projetos_participacao','Projetos participação e identidade da escola','Direção coordenações e instituições auxiliares',`
Onde consultar a história oficial da escola e os documentos que confirmam sua criação e mudanças de nome?
Qual é o nome institucional completo e a identificação que devem aparecer nos documentos e no Sylvinho?
Onde consultar a missão e as diretrizes institucionais vigentes da unidade?
Como conhecer as atividades do Centro de Memória e solicitar uma visita, se houver atendimento ao público?
Quais projetos de extensão, pesquisa ou inovação estão abertos a alunos neste período?
Como inscrever um projeto na Feira Tecnológica e quais critérios de participação são usados?
Quem pode visitar a Feira Tecnológica e onde consultar a programação e os horários atuais?
Como participar da Semana Paulo Freire e de outros eventos pedagógicos previstos para a turma?
As atividades de eventos contam como aula, avaliação ou atividade complementar e quem confirma isso em cada caso?
Como apresentar uma proposta de clube, grupo de estudos ou atividade estudantil?
Quais atividades esportivas ou culturais estão disponíveis e como consultar inscrições e horários?
Como participar de olimpíadas, competições técnicas ou feiras externas representando a escola?
Existe apoio para deslocamento, inscrição ou materiais de competição e como verificar os critérios?
Onde consultar editais de intercâmbio ou oportunidades externas divulgadas oficialmente pela escola?
Como verificar se uma oportunidade divulgada por parceiro é reconhecida pela escola e continua aberta?
Como o estudante pode acompanhar as ações e as prestações de contas públicas da APM?
Como um aluno pode participar das discussões do Conselho de Escola pelos mecanismos previstos?
Como consultar a composição e o período de mandato vigente do grêmio e de outros órgãos de representação?
Como um ex-aluno pode participar de eventos, projetos ou ações de orientação profissional da escola?
Como empresas ou profissionais podem oferecer palestras e oportunidades sem divulgar dados pessoais dos alunos?
`],
];
const nomes={secretaria:'Secretaria',matricula:'Matrícula',documentos:'Documentos',calendario:'Calendário',avaliacao_frequencia:'Avaliação e frequência',transferencia_cancelamento:'Transferência trancamento e cancelamento',estagio_tcc:'Estágio e TCC',beneficios:'Benefícios e permanência',regras_gerais:'Regras gerais',cursos:'Cursos'};
const setores={secretaria:'Secretaria',matricula:'Secretaria',documentos:'Secretaria',calendario:'Secretaria e Direção',avaliacao_frequencia:'Coordenação Pedagógica e Secretaria',transferencia_cancelamento:'Secretaria e Coordenação',estagio_tcc:'Coordenação de curso e responsável por estágio',beneficios:'Orientação e setores dos programas',regras_gerais:'Direção e Orientação',cursos:'Direção e coordenações'};
const categorias=Object.keys(nomes).map(id=>({id,titulo:nomes[id],setor:setores[id],origem:'Levantamento original',questoes:originais.filter(q=>q.categoria===id).map(q=>({...q,origem:'original_200'}))}));
for(const [id,titulo,setor,bloco] of grupos){const linhas=bloco.trim().split('\n').map(s=>s.trim()).filter(Boolean);if(linhas.length!==20)throw Error(id+': '+linhas.length);categorias.push({id,titulo,setor,origem:'Ampliação para confirmação',questoes:linhas.map((pergunta,i)=>({id:`${id}-${String(i+1).padStart(3,'0')}`,pergunta,categoria:id,origem:'ampliacao',tipoLacuna:id==='gestao_base_sylvinho'?'D':'A_B_C_a_confirmar',status:'pendente',resposta:null}))});}
const todas=categorias.flatMap(c=>c.questoes);
if(todas.length!==480)throw Error('Total inesperado');
if(new Set(todas.map(q=>q.id)).size!==todas.length)throw Error('ID repetido');
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
if(new Set(todas.map(q=>norm(q.pergunta))).size!==todas.length)throw Error('Pergunta duplicada');
for(const q of originais){const atual=todas.find(x=>x.id===q.id);if(!atual||atual.pergunta!==q.pergunta)throw Error('Original alterada '+q.id);}
const fontes=[
['Contato','https://etecmatao.cps.sp.gov.br/contato/','A página apresenta números fixos diferentes no conteúdo e no rodapé. Confirmar o canal correto; horário geral não equivale a horário de cada setor.'],
['Cursos Etec','https://etecmatao.cps.sp.gov.br/cursos-etec/','A atualização indicada é 23/09/2024. A lista não comprova abertura de turma ou oferta no próximo ingresso.'],
['Regimentos e regulamentos','https://etecmatao.cps.sp.gov.br/regimento/','A descrição da página menciona a deliberação de 2013. A curadoria utiliza o PDF da Deliberação 87/2022; texto da página não deve substituir o documento normativo.'],
['Calendário Escolar 2026','https://etecmatao.cps.sp.gov.br/calendario-escolar-2025/','A página apresenta o calendário de 2026 alterado em 20/03/2026, embora o endereço termine em 2025. Conferir o conteúdo e a versão, não somente o nome do link.'],
['Trabalho de Conclusão de Curso','https://etecmatao.cps.sp.gov.br/trabalho-de-conclusao-de-curso-tcc/','A orientação geral precisa ser delimitada pela matriz e pelo curso de cada turma.'],
];
let md=`# Questionário completo para ampliar a base do Sylvinho\n\nEtec Sylvio de Mattos Carvalho · Unidade 103 · Matão\n\nPreparado em 12/11/2026. **480 perguntas em 24 categorias e 24 lotes de 20**: as 200 perguntas do levantamento original, preservadas com seus identificadores, e 280 perguntas complementares.\n\n## Como preencher\n\nResponda abaixo de cada pergunta. Pode enviar por lotes; não é necessário concluir tudo antes de devolver. Os identificadores entre colchetes permitem ligar cada resposta ao assunto correto. Se uma mesma resposta atender a outra pergunta, indique os respectivos identificadores em vez de copiar tudo.\n\n- **Confirmado**: orientação validada pelo setor competente, acompanhada de origem e data.\n- **Informal**: relato de aluno, experiência pessoal ou informação ainda não confirmada; continuará em revisão.\n- **Pendente**: ainda falta resposta ou confirmação.\n- **Não se aplica**: a situação ou o serviço não existe para aquele público; informe o escopo.\n\nOs campos começam pendentes. Uma resposta pode confirmar a regra geral e deixar o procedimento local pendente. Nenhum preço, prazo, benefício, vaga ou exceção deve ser estimado. Se souber apenas parte, escreva exatamente o que foi confirmado e o que falta.\n\nO campo “Confirmado por” pode conter o setor e a função institucional. Não é necessário incluir dados pessoais ou contato particular de funcionário. Não envie CPF, RG, senha, prontuário, documentos identificáveis de alunos ou relatos que exponham menores. Para exemplificar uma situação, remova dados pessoais.\n\nPara procedimentos, tente informar: quem pode pedir; passo a passo; canal e formulário; documentos necessários; prazo oficial e forma de contagem; eventual cobrança e fundamento; confirmação de recebimento; acompanhamento; exceções; setor que resolve problemas. Se não houver prazo fixo, registre isso. Para datas, valores e horários, informe também validade e público.\n\nAs perguntas originais podem ter recebido resposta parcial desde o primeiro levantamento. Elas estão mantidas para conferência integral; isso não significa que todas permaneçam totalmente sem cobertura. Não é preciso reescrever uma regra já documentada: cite a fonte e esclareça o procedimento ou a exceção perguntada.\n\n## Identificação da devolutiva\n\n- Data do preenchimento: [preencher]\n- Setor ou função de quem respondeu: [preencher]\n- Ano e semestre de referência: [preencher]\n- Cursos, turnos e locais abrangidos: [preencher]\n- Documentos oficiais anexados ou links de referência: [preencher]\n- Informações que precisam de validação por outro setor: [preencher]\n\n## Ordem sugerida de preenchimento\n\nComece pelos atendimentos mais frequentes: Secretaria, matrícula, documentos, calendário, rotina, contatos, uniforme e alimentação. Depois encaminhe cada bloco ao setor indicado. As perguntas de gestão do Sylvinho são destinadas à equipe do TCC junto aos setores, pois incluem decisões de curadoria e de funcionamento do assistente.\n\n## Índice dos lotes\n\n| Lote | Categoria | Perguntas | Origem |\n| --- | --- | --- | --- |\n`;
categorias.forEach((c,i)=>md+=`| ${i+1} | ${c.titulo} | ${i*20+1} a ${(i+1)*20} | ${c.origem} |\n`);
md+=`\n## Legenda das lacunas\n\nNas perguntas originais, **A** significa informação não localizada no levantamento; **B**, informação relacionada que precisa de escopo ou esclarecimento; **C**, possível desatualização. Nas complementares, o tipo será definido após a resposta e a conferência das fontes. **D** identifica uma decisão de curadoria ou funcionamento do projeto, e não uma regra escolar.\n\n## Pontos que exigem atenção na confirmação\n\n- A partir de 16 anos, a matrícula pelo próprio candidato está amparada no art. 64 do Regimento utilizado. Não transformar a orientação informal de acompanhamento de todo menor em obrigação. Saída antecipada de menor de 18 anos é outro assunto e precisa de seu procedimento próprio.\n- Camiseta, prazo de declaração, renovação pelo NSA, horário de merenda e formato de TCC relatados informalmente precisam de confirmação independente. Este questionário não os aprova.\n- O plano de trabalho docente é referido no art. 104 VIII. Divergências de citação devem ser conferidas no PDF da Deliberação 87/2022, e não resolvidas por memória ou opinião.\n- Não generalizar dispensa de estágio, progressão parcial, carga horária, regras de laboratório ou datas de uma turma para todos os cursos.\n- Uma pergunta sobre a existência de benefício, equipamento, serviço ou atendimento não afirma que ele exista. A resposta “não existe”, com setor e escopo, também é útil.\n\n`;
let numero=0;
for(const [i,c] of categorias.entries()){
 md+=`## Lote ${i+1} ${c.titulo}\n\n**Setor sugerido:** ${c.setor}.\n\n**Confirmação comum ao lote** — preencha aqui os dados que valem para várias respostas; registre as exceções em cada item.\n\n- Setor e função que confirmaram: [preencher]\n- Data da confirmação: [preencher]\n- Fonte, versão, página ou artigo: [preencher]\n- Cursos, turnos, idades e locais abrangidos: [preencher]\n- Vigência ou próxima revisão: [preencher]\n\n`;
 for(const q of c.questoes){numero++;const tipo=q.origem==='original_200'?`Lacuna original ${q.tipoLacuna}`:q.tipoLacuna==='D'?'Decisão do projeto':'Confirmação complementar';
 md+=`### ${numero} [${q.id}] ${q.pergunta}\n\n${tipo}.\n\n**Resposta:** [PENDENTE]\n\n**Situação:** Pendente / Confirmado / Informal / Não se aplica — selecionar.\n\n**Fonte e confirmação:** [dados comuns ao lote ou informar link, arquivo, página, setor e data específicos]\n\n**Aplica se e vigência:** [dados comuns ao lote ou informar curso, turma, turno, idade, local, início e fim específicos]\n\n**Exceções ou parte ainda pendente:** [preencher; se não houver, indicar]\n\n`;
 }
}
md+=`## Espaço para novas dúvidas\n\nAcrescente quantos itens forem necessários usando o modelo abaixo. Uma nova pergunta deve tratar de uma situação diferente ou esclarecer uma exceção ainda não coberta. Não crie respostas para completar campos sem evidência.\n\n### NOVA 001\n\n**Pergunta:** [preencher]\n\n**Categoria e setor:** [preencher]\n\n**Resposta:** [PENDENTE]\n\n**Situação:** Pendente / Confirmado / Informal / Não se aplica.\n\n**Fonte e confirmação:** [link ou documento, versão, página ou artigo, setor e data]\n\n**Aplica se e vigência:** [público, curso, turma, turno, local e período]\n\n**Exceções e pendências:** [preencher]\n\n## Fontes públicas usadas para orientar a ampliação\n\nConsulta realizada em 12/11/2026. Estes links ajudam a identificar o que precisa de confirmação; não substituem a validação de um procedimento local.\n\n`;
for(const [titulo,url,nota] of fontes)md+=`- [${titulo}](${url}). ${nota}\n`;
md+=`\n## Como a devolutiva será aproveitada\n\nCada resposta será desmembrada em fatos que possam ser conferidos separadamente. O registro de entrada terá: identificador, pergunta, variações de linguagem, resposta, categoria, aplica se, vigência, quem confirmou e fonte com versão e localização. Também serão registrados situação de aprovação e eventual versão substituída.\n\nAs variações poderão ser criadas depois, preservando o sentido confirmado. Somente fatos aprovados serão candidatos à busca, com filtros de vigência e público. Relatos informais, conflitos e campos pendentes permanecerão fora do índice. Antes de qualquer ativação, serão avaliadas recuperação, referências, respeito às exceções e respostas quando não houver informação.\n\nO preenchimento não autoriza publicação, importação no Firebase, commit ou deploy. A análise da devolutiva e a validação das fontes vêm antes de incluir qualquer informação nova na base utilizada pelo assistente.\n`;
const output=path.join(__dirname,'QUESTIONARIO-COMPLETO-SYLVINHO.md');
fs.writeFileSync(output,md,'utf8');
fs.writeFileSync(path.join(__dirname,'questionario-completo.json'),JSON.stringify({versao:1,data:'2026-11-12',total:todas.length,originais:200,complementares:280,sha256Originais:crypto.createHash('sha256').update(originalBytes).digest('hex'),categorias,nota:'Questionário sem respostas novas aprovadas. Não importar no índice.'},null,2)+'\n','utf8');
const audit={total:todas.length,lotes:categorias.length,porLote:categorias.map(c=>({categoria:c.id,total:c.questoes.length})),originaisPreservadas:originais.length,idsUnicos:true,semDuplicataExataNormalizada:true,respostasNovasPreenchidas:0,originaisInalterados:fs.readFileSync(originalPath).equals(originalBytes),arquivo:output};
fs.writeFileSync(path.join(__dirname,'verificacao.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
