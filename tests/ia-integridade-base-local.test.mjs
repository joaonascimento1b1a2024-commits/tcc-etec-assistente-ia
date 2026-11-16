import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {elegivel,criarBuscaCurada} from '../local-e2e/curadoria-local.mjs';
const registros=JSON.parse(readFileSync('knowledge-local/faq-curada.json','utf8'));
const freq=registros.find(r=>r.id==='frequencia');
const escopo={hoje:'2026-11-16'};
test('IDs duplicados impedem iniciar busca mesmo com respostas iguais',()=>{
 assert.throws(()=>criarBuscaCurada({registros:[freq,{...freq}]}),/BASE_ID_DUPLICADO/);
});
test('IDs duplicados conflitantes não contornam a detecção de conflito',()=>{
 assert.throws(()=>criarBuscaCurada({registros:[freq,{...freq,resposta:'A frequência mínima é 80%.'}]}),/BASE_ID_DUPLICADO/);
});
for(const [campo,valor] of [['cursos','logistica'],['turnos',{}],['idades',[{min:18,max:15}]],['idades',[{min:'16',max:18}]]]){
 test('escopo malformado é inelegível: '+campo+' '+JSON.stringify(valor),()=>{
  assert.equal(elegivel({...freq,aplicaSe:{...freq.aplicaSe,[campo]:valor}},{...escopo,curso:'logistica',turno:'noite',idade:16}),false);
 });
}
test('registro sem identidade não entra na busca',()=>{
 assert.throws(()=>criarBuscaCurada({registros:[{...freq,id:undefined}]}),/BASE_ID_INVALIDO/);
});
test('data atual inválida não libera conteúdo com vigência',()=>{
 assert.equal(elegivel(freq,{hoje:'2026-02-30'}),false);
});
test('vigência invertida não é aprovada pela auditoria de elegibilidade',()=>{
 assert.equal(elegivel({...freq,vigencia:{inicio:'2026-12-01',fim:'2026-01-01'}},escopo),false);
});
test('data de revisão não equivale a vencimento automático',()=>{
 assert.equal(elegivel({...freq,vigencia:{revisarEm:'2026-11-12'}},escopo),true);
});
test('base original continua utilizável sem modificação',async()=>{
 const r=await criarBuscaCurada({registros})('Qual é a frequência mínima?',escopo);
 assert.equal(r.selecionados[0].registro.id,'frequencia');
});
