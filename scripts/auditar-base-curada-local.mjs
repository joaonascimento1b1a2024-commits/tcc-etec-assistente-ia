// Auditoria somente de leitura; não consulta serviços externos nem aprova fatos.
import {readFileSync} from 'node:fs';
import {elegivel} from '../local-e2e/curadoria-local.mjs';
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8'));
const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const ids=new Set(),problemas=[],revisoes=[],indisponiveis=[];
const dataValida=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
for(const [indice,r] of registros.entries()){
 const id=typeof r?.id==='string'&&/^[a-z0-9-]{1,100}$/.test(r.id)?r.id:null;
 const erro=codigo=>problemas.push({indice,id,codigo});
 if(!id){erro('ID_INVALIDO');continue;}
 if(ids.has(id))erro('ID_DUPLICADO');ids.add(id);
 if(!Array.isArray(r.variacoes)||r.variacoes.some(v=>typeof v!=='string'))erro('VARIACOES_INVALIDAS');
 if(typeof r.pergunta!=='string'||!r.pergunta.trim()||typeof r.resposta!=='string'||!r.resposta.trim())erro('TEXTO_AUSENTE');
 const v=r.vigencia||{};
 for(const campo of ['inicio','fim','revisarEm'])if(v[campo]&&!dataValida(v[campo]))erro('DATA_INVALIDA_'+campo.toUpperCase());
 if(v.inicio&&v.fim&&v.inicio>v.fim)erro('VIGENCIA_INVERTIDA');
 if(dataValida(v.revisarEm)&&v.revisarEm<=hoje)revisoes.push({id,revisarEm:v.revisarEm});
 const s=r.aplicaSe||{};
 const escopo={hoje,curso:Array.isArray(s.cursos)?s.cursos[0]:undefined,turno:Array.isArray(s.turnos)?s.turnos[0]:undefined,idade:Array.isArray(s.idades)?s.idades[0]?.min:undefined};
 let permitido=false;
 try{permitido=elegivel(r,escopo);}catch{erro('ESTRUTURA_INVALIDA');}
 if(!permitido){
  const temporal=dataValida(v.inicio)&&v.inicio>hoje||dataValida(v.fim)&&v.fim<hoje;
  indisponiveis.push({id,motivo:temporal?'FORA_DA_VIGENCIA':r.status!=='aprovado'?'NAO_APROVADO':'METADADOS_OU_ESCOPO_INVALIDOS'});
  if(r.status==='aprovado'&&!temporal)erro('APROVADO_INELEGIVEL');
 }
}
console.log(JSON.stringify({tipo:'auditoria estrutural local; não certifica fatos nem autenticidade dos hashes',hoje,total:registros.length,problemas,revisoesPendentes:revisoes,indisponiveis},null,2));
if(problemas.length)process.exitCode=1;
