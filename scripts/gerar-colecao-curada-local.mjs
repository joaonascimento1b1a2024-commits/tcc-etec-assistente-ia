import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fatos} from '../knowledge-local/fatos-conferidos.mjs';
const out='knowledge-local';mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const fontes=read('.cache/curadoria-sylvinho/fontes.json');
const web=read('.cache/curadoria-sylvinho/conferencia-web.json');
const regPages=read('.cache/curadoria-sylvinho/sources/regimento-comum-87-2022.pdf.paginas.json');
const clean=s=>s.replace(/^D\.O\.E\..*$/gm,'').replace(/^Página \d+ de \d+$/gm,'').replace(/\s+/g,' ').trim();
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const full=regPages.map(p=>clean(p.texto)).join(' ');
const categorias={'SECRETARIA':'secretaria','MATRÍCULA':'matricula','DOCUMENTOS':'documentos','CALENDÁRIO':'calendario','AVALIAÇÃO E FREQUÊNCIA':'avaliacao_frequencia','TRANSFERÊNCIA E CANCELAMENTO':'transferencia_cancelamento','ESTÁGIO E TCC':'estagio_tcc','BENEFÍCIOS':'beneficios','REGRAS GERAIS':'regras_gerais','CURSOS':'cursos'};
function artigo(n){
 const start=full.indexOf('Artigo '+n+' ');let end=full.indexOf('Artigo '+(Number(n)+1)+' ',start);
 if(start<0)throw Error('ARTIGO_AUSENTE '+n);if(end<0)end=full.length;
 const texto=full.slice(start,end).trim();
 const paginas=regPages.filter(p=>clean(p.texto).includes('Artigo '+n+' ')).map(p=>p.pagina);
 // Inclui páginas de continuação até o próximo artigo, sem perder exceções.
 const first=paginas[0],nextPage=regPages.find(p=>p.pagina>=first&&clean(p.texto).includes('Artigo '+(Number(n)+1)+' '))?.pagina||first;
 return {tipo:'oficial_regimento',referencia:'Regimento Comum, art. '+n,url:fontes.find(f=>f.id==='regimento-comum-87-2022').url,sha256:fontes.find(f=>f.id==='regimento-comum-87-2022').sha256,paginas:Array.from({length:nextPage-first+1},(_,i)=>first+i),evidencia: texto,conferidoEm:'2026-11-12',semCertificacaoDeAlteracoesPosteriores:true};
}
function evidencia(ref){
 if(/^\d/.test(ref))return ref.split(',').map(artigo);
 const [kind,ids]=ref.split(':');
 if(kind==='vest'){
  // Conteúdo lido pela ferramenta web no portal oficial; fetch local recebeu 403.
  const evidencia='De 02/09 até as 20h do dia 10/11/2026: inscrições. 02/12/2026 a partir das 15h: locais de exame. 06/12/2026 às 13h30: exame para o primeiro semestre de 2027.';
  return [{tipo:'oficial_calendario',url:'https://vestibulinho.etec.sp.gov.br/calendario/',evidencia,sha256:createHash('sha256').update(evidencia).digest('hex'),hashDoExcerto:true,formaConferencia:'leitura web do portal oficial em 12/11/2026, corroborada pelo PDF local pp. 7 e 11; fetch local HTTP 403',conferidoEm:'2026-11-12'}];
 }
 if(kind==='portaria'){
  const p=read('.cache/curadoria-sylvinho/portaria-2027.json');
  return [{tipo:'oficial_manual',url:p.url,indiceOficial:p.indiceOficial,sha256:p.sha256,paginas:ids.split(',').map(Number),referencia:'Portaria do Vestibulinho 1SEM2027, art. 39',evidencia:p.paginas.filter(x=>ids.split(',').includes(String(x.pagina))).map(x=>clean(x.texto)).join('\n'),conferidoEm:p.conferidoEm}];
 }
 if(kind==='site'){
  const f=web[ids];if(!f?.ok||f.excertos.some(e=>!e.texto))throw Error('SITE_NAO_CONFERIDO '+ids);
  return [{tipo:'oficial_site',url:f.url,sha256:f.sha256,evidencia:f.excertos.map(e=>e.texto).join('\n'),conferidoEm:f.conferidoEm,coletaDeclaradaNosMateriais:f.coletaDeclaradaNosMateriais}];
 }
 const source=fontes.find(f=>f.id===(kind==='folder'?'regimento-interno-2024':'calendario-2026'));
 const pages=read('.cache/curadoria-sylvinho/'+source.arquivo+'.paginas.json');
 return [{tipo:kind==='folder'?'oficial_folder':'oficial_calendario',referencia:source.titulo,url:source.url,sha256:source.sha256,paginas:ids.split(',').map(Number),evidencia:pages.filter(p=>ids.split(',').includes(String(p.pagina))).map(p=>clean(p.texto)).join('\n'),conferidoEm:'2026-11-12'}];
}
const aprovados=fatos.map(([id,categoria,pergunta,resposta,ref,vs])=>{
 const fonte=evidencia(ref);const cal=ref.startsWith('calendario');const folder=ref.startsWith('folder');
 return {id,pergunta,variacoes:vs.split('|'),resposta,categoria,aplicaSe:cal?{cursos:['administracao','administracao-mtec','eletrotecnica','informatica','informatica-para-internet','logistica','mecanica','mecatronica'],turnos:[],idades:[],nota:'Calendário geral Etec 103; não extrapolar para turmas não listadas.'}:{cursos:[],turnos:[],idades:[]},vigencia:{inicio:cal?'2026-01-01':null,fim:cal?'2026-12-31':folder?'2027-12-31':null,ano:cal?2026:null,revisarEm:folder?'2026-11-12':null},quemConfirmou:{tipo:'conferencia_fonte_primaria',responsavel:'curadoria local assistida',data:'2026-11-12',nota:'Conferência da evidência; não é confirmação telefônica da Secretaria.'},fonte,status:'aprovado',versao:1,substitui:[],procedimentoLocal:null,prioridade:ref.startsWith('site')?4:folder?3:cal?2:1,origem:'faq_curada'};
});
for(const r of aprovados){if(r.fonte.some(f=>f.tipo==='oficial_manual')||r.categoria==='vestibulinho')r.vigencia={inicio:r.id==='vestibulinho-inscricoes'?'2026-11-11':'2026-09-02',fim:r.categoria==='vestibulinho'?'2026-12-06':'2027-02-28',ano:null,anos:[2026,2027],ciclo:'1SEM2027'};}
aprovados.find(r=>r.id==='enfermagem-catalogo').aplicaSe.cursos=['enfermagem'];
aprovados.find(r=>r.id==='ptd').fonte.find(f=>f.referencia==='Regimento Comum, art. 104').referencia='Regimento Comum, art. 104-VIII';
// Os sete contatos são liberados individualmente, só depois da evidência pública.
const valores=[['whatsapp-secretaria','(16) 99637-1226','16996371226','contato','99637'],['whatsapp-orientacao','(16) 99716-1071','16997161071','contato','99716'],['whatsapp-geral','(16) 99189-2181','16991892181','contato','geral'],['email-diretoria','e103dir@cps.sp.gov.br',null,'contato','e103dir@'],['email-administrativa','e103adm@cps.sp.gov.br',null,'contato','e103adm@'],['email-academica','e103acad@cps.sp.gov.br',null,'contato','e103acad@'],['email-apm','e103apm@cps.sp.gov.br',null,'apm','e103apm@']];
const contatos=valores.map(([id,valor,digitos,origem,termo])=>{
 const f=web[origem],texto=termo==='geral'?f?.whatsappGeralLink:f?.excertos.find(e=>e.termo===termo)?.texto;
 const fonte=f?.ok&&texto?{tipo:'site_oficial',url:f.url,sha256:f.sha256,evidencia:texto,conferidoEm:f.conferidoEm,coletaDeclaradaNosMateriais:'2026-11-11'}:null;
 const apoio=['whatsapp-secretaria','email-academica'].includes(id)?evidencia('folder:2'):[];
 return {id,valor,digitos,status:fonte?'aprovado':'em_revisao',fonte,apoioFolder:apoio,observacao:id==='email-academica'?'Texto público e folder conferidos; mailto do site divergente não é usado.':null};
});
for(const c of contatos.filter(c=>c.status==='aprovado'))aprovados.push({id:c.id,pergunta:'Qual é o '+c.id.replaceAll('-',' ')+'?',variacoes:[c.id.replaceAll('-',' '),'contato '+c.id.replaceAll('-',' '),'telefone '+c.id.replaceAll('-',' '),'email '+c.id.replaceAll('-',' ')],resposta:c.valor,categoria:'contato',aplicaSe:{cursos:[],turnos:[],idades:[]},vigencia:{inicio:null,fim:null,ano:null},quemConfirmou:{tipo:'conferencia_fonte_publica',data:'2026-11-12'},fonte:[c.fonte,...c.apoioFolder],status:'aprovado',versao:1,substitui:[],procedimentoLocal:null,prioridade:4,origem:'faq_curada'});
const material=readFileSync('C:/Users/jvict/Downloads/SYLVINHO-material-completo-para-codex.md','utf8');
const respostas=readFileSync('C:/Users/jvict/Downloads/respostas-200-perguntas-codex.md','utf8');
const materialHash=createHash('sha256').update(material).digest('hex');
const respostasHash=createHash('sha256').update(respostas).digest('hex');
let heading='',section='',i=0;const parteB=[];
for(const line of material.split(/\r?\n/)){
 if(line.startsWith('# PARTE ')){section=line;continue;}
 if(!section.startsWith('# PARTE B'))continue;
 if(line.startsWith('## ')){heading=line.slice(3);continue;}
 if(!/^\s*- /.test(line)&&!line.startsWith('**'))continue;
 const texto=line.trimStart().replace(/^- /,'').replaceAll('105-VIII','104-VIII');
 const temIdentificacao=/Direção \(site, página sem data\)/.test(texto);
 const status=temIdentificacao?'pendente':'em_revisao';
 const textoSeguro=temIdentificacao?'Nomes atuais dos ocupantes dos cargos: confirmar com o setor; identificação pessoal omitida.':texto;
 const categoriasB={B1:'contato',B2:'rotina',B3:'secretaria',B4:'matricula',B5:'avaliacao_frequencia',B6:'regras_gerais',B7:'calendario',B8:'vestibulinho',B9:'cursos',B10:'estagio_tcc',B11:'infraestrutura',B12:'setores',B13:'sistemas',B14:'historia',B15:'instagram'};
 parteB.push({id:'material-b-'+String(++i).padStart(3,'0'),pergunta:heading+' — '+textoSeguro.replace(/\*\*/g,'').split(':')[0],variacoes:[],resposta:null,categoria:categoriasB[heading.split('.')[0]]||slug(heading),aplicaSe:null,vigencia:null,quemConfirmou:null,fonte:[{tipo:'material_recebido',arquivo:'SYLVINHO-material-completo-para-codex.md',sha256:materialHash,secao:heading}],status,versao:1,substitui:[],alegacaoRecebida:textoSeguro,origemDeclarada:/\[A\]|\[A |\+ A\]|segundo o aluno|aluno disse|aluno,/.test(texto)?'AL_ou_mista':'OF_ou_indefinida',procedimentoLocal:null,nota:'Proposta, não indexada. Só os fatos atômicos conferidos em fatos-conferidos.mjs podem responder.'});
}
const lista=read('docs/levantamento-base/perguntas-pendentes.json').perguntas;
const recebidas=new Map();let cat='';
for(const line of respostas.split(/\r?\n/)){
 if(line.startsWith('## ')){const name=line.slice(3).split(' (')[0];cat=categorias[name]||'';continue;}
 const m=/^- (\d+)(?:[–-](\d+))? \[([^\]]+)\] (.+)$/.exec(line);
 if(!cat||!m)continue;
 for(let numero=+m[1];numero<=+(m[2]||m[1]);numero++)recebidas.set(cat+'-'+numero,{codigo:m[3],texto:m[4].replaceAll('105-VIII','104-VIII')});
}
const propostas=lista.map(p=>{const r=recebidas.get(p.categoria+'-'+p.numero);return {id:p.id,pergunta:p.pergunta,variacoes:[],resposta:null,categoria:p.categoria,aplicaSe:null,vigencia:null,quemConfirmou:null,fonte:r?[{tipo:'material_recebido',arquivo:'respostas-200-perguntas-codex.md',sha256:respostasHash,item:p.categoria+' '+p.numero}]:[],status:r?'em_revisao':'pendente',versao:1,substitui:[],alegacaoRecebida:r?.texto||null,codigoRecebido:r?.codigo||null,procedimentoLocal:null,nota:r?'Revisar correspondência exata com a pergunta; parte oficial utilizável existe apenas nos fatos atômicos aprovados.':'Sem dado confirmado; não indexar.'};});
const partes={
 'secretaria-006':['historico','bullying'],'secretaria-018':['whatsapp-secretaria'],'secretaria-019':['email-academica'],'secretaria-020':['endereco'],
 'matricula-001':['matricula-documentos'],'matricula-017':['renovacao-2026'],'matricula-018':['matricula-idade'],
 'documentos-003':['historico'],'documentos-005':['diploma'],'documentos-016':['declaracao-componentes'],'documentos-018':['diploma'],
 'calendario-002':['inicio-2026'],'calendario-004':['recesso-2026'],'calendario-008':['resultados-2026'],'calendario-012':['renovacao-2026'],
 'avaliacao_frequencia-006':['saude'],'avaliacao_frequencia-008':['ptd'],'avaliacao_frequencia-009':['recuperacao'],'avaliacao_frequencia-011':['reconsideracao'],'avaliacao_frequencia-015':['frequencia'],'avaliacao_frequencia-016':['recuperacao','dependencia'],'avaliacao_frequencia-017':['reconsideracao'],'avaliacao_frequencia-018':['reconsideracao'],'avaliacao_frequencia-019':['reconsideracao'],
 'transferencia_cancelamento-005':['transferencia-entrada'],'transferencia_cancelamento-006':['transferencia-entrada'],'transferencia_cancelamento-009':['transferencia-entrada'],'transferencia_cancelamento-010':['trancamento'],'transferencia_cancelamento-012':['trancamento'],'transferencia_cancelamento-016':['transferencia','trancamento'],'transferencia_cancelamento-017':['transferencia'],
 'estagio_tcc-001':['estagio'],'estagio_tcc-009':['estagio'],'estagio_tcc-011':['tcc-site'],'estagio_tcc-020':['estagio'],
 'beneficios-020':['whatsapp-orientacao'],'regras_gerais-003':['bullying','whatsapp-orientacao'],'regras_gerais-004':['suspensao'],'regras_gerais-005':['suspensao'],'regras_gerais-006':['saida-antecipada'],'regras_gerais-007':['saida-antecipada'],'regras_gerais-015':['celular-aula'],'regras_gerais-016':['uniforme','calcado'],
 'cursos-001':['enfermagem-catalogo'],'cursos-005':['enfermagem-catalogo']};
for(const p of propostas)p.partesAprovadas=partes[p.id]||[];
const write=(n,v)=>writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
write('faq-curada.json',aprovados);write('propostas-parte-b.json',parteB);write('respostas-200-curadoria.json',propostas);write('contatos-publicos.json',contatos);
write('instagram.json',{versao:1,entradas:[]});
write('instagram.schema.json',{$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',additionalProperties:false,required:['id','texto','url','data_publicacao','vigencia_fim','status','revisor','semDadosPessoais'],properties:{id:{type:'string',pattern:'^ig-[a-z0-9-]+$'},texto:{type:'string',minLength:1,maxLength:2000},url:{type:'string',pattern:'^https://www\\.instagram\\.com/(p|reel)/'},data_publicacao:{type:'string',format:'date'},vigencia_fim:{type:'string',format:'date'},status:{enum:['pendente','em_revisao','aprovado','conflito','expirado']},revisor:{type:['string','null']},semDadosPessoais:{const:true}}});
write('resumo.json',{criadoEm:new Date().toISOString(),aprovados:aprovados.length,parteB:parteB.length,perguntas200:propostas.length,recebidas:propostas.filter(p=>p.status==='em_revisao').length,semDado:propostas.filter(p=>p.status==='pendente').length,contatosLiberados:contatos.filter(c=>c.status==='aprovado').length,base290Alterada:false});
console.log(read(out+'/resumo.json'));
