import test from 'node:test';
import assert from 'node:assert/strict';
import {contextoNatural,escopoNatural} from '../local-e2e/conversa-natural.mjs';
const message=(texto,id)=>({texto,remetente:'user',messageId:id});
for(const text of ['oi','oir','ojo','boa tarde'])test('saudação acolhedora '+text,()=>assert.match(escopoNatural(text).resposta,/Oi! Sou o Sylvinho/));
for(const [text,expected] of [['e o prazo?','prazo'],['e quais documentos?','documentos'],['precisa de assinatura?','assinatura'],['onde faço isso?','Onde solicitar'],['pode ser online?','internet']]){
 test('continuação '+text,()=>{const r=contextoNatural(text,'agora',[message('Como faço para renovar minha matrícula?','antes'),message(text,'agora')]);assert.match(r.pergunta,new RegExp(expected));assert.match(r.pergunta,/renovação de matrícula/);});
}
test('não herda assunto após mudança externa nem de outra conversa',()=>{
 assert.ok(contextoNatural('e o prazo?','agora',[message('qual o valor de pi','antes'),message('e o prazo?','agora')]).esclarecimento);
 assert.ok(contextoNatural('e o prazo?','ausente',[message('matrícula','antes')]).esclarecimento);
});
test('saudação com pedido externo não é disfarçada de conversa social',()=>assert.equal(escopoNatural('oi, qual o valor de pi?').categoria,'fora_escopo'));
test('matrícula ambígua pede distinção e entende resposta curta',()=>{
 const question=escopoNatural('Como faço a matrícula?').resposta;
 assert.match(question,/inicial ou renovar/);
 assert.equal(contextoNatural('renovar','agora',[message('Como faço a matrícula?','antes'),{remetente:'bot',texto:question},message('renovar','agora')]).pergunta,'Como renovar a matrícula?');
});
