// Contexto extraído somente das mensagens do usuário, nunca de afirmações do bot.
const n=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function assunto(s){
 if(/renov|rematricul/.test(s))return 'renovação da matrícula';
 if(/transfer/.test(s))return 'transferência';
 if(/tranc/.test(s))return 'trancamento';
 if(/cancel/.test(s))return 'cancelamento';
 if(/declaracao/.test(s))return 'declaração';
 if(/historico/.test(s))return 'histórico escolar';
 if(/diploma/.test(s))return 'diploma';
 if(/atestado/.test(s))return 'atestado';
 if(/matricul/.test(s))return 'matrícula inicial';
 if(/estagio/.test(s))return 'estágio';
 if(/\btcc\b/.test(s))return 'TCC';
 if(/frequencia|presenca|faltas/.test(s))return 'frequência mínima';
 if(/dependencia|\bdp\b/.test(s))return 'dependência';
 if(/recuperacao/.test(s))return 'recuperação';
 if(/sair.*cedo|saida.*(antecipada|aula)/.test(s))return 'saída antecipada';
 if(/recesso/.test(s))return 'recesso escolar';
 if(/vestibulinho/.test(s))return 'vestibulinho';
 if(/horario.*secretaria|secretaria.*horario/.test(s))return 'horário da Secretaria';
 if(/horario|funcionamento/.test(s))return 'horário de funcionamento';
 if(/camiseta|uniforme/.test(s))return 'uniforme';
 if(/biblioteca/.test(s))return 'biblioteca';
 return null;
}
const cursos=[[/\benfermagem\b/,'enfermagem'],[/\bdesenvolvimento de sistemas\b|\bds\b/,'desenvolvimento de sistemas'],[/\binformatica para internet\b/,'informatica-para-internet'],[/\bmecatronica\b/,'mecatronica'],[/\bmecanica\b/,'mecanica'],[/\badministracao\b/,'administracao'],[/\beletrotecnica\b/,'eletrotecnica'],[/\blogistica\b/,'logistica']];
const curso=s=>cursos.find(([r])=>r.test(s))?.[1];
const turno=s=>/noturno|\ba noite\b/.test(s)?'noite':/matutino|\bmanha\b/.test(s)?'manha':/vespertino|\btarde\b/.test(s)?'tarde':undefined;
const seguimento=s=>/^(e\b|onde (entrego|levo|faco|solicito)|precisa de responsavel|preciso de responsavel|qual (e )?o prazo|quais documentos|qual o artigo|de onde|onde esta|tem link|no meu curso|pode ser online)/.test(s);
export function resolverConversaCurada(pergunta,historico=[],escopo={}){
 const atual=n(pergunta);let tema=null,anterior='',estado={};
 for(const m of historico.slice(-12)){
  if(m?.remetente!=='user'||typeof m.texto!=='string')continue;
  const t=n(m.texto),c=curso(t),a=assunto(t);
  if(c){if(c!==estado.curso)delete estado.turno;estado.curso=c;}
  const tr=turno(t),ano=t.match(/\b20\d{2}\b/)?.[0],idade=t.match(/\b(?:tenho|meu filho tem|minha filha tem|o candidato tem|a candidata tem) (\d{1,2}) anos\b/)?.[1];
  if(tr)estado.turno=tr;if(ano)estado.ano=Number(ano);if(idade)estado.idade=Number(idade);
  if(a)tema=a;
  else if(!seguimento(t)&&!c&&!/^(oi|ola|obrigad[oa]|valeu|\d{1,2} anos)$/.test(t))tema=null;
  anterior=t;
 }
 const clarificador=historico.at(-1)?.remetente==='bot'&&/matrícula inicial ou renovar|matrícula inicial ou renovação/i.test(historico.at(-1).texto||'');
 const pediuCurso=historico.at(-1)?.remetente==='bot'&&/qual é o seu curso/i.test(historico.at(-1).texto||'');
 const direto=assunto(atual),c=curso(atual),follow=seguimento(atual)||clarificador&&/^(renovar|renovacao|rematricula|a inicial|inicial)$/.test(atual)||!!c&&pediuCurso;
 if(c){if(c!==estado.curso)delete estado.turno;estado.curso=c;}
 const tr=turno(atual),ano=atual.match(/\b20\d{2}\b/)?.[0],idade=atual.match(/\b(?:tenho|meu filho tem|minha filha tem|o candidato tem|a candidata tem) (\d{1,2}) anos\b/)?.[1];
 if(tr)estado.turno=tr;if(ano)estado.ano=Number(ano);if(idade)estado.idade=Number(idade);
 // Curso/ano anteriores só acompanham referências à conversa; pergunta nova é autônoma.
 if(!follow){estado={...(c?{curso:c}:{}),...(tr?{turno:tr}:{}),...(ano?{ano:Number(ano)}:{}),...(idade?{idade:Number(idade)}:{})};}
 estado={...estado,...escopo};
 const temaAtual=direto||tema;
 if(clarificador&&/^(renovar|renovacao|rematricula)$/.test(atual))return {pergunta:'Como renovo a matrícula?',escopo:estado,tema:'renovação da matrícula',usaHistorico:true};
 if(clarificador&&/^(a )?inicial$/.test(atual))return {pergunta:'Como fazer a matrícula inicial?',escopo:estado,tema:'matrícula inicial',usaHistorico:true};
 if(c&&pediuCurso&&tema)return {pergunta:'Como funciona '+tema+' no curso de '+c+'?',escopo:estado,tema,usaHistorico:true};
 if(/meu curso|minha turma/.test(atual)&&!estado.curso)return {esclarecimento:'Qual é o seu curso?',escopo:estado};
 if(/^(e )?o horario$/.test(atual))return {esclarecimento:'Você quer saber o horário da Secretaria ou das aulas?',escopo:estado};
 if(follow&&!temaAtual)return {esclarecimento:'Você quer saber isso sobre matrícula, documentos ou outro assunto?',escopo:estado};
 let intencao=/onde (entrego|levo|faco|solicito)|pode ser online/.test(atual)?'canal':/precis[ao] de responsavel/.test(atual)?'responsavel':/quais documentos/.test(atual)?'documentos':/qual (e )?o prazo/.test(atual)?'prazo':null;
 let consulta=pergunta;
 if(follow&&temaAtual&&!direto)consulta=pergunta+' (sobre '+temaAtual+')';
 if(/qual o artigo|de onde|onde esta|tem link/.test(atual)&&/perder|perdi/.test(anterior)&&/prazo/.test(anterior)&&tema==='renovação da matrícula')consulta=pergunta+' (sobre perda do prazo de renovação)';
 if(intencao==='responsavel'&&temaAtual==='matrícula inicial')consulta='Sou menor, posso me matricular sozinho?';
 if(intencao==='documentos'&&temaAtual==='matrícula inicial')consulta='Quais documentos preciso para a matrícula?';
 if(intencao==='prazo'&&temaAtual==='renovação da matrícula')consulta='Quando renovo a matrícula'+(estado.ano?' em '+estado.ano:'')+'?';
 return {pergunta:consulta,escopo:estado,tema:temaAtual,intencao,usaHistorico:follow};
}
